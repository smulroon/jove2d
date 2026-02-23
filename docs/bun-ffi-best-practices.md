# Bun FFI Best Practices

Lessons learned from building jove2d with `bun:ffi` and 6 native libraries (SDL3, SDL_ttf, SDL_image, Box2D, audio_decode, pl_mpeg). These patterns were discovered through debugging crashes, heap corruption, and stale data bugs — most under high-frequency FFI usage (300+ physics bodies at 60 FPS).

See also: [Benchmark Crash Investigation](benchmark-crash-investigation.md) for the full debugging story.

## 1. Minimize FFI Calls Per Frame

**Problem:** High-frequency FFI calls (650+/frame) trigger Bun internals bugs — segfaults, heap corruption, GC pressure. The crash rate scaled linearly with call volume.

**Solution:** Batch operations into combined C functions. One FFI call that does everything is better than hundreds of small ones.

Before (650 FFI calls/frame):
```
JS: step()           → 1 FFI call
JS: getBodyEvents()  → 1 FFI call
JS: getContacts()    → 1 FFI call
JS: getPosition() ×300 → 300 FFI calls
JS: getAngle() ×300    → 300 FFI calls
JS: ...                 → 50+ more
```

After (1 FFI call/frame):
```c
// box2d_jove.c — does step + events + transform caching in one call
void jove_World_UpdateFull2(uint32_t worldId, float dt, int subSteps) {
    b2World_Step(wid, dt, subSteps);

    // Cache body transforms from move events into C-side arrays
    b2BodyEvents bodyEvents = b2World_GetBodyEvents(wid);
    for (int i = 0; i < bodyEvents.moveCount; i++) {
        g_evMovePosX[i]  = bodyEvents.moveEvents[i].transform.p.x;
        g_evMovePosY[i]  = bodyEvents.moveEvents[i].transform.p.y;
        g_evMoveAngle[i] = b2Rot_GetAngle(bodyEvents.moveEvents[i].transform.q);
    }

    // Contact events written to C-side buffers too
    // ... begin, end, hit, preSolve events ...
}
```

JS reads results from C-side buffers after the single call (see practice #3).

**Result:** 0 crashes in 10×30s runs (was ~50% crash rate).

## 2. Avoid `u64` (BigInt) Returns in Hot Paths

**Problem:** FFI functions returning `u64` allocate a BigInt on every call. Under high volume this triggers a Bun bug that corrupts the heap.

**Solution:** Store IDs in C-side static arrays. JS uses `int` indices to refer to them.

```c
// C side: store Box2D IDs in static arrays, return int index
#define MAX_BODIES 4096
static b2BodyId g_bodies[MAX_BODIES];
static int g_bodyFree[MAX_BODIES];
static int g_bodyFreeCount = 0;
static int g_bodyNextIdx = 0;

static int alloc_body(void) {
    if (g_bodyFreeCount > 0) return g_bodyFree[--g_bodyFreeCount];
    if (g_bodyNextIdx < MAX_BODIES) return g_bodyNextIdx++;
    return -1;
}

int jove_Body_Create(uint32_t worldId, int type, float x, float y) {
    int idx = alloc_body();
    if (idx < 0) return -1;
    // ... create body ...
    g_bodies[idx] = bodyId;
    return idx;  // JS gets an int, not a u64
}
```

```typescript
// JS side: uses int index, zero BigInt allocations
const bodyIdx: number = lib().jove_Body_Create(worldId, type, x, y);
// Later: pass bodyIdx back to C functions that look up g_bodies[idx]
```

**When BigInt is OK:** Infrequent operations (joint creation, queries) can still return `u64`. The bug only triggers at high call volume.

## 3. Use C-Side Buffers + `read.*()` for Out-Params

**Problem:** `ptr(typedArray)` returns a pointer to Bun's **internal copy** of the buffer. After C writes to this pointer, the JS-side TypedArray still sees stale data. On Windows, C writing to `ptr()` buffers can corrupt Bun's heap entirely.

**Solution:** Allocate buffers in C as static arrays. Expose a pointer table to JS. Read values with `read.f32()`, `read.i32()`, etc.

```c
// C side: static event buffers
#define EV_MAX_MOVE 512
static int   g_evMoveBodyIdx[EV_MAX_MOVE];
static float g_evMovePosX[EV_MAX_MOVE];
static float g_evMovePosY[EV_MAX_MOVE];
static float g_evMoveAngle[EV_MAX_MOVE];

// Expose pointer table — JS reads this once at init
static void* g_evPtrs[20];
void* jove_World_GetEventPtrs(void) {
    g_evPtrs[0] = g_evMoveBodyIdx;
    g_evPtrs[1] = g_evMovePosX;
    g_evPtrs[2] = g_evMovePosY;
    g_evPtrs[3] = g_evMoveAngle;
    // ... more buffers ...
    return g_evPtrs;
}
```

```typescript
// JS side: read pointer table once at init
const ptrsBase = lib().jove_World_GetEventPtrs() as Pointer;
const movePosXPtr = read.ptr(ptrsBase, 1 * 8) as Pointer;
const movePosYPtr = read.ptr(ptrsBase, 2 * 8) as Pointer;

// After UpdateFull2, read C-side buffers directly
for (let i = 0; i < moveCount; i++) {
  body._cachedX = read.f32(movePosXPtr, i * 4);
  body._cachedY = read.f32(movePosYPtr, i * 4);
}
```

**For simple out-params** (1-2 values, not hot path), pre-allocated single-element buffers work:

```typescript
const _outA = new Float32Array(1);
const _outAPtr = ptr(_outA);
const _outB = new Float32Array(1);
const _outBPtr = ptr(_outB);

function getPosition(): [number, number] {
  lib().jove_Body_GetPosition(this._id, _outAPtr, _outBPtr);
  return [read.f32(_outAPtr, 0), read.f32(_outBPtr, 0)];
}
```

## 4. Never Cache `ptr()` for Buffers JS Writes To

**Problem:** After JS writes to a TypedArray, a previously-cached `ptr()` still points to Bun's old internal copy. C reads stale data.

**Solution:** Call `ptr(buf)` fresh after each JS write, immediately before passing to FFI.

```typescript
// BAD — ptr() cached before JS writes
const buf = new Float32Array(4);
const p = ptr(buf);    // points to bun's copy of [0,0,0,0]
buf[0] = 1.0;          // JS writes to buf, but bun's copy is still [0,0,0,0]
lib().doSomething(p);   // C sees [0,0,0,0] — stale!

// GOOD — fresh ptr() after JS writes
const buf = new Float32Array(4);
buf[0] = 1.0;
lib().doSomething(ptr(buf));  // fresh ptr() captures current state
```

Pre-allocating `ptr()` is only safe for **out-params** where C writes and JS reads via `read.*()`.

## 5. Never Use `ptr(buf.subarray(n))`

**Problem:** `subarray()` creates a new TypedArray view. `ptr()` on that view gives a pointer to Bun's copy of the subarray — not an offset into the original buffer.

**Solution:** Use separate single-element buffers for each out-param, or use byte offsets with `read.*()`.

```typescript
// BAD — subarray creates a new TypedArray, ptr() gives wrong address
const buf = new Float32Array(4);
const bufPtr = ptr(buf);
lib().getTwoValues(bufPtr, ptr(buf.subarray(1)));  // second ptr is WRONG

// GOOD — separate buffers
const outA = new Float32Array(1);
const outB = new Float32Array(1);
lib().getTwoValues(ptr(outA), ptr(outB));
const a = read.f32(ptr(outA), 0);
const b = read.f32(ptr(outB), 0);
```

## 6. Handle `null` Pointer Args on Windows

**Problem:** Passing `null` as a pointer argument in bun:ffi on Windows doesn't pass NULL to the C function. SDL receives garbage, causing subtle bugs (audio clicking/artifacts).

**Solution:** Pass a zero-filled buffer instead of `null`. Fall back to `null` for drivers that reject zero-filled specs (e.g. dummy driver in tests).

```typescript
// Zero-filled audio spec as null replacement
const _deviceSpec = new Uint8Array(64); // all zeros
const _deviceSpecPtr = ptr(_deviceSpec);

function _ensureDevice(): boolean {
  // Try zero-filled spec first (Windows null workaround)
  _deviceId = sdl.SDL_OpenAudioDevice(DEFAULT, _deviceSpecPtr);
  if (!_deviceId) {
    // Fall back to null for dummy driver
    _deviceId = sdl.SDL_OpenAudioDevice(DEFAULT, null);
  }
  return _deviceId !== 0;
}
```

## 7. Use `read.*()` for Event Struct Fields

**Problem:** SDL events are C structs written to a `ptr()` buffer. Reading fields via DataView or TypedArray on the JS-side ArrayBuffer sees stale data (same root cause as practice #3).

**Solution:** Always read struct fields with `read.u32()`, `read.f32()`, `read.i16()`, etc. at the correct byte offsets.

```typescript
const eventBuffer = new Uint8Array(128);
const eventPtr = ptr(eventBuffer);

// Poll event — C writes to eventPtr
sdl.SDL_PollEvent(eventPtr);

// Read struct fields with read.*() — never access eventBuffer directly
const eventType = read.u32(eventPtr, 0);
const scancode  = read.i32(eventPtr, 20);
const mouseX    = read.f32(eventPtr, 24);

// For embedded pointers (e.g. text input string)
const textPtr = read.ptr(eventPtr, 24);
const text = new CString(textPtr);
```

## Summary

| Practice | Problem | Fix |
|----------|---------|-----|
| Batch FFI calls | GC pressure + heap corruption at high volume | Combined C functions (650→1 call/frame) |
| Avoid `u64` returns | BigInt allocation bug under load | C-side ID arrays, JS uses `int` indices |
| C-side buffers | `ptr()` stale reads + Windows heap corruption | Static C arrays + `read.*()` |
| Fresh `ptr()` for in-params | Cached ptr sees old data after JS writes | Call `ptr(buf)` after each write |
| No `ptr(subarray)` | Subarray creates copy, not offset | Separate single-element buffers |
| No `null` on Windows | Garbage passed instead of NULL | Zero-filled buffer fallback |
| `read.*()` for structs | TypedArray sees stale event data | Always use `read.*()` at byte offsets |

These patterns eliminated all crashes and data corruption in jove2d. The engine now runs 36k+ frames (10 minutes) with zero leaks or stability issues, churning 3k physics bodies, 600 canvases, 300 images, and 120 audio sources.

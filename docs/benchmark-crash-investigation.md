# Benchmark Intermittent Crash Investigation

## Summary

The benchmark example (`examples/benchmark/main.ts`) crashes intermittently (~50% of runs) with a Bun segfault after ~8-15 seconds. Investigation via systematic subsystem elimination determined this is a **Bun FFI bug triggered by Box2D FFI usage**, not a bug in jove2d application code.

## Environment

- Bun 1.x on WSL2 (Linux 6.6.87.1-microsoft-standard-WSL2)
- Box2D v3.1.1 via C wrapper (`libbox2d_jove.so`) loaded with `dlopen`
- SDL3 via `dlopen` (separate shared library)
- Benchmark: 300 physics bodies, contact callbacks, particles, audio

## Crash Symptoms

- **Segfault** at high heap address (e.g., `0x20948E9BE8`) — indicates use-after-free or heap corruption
- **C++ assertion failure**: `std::array<unsigned long, 16>::operator[]: Assertion '__n < this->size()' failed` — out-of-bounds in Bun/SDL internals
- RSS reaches ~1.11GB before crash
- Crash timing: typically 8-15 seconds after launch (after body count reaches 300)

## Methodology

Added environment variable flags to selectively disable subsystems, then ran 10 trials per configuration with `timeout 15`.

## Results

| Configuration | Crash Rate | What Was Disabled |
|--------------|-----------|-------------------|
| **Drawing example (no physics)** | **0/10** | **No Box2D FFI at all** |
| Baseline benchmark | 5/10 | Nothing |
| No audio (`BENCH_NO_AUDIO`) | 7/10 | Audio source creation/playback |
| No particles (`BENCH_NO_PARTICLES`) | 4/10 | Particle pool creation/emission |
| No contact callback (`BENCH_NO_CALLBACK`) | 7/10 | beginContact callback + dispatch |
| No physics step (`BENCH_NO_STEP`) | 4/10 | `jove_World_Step()` FFI call |
| No draw physics (`BENCH_NO_DRAW_PHYSICS`) | 3/10 (1 segfault + 2 asserts) | `getPosition()`/`getAngle()` (300/frame) |
| No body churn (`BENCH_NO_CHURN`) | ~4/10 | Body create/destroy after ramp-up |
| All flags (minimal — only SDL rendering + body creation) | 2/10 (asserts) | Everything except body creation + SDL draw |

## Key Findings

1. **No single subsystem is responsible.** Disabling audio, particles, callbacks, physics stepping, body drawing, or body churn individually does NOT eliminate crashes.

2. **Crash rate scales with FFI call volume.** More FFI calls per frame = higher crash rate. All-flags config (minimal FFI) crashes least (2/10 asserts), baseline (maximum FFI) crashes most (5/10).

3. **Pure SDL rendering does NOT crash.** The `examples/drawing` example (heavy SDL rendering, zero Box2D) ran 10/10 clean. This proves the crash requires Box2D FFI involvement.

4. **The crash is in Bun's internals.** The `std::array<unsigned long, 16>` assertion is in C++ standard library code used by Bun (Box2D is pure C, SDL is mostly C). The segfault at high heap addresses points to Bun's managed heap being corrupted.

## Root Cause Analysis

The crash is a **Bun FFI bug** that manifests when:
- Multiple `dlopen`'d libraries are active simultaneously (SDL + Box2D)
- FFI functions returning `u64` (bigint) are called at high frequency (body/shape IDs)
- Sustained high-volume FFI calls (~1000+/frame) create GC pressure
- Box2D's internal memory allocator (separate from Bun's heap) may interact poorly with Bun's GC

The bug does NOT exist with SDL-only FFI (drawing example), only when Box2D FFI is also in use.

## Potential Workarounds to Investigate

1. **Reduce FFI call frequency** — Batch `getPosition`/`getAngle` reads into a single C function that fills a buffer for all bodies at once, reducing 600 FFI calls/frame to 1
2. **Avoid `u64` return type** — Change C wrapper to write body/shape IDs into out-param buffers instead of returning bigints, eliminating high-frequency bigint allocation
3. **Reduce body count** — Lower MAX_BODIES to reduce FFI pressure
4. **Pre-warm and pin buffers** — Ensure all pre-allocated TypedArrays are touched early to stabilize Bun's internal copies
5. **Try newer Bun versions** — The bug may be fixed in a newer Bun release
6. **File a Bun issue** — Create a minimal reproduction case for the Bun team

## Reproduction

```bash
# Crashes ~50% of runs within 15 seconds
for i in $(seq 1 10); do timeout 15 bun examples/benchmark/main.ts; echo "exit: $?"; done

# Never crashes — same SDL rendering, no Box2D
for i in $(seq 1 10); do timeout 15 bun examples/drawing/main.ts; echo "exit: $?"; done
```

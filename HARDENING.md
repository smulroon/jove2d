# Hardening Status

Stability and release-readiness tracking for jove2d. For feature status see `PRIORITIES.md`.

## Stability Baseline

**Soak test** (`tools/soak-test.ts`): 10 minutes, 36k frames, 60 FPS steady, zero memory leaks.
- Resource churn: 3k bodies, 600 canvases, 300 images, 120 audio sources created and destroyed
- Leak detection: linear regression on RSS and heap (fail thresholds: 1 MB/min RSS, 2 MB/min heap, r² > 0.7)
- FPS degradation: first vs. last quartile comparison (fail threshold: > 15% drop)

**Test suite**: 689 tests across 30 files, all passing (17 skip for optional libs).
Run headless via `SDL_VIDEODRIVER=dummy bun test`.

**Visual verification**: 27/27 examples verified against love2d (including joystick on Windows).

## Completed Hardening

Critical fixes already shipped, roughly ordered by severity:

1. **Benchmark crash (Bun FFI u64 bug)** — Segfault at ~50% rate under high FFI volume. Fixed by moving body/shape IDs to C-side static arrays (JS uses `int` indices, not `u64` BigInt) and combining 650 FFI calls/frame into 1 (`jove_World_UpdateFull2`). See `docs/benchmark-crash-investigation.md`.

2. **Windows `ptr()` heap corruption** — C writing to `ptr()` buffers corrupted Bun's heap on Windows (silent crash after seconds). Fixed by allocating buffers in C as static arrays and reading via `read.*()` from JS.

3. **Windows `null` pointer mishandling** — `null` FFI args on Windows passed garbage to SDL. Fixed with zero-filled spec pointer for audio device opening.

4. **bun:ffi `ptr()` stale data (both directions)** — C→JS: TypedArray sees stale data after C writes. JS→C: cached `ptr()` points to old copy after JS writes. Fixed by using `read.*()` for C→JS and calling `ptr()` fresh for JS→C.

5. **SDL3 pixel format constants** — `ARGB8888`/`RGBA8888` values were swapped. Corrected from `SDL_pixels.h`. Video surfaces use `ABGR8888` (byte-order RGBA on little-endian).

6. **WSL2 Wayland hang** — `SDL_Init(SDL_INIT_VIDEO)` hangs with default Wayland driver. Auto-detected via `/proc/version`, forces `SDL_VIDEODRIVER=x11`.

7. **ALSA audio hang** — `SDL_OpenAudioDevice` hangs with no ALSA device. Fixed by lazy device opening (deferred to first `newSource()` call).

8. **Box2D force/torque scaling** — Forces were 30x too strong, torques 900x. Applied `/meter` and `/meter²` scaling at API boundary to match love2d.

9. **Box2D motor setter wake fix** — Box2D v3 doesn't auto-wake bodies on motor property changes (unlike v2). All motor setters now call `_wake()` on both bodies.

10. **Graceful degradation** — All 5 optional native libs (SDL_ttf, SDL_image, Box2D, audio_decode, pl_mpeg) use lazy `dlopen` with try/catch. Engine works without any of them.

11. **GPU renderer dummy driver crash** — `SDL_CreateGPURenderer` segfaults with `SDL_VIDEODRIVER=dummy`. Skipped in dummy mode, falls back to regular renderer.

## Next Steps

### Quick wins (< 1 day each)

- [x] ~~Add CI test job~~ — `.github/workflows/ci.yml` runs tests on push/PR
- [x] ~~Add `bun run soak` script~~ — `bun run soak` runs 30s quick soak
- [x] ~~Type-check pass~~ — `bun run typecheck` added; ~570 strictness errors (mostly `noUncheckedIndexedAccess`), not bugs — progressive cleanup tracked as medium effort

### Medium effort (1-3 days)

- [ ] Windows native testing (run tests + examples on real Windows with Bun)
- [ ] Visual regression automation (screenshot comparison tool exists at `tools/compare-images.ts`)
- [ ] Fix ~570 TypeScript strictness errors (`bun run typecheck`) — mostly `noUncheckedIndexedAccess` array access and `Pointer` type narrowing, not runtime bugs
- [x] ~~Verify remaining 15 examples against love2d~~ — all 27 verified
- [x] ~~Joystick testing with real hardware~~ — tested on Windows

### Larger items

- [ ] macOS support (build scripts + CI for arm64/x64)
- [ ] Fuzz/edge-case testing (rapid window resize, audio device hotplug, zero-size canvases)
- [ ] CHANGELOG.md for curated release notes

## Known Limitations

These are by-design or upstream constraints, not bugs to fix:

- **Fragment shaders only** — no vertex/compute shaders (SDL3 2D renderer limitation)
- **No 3D/positional audio** — no SDL3 spatial audio API
- **No touch/sensor modules** — mobile-only, not planned
- **GPU renderer ~2x slower on WSLg** — Vulkan sync overhead in `SDL_RenderPresent`; use `JOVE_NO_GPU=1`
- **Bun FFI `u64` BigInt instability at extreme volume** — mitigated for bodies/shapes; joints still use BigInt but are not in hot path
- **`preSolve` contacts default-disabled on first frame** — by design for one-way platform support; JS sends enable list next frame
- **`newShader` is async** — SPIR-V compilation uses CLI subprocess (love2d's is sync)

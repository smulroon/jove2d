# jove2d Feature Priorities

Comparison of love2d modules/features against jove2d's current implementation.
Grouped by priority based on impact for typical 2D game development.

---

## Module Completeness

| love2d module | jove2d coverage | Notes |
|---|---|---|
| love.timer | **6/6 Complete** | All functions implemented |
| love.event | **4/6 Complete** | Missing `pump` (internal), `wait` (rarely used) |
| love.keyboard | **7/9 Complete** | Missing `hasScreenKeyboard` (mobile-only) |
| love.system | **6/8 Complete** | Missing `hasBackgroundMusic`, `vibrate` (mobile-only) |
| love.mouse | **18/18 Complete** | All functions implemented |
| love.math | **16/16 Complete** | All functions implemented |
| love.window | **31/36 Mostly done** | Missing icon set/get, display orientation, safe area, sleep control |
| love.filesystem | **11/31 Core done** | Missing mount/unmount, File objects; many gaps are Lua-specific |
| love.graphics | **~40/97 Core done** | Primitives/transforms done; missing shaders, batching, mesh, particles |
| love.audio | **3/26 Minimal** | WAV playback only; no global controls, effects, or positional audio |

---

## Module Gaps (existing modules)

### love.window — missing functions

**Done:**
- ~~`getVSync` / `setVSync`~~ — VSync control
- ~~`getDisplayCount`~~ — number of monitors
- ~~`getDisplayName`~~ — monitor name string
- ~~`getFullscreenModes`~~ — available resolutions list
- ~~`fromPixels` / `toPixels`~~ — DPI coordinate conversion
- ~~`hasMouseFocus`~~ — mouse-in-window check
- ~~`showMessageBox`~~ — native dialog box
- ~~`requestAttention`~~ — flash taskbar
- ~~`updateMode`~~ — resize without recreating window

**Should add:**
- `setIcon` / `getIcon` — window icon from ImageData (FFI binding exists, needs ImageData type)

**Low priority (mobile/niche):**
- `getDisplayOrientation` — mobile-only
- `getSafeArea` — mobile-only
- `isDisplaySleepEnabled` / `setDisplaySleepEnabled` — screen sleep

### love.graphics — missing functions

**Done:**
- ~~`setDefaultFilter` / `getDefaultFilter`~~ — default texture filtering
- ~~`transformPoint` / `inverseTransformPoint`~~ — coordinate transforms
- ~~`intersectScissor`~~ — scissor intersection
- ~~`getStackDepth`~~ — transform stack depth
- ~~`reset`~~ — reset all graphics state to defaults
- ~~`setColorMask` / `getColorMask`~~ — JS-side state tracking only (see note below)

**P1 — Needed for most games:**
- `newShader` / `setShader` / `getShader` / `validateShader` — custom rendering
- `newSpriteBatch` / `flushBatch` — batch rendering performance
- `setColorMask` / `getColorMask` (GPU-enforced) — currently JS-side tracking only; SDL3 lacks `SDL_SetRenderColorWriteMask`. Needs shader-based workaround or future SDL3 API.

**P2 — Important for many games:**
- `newParticleSystem` — particle effects
- `newMesh` — custom vertex geometry
- `newText` — cached text object
- `setStencilTest` / `stencil` — stencil buffer operations
- `applyTransform` / `replaceTransform` — apply Transform object to stack

**P3 — Useful for specific cases:**
- `setLineJoin` / `getLineJoin` — miter/bevel/none line joins
- ~~`setLineStyle` / `getLineStyle`~~ — rough/smooth line style
- `getDPIScale` / `getPixelDimensions` / `getPixelHeight` / `getPixelWidth` — HiDPI pixel queries
- `getRendererInfo` / `getStats` / `getSupported` / `getSystemLimits` — info/capability queries
- `getCanvasFormats` / `getImageFormats` / `getTextureTypes` — format queries
- `isActive` / `isGammaCorrect` — state queries
- `drawInstanced` / `drawLayer` — advanced drawing
- `setWireframe` / `isWireframe` — wireframe mode
- `setDepthMode` / `getDepthMode` — depth testing
- `setMeshCullMode` / `getMeshCullMode` — face culling
- `setFrontFaceWinding` / `getFrontFaceWinding` — winding order
- `present` / `discard` — manual frame control

**Not applicable:**
- `newVideo` — needs video decoder library (P4)
- `newArrayImage` / `newCubeImage` — advanced texture types (P4)

### ~~love.mouse — missing functions~~ DONE

~~**Should add:**~~
- ~~`newCursor` — create cursor from ImageData~~
- ~~`setCursor` / `getCursor` — set/get active cursor~~
- ~~`getSystemCursor` — system cursor types (hand, crosshair, resize, etc.)~~
- ~~`isCursorSupported` — trivial check (always true on desktop)~~
- ~~`setX` / `setY` — set individual coordinates (trivial wrappers)~~

### ~~love.math — missing functions~~ DONE

~~**Should add:**~~
- ~~`colorFromBytes` / `colorToBytes` — convert 0-255 to 0-1 and back~~
- ~~`newBezierCurve` — bezier curve object (evaluate, render, getDerivative)~~
- ~~`getRandomState` / `setRandomState` — RNG state serialization for replays~~

### love.filesystem — missing functions

**Should add (useful):**
- `getWorkingDirectory` — current working directory
- `getUserDirectory` — home directory path
- `getAppdataDirectory` — app data path
- `mount` / `unmount` — virtual filesystem / zip archive support
- `newFile` / `newFileData` — file handle objects with streaming reads

**Lua-specific (skip):**
- `load` — load Lua chunk (N/A for TypeScript)
- `getRequirePath` / `setRequirePath` / `getCRequirePath` / `setCRequirePath` — Lua module paths
- `getSource` / `setSource` — Lua game source
- `isFused` — fused executable check
- `getRealDirectory` — resolve mount point (only useful with mount)
- `areSymlinksEnabled` / `setSymlinksEnabled` — symlink security policy

### love.audio — missing functions

**Should add (core):**
- `pause()` / `play()` / `stop()` — global pause/play/stop all sources
- `getActiveSourceCount` — count playing sources
- Pitch shifting on Source — currently stored but not applied
- Proper seek/tell on Source — currently simplified

**P2 (format support):**
- OGG/MP3/FLAC decoding — needs SDL_mixer or similar
- `newQueueableSource` — streaming procedural audio

**P3 (positional/effects):**
- `setPosition` / `getPosition` / `setOrientation` / `getOrientation` — 3D listener
- `setVelocity` / `getVelocity` / `setDistanceModel` / `setDopplerScale` — spatial audio
- `setEffect` / `getEffect` / `getActiveEffects` — audio effects (reverb, echo)
- `getMaxSceneEffects` / `getMaxSourceEffects` / `isEffectsSupported` — effect caps

**Skip:**
- `getRecordingDevices` — microphone input (niche)
- `setMixWithSystem` — iOS-only

### love.event — missing functions

- `pump` — manual event pump (jove uses `pollEvents` internally; not needed)
- `wait` — block until event (rarely used)

### love.keyboard — missing functions

- `hasScreenKeyboard` — mobile-only, skip

### love.system — missing functions

- `hasBackgroundMusic` — iOS-only, skip
- `vibrate` — mobile-only, skip

---

## New Modules (not yet implemented)

### Priority 1 — High Impact

#### ~~Image format support (PNG/JPG via SDL_image)~~ DONE
- ~~**Current**: BMP only via `SDL_LoadBMP`~~
- **Implemented**: PNG, JPG, GIF, WebP, SVG, QOI loading via SDL_image
- `ffi_image.ts` with lazy dlopen, graceful fallback to BMP-only
- `bun run build-sdl_image` to build from source

### Priority 2 — Important for Many Games

#### love.data
- **Current**: Not implemented
- **Needed**: `compress`/`decompress`, `encode`/`decode` (base64, hex), `hash`, ByteData
- **Approach**: Use Bun's built-in Buffer/crypto APIs
- **Why P2**: Save file compression, network data encoding, asset hashing.

### Priority 3 — Useful for Specific Game Types

#### love.physics (Box2D)
- **Current**: Not implemented
- **Needed**: World, Body, Fixture, Shape (circle/polygon/edge/chain), Joints, collision callbacks
- **Approach**: Bind Box2D via FFI, or use a WASM port
- **Why P3**: Only needed for physics-based games. Many 2D games don't use it.

#### Joystick / Gamepad (love.joystick)
- **Current**: Not implemented
- **Needed**: Gamepad detection, button/axis reading, vibration
- **Approach**: SDL3 gamepad API bindings (already in SDL3)
- **Why P3**: Important for console-style games, but keyboard/mouse covers most cases.

#### love.sound / love.image (data-level APIs)
- **Current**: Not implemented as separate modules
- **Needed**: SoundData, ImageData manipulation (pixel get/set), encoding
- **Approach**: Buffer-based implementations
- **Why P3**: Mostly used for procedural content generation.

### Priority 4 — Niche / Advanced

#### love.thread
- **Current**: Not implemented
- **Needed**: Worker threads, channels for message passing
- **Approach**: Bun workers / Web Workers API
- **Why P4**: Rarely needed in 2D games. Bun's async is usually sufficient.

#### love.touch
- **Current**: Not implemented
- **Needed**: Multi-touch support (finger tracking, gestures)
- **Approach**: SDL3 touch events
- **Why P4**: Only relevant for touch-screen targets.

#### love.video
- **Current**: Not implemented
- **Needed**: Theora video playback as drawable
- **Approach**: Would need a video decoder library
- **Why P4**: Rarely used. Most games use sprite animations.

#### love.font (standalone module)
- **Current**: Font functionality is in graphics module
- **Needed**: Separate module for GlyphData, Rasterizer access
- **Approach**: Low priority — current Font API covers 99% of use cases
- **Why P4**: Only needed for advanced text rendering (bitmap fonts, SDF).

---

## Not Planned

| Feature | Reason |
|---|---|
| love.graphics.newShader (compute) | SDL3 compute shaders are experimental |
| love.sensor | Mobile-only (accelerometer, gyroscope) |
| love.system.vibrate | Mobile-only |
| love.system.hasBackgroundMusic | iOS-only |
| love.keyboard.hasScreenKeyboard | Mobile-only |
| love.filesystem Lua-specific funcs | load, require paths, isFused — N/A for TypeScript |

---

## Implementation Order Suggestion

1. ~~**SDL_image**~~ DONE
2. ~~**Window gaps**~~ DONE — vsync, display info, pixel density, message box, flash, updateMode
3. ~~**Graphics quick wins**~~ DONE — defaultFilter, transformPoint, inverseTransformPoint, intersectScissor, getStackDepth, reset (colorMask is JS-side tracking only)
4. ~~**Mouse cursors**~~ DONE — newCursor, system cursors, setX/setY, isCursorSupported
5. ~~**Math gaps**~~ DONE — colorFromBytes/colorToBytes, BezierCurve, getRandomState/setRandomState
6. **SpriteBatch** — performance for tile maps and particle systems
7. **Shaders** — visual effects (depends on SDL3 GPU API investigation)
8. **ParticleSystem** — depends on SpriteBatch
9. **Audio improvements** — global controls, pitch, OGG/MP3 via SDL_mixer
10. **Mesh** — custom geometry
11. **Stencil** — masking operations
12. **love.data** — compression/encoding utilities
13. **Filesystem gaps** — mount/unmount, File objects
14. **Joystick** — gamepad support
15. **Physics** — Box2D integration

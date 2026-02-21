# jove2d Feature Priorities

Comparison of love2d modules/features against jove2d's current implementation.
Grouped by priority based on impact for typical 2D game development.

---

## Module Completeness

| love2d module | jove2d coverage | Notes |
|---|---|---|
| love.timer | **6/6 Complete** | All functions implemented |
| love.mouse | **18/18 Complete** | All functions implemented |
| love.math | **16/16 Complete** | All functions implemented |
| love.data | **5/5 Complete** | compress/decompress, encode/decode, hash, ByteData |
| love.joystick | **~16/17 Complete** | Full gamepad support, vibration, hot-plug; needs real device testing |
| love.event | **4/6 Complete** | Missing `pump` (internal), `wait` (rarely used) |
| love.keyboard | **7/9 Complete** | Missing `hasScreenKeyboard` (mobile-only) |
| love.window | **33/36 Mostly done** | Missing display orientation, safe area, sleep control (all mobile/niche) |
| love.system | **6/8 Complete** | Missing `hasBackgroundMusic`, `vibrate` (mobile-only) |
| love.physics | **~90/93 Mostly done** | Box2D v3.1.1; World/Body/Fixture/7 joint types/queries/contacts/preSolve/all getters; gear/pulley N/A in v3 |
| love.graphics | **~81/97 Core done** | Primitives/transforms/shaders/batching/mesh/stencil/newText/applyTransform/DPI+stats/bitmap fonts done |
| love.filesystem | **19/31 Mostly done** | Core functions done; remaining gaps are Lua-specific |
| love.audio | **17/26 Core done** | WAV/OGG/MP3/FLAC playback, global controls, pitch, looping, seek/tell, clone, newQueueableSource; no effects or positional audio |
| love.touch | **Not implemented** | Mobile-only (P4) |
| love.thread | **Not implemented** | Bun async usually sufficient (P4) |
| love.video | **Not implemented** | Needs video decoder (P4) |
| love.sound | **2/2 Complete** | SoundData (newSoundData, getSample/setSample, from file) |
| love.image | **7/7 Complete** | newImageData, getPixel/setPixel, mapPixel, paste, encode, getString |
| love.font | **Inline** | Integrated into graphics module; bitmap fonts via newImageFont |
| love.sensor | **Not planned** | Mobile-only |

**Summary: 15/20 modules implemented, 9 at 100%, 12 at 75%+**

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
- ~~`setIcon` / `getIcon`~~ — window icon from ImageData

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
- ~~`newShader` / `setShader` / `getShader`~~ — custom fragment shaders via SDL_GPURenderState DONE
- ~~`newSpriteBatch` / `flushBatch`~~ — batch rendering performance DONE
- `setColorMask` / `getColorMask` (GPU-enforced) — currently JS-side tracking only; SDL3 lacks `SDL_SetRenderColorWriteMask`. Needs shader-based workaround or future SDL3 API.

**P2 — Important for many games:**
- ~~`newParticleSystem`~~ DONE — particle effects (in particles.ts)
- ~~`newMesh`~~ DONE — custom vertex geometry (fan/strip/triangles/points, vertex map, textured/untextured)
- ~~`newText`~~ DONE — cached text object (render-to-canvas, segment-based, full transform support)
- ~~`setStencilTest` / `stencil`~~ DONE — stencil masking via canvas-based simulation (binary mask)
- ~~`applyTransform` / `replaceTransform`~~ DONE — apply Transform object to stack

**P3 — Useful for specific cases:**
- ~~`setLineJoin` / `getLineJoin`~~ — miter/bevel/none line joins DONE
- ~~`setLineStyle` / `getLineStyle`~~ — rough/smooth line style
- ~~`getDPIScale` / `getPixelDimensions` / `getPixelHeight` / `getPixelWidth`~~ — HiDPI pixel queries DONE
- ~~`getRendererInfo` / `getStats`~~ — renderer info and per-frame draw stats DONE
- `getSupported` / `getSystemLimits` — capability queries
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

### ~~love.math — missing functions~~ DONE

### ~~love.filesystem — missing functions~~ DONE

**Lua-specific (skip):**
- `load` — load Lua chunk (N/A for TypeScript)
- `getRequirePath` / `setRequirePath` / `getCRequirePath` / `setCRequirePath` — Lua module paths
- `getSource` / `setSource` — Lua game source
- `isFused` — fused executable check
- `getRealDirectory` — resolve mount point (only useful with mount)
- `areSymlinksEnabled` / `setSymlinksEnabled` — symlink security policy

### love.audio — missing functions

**Done:**
- ~~`pause()` / `play()` / `stop()`~~ — global pause/play/stop all sources
- ~~`getActiveSourceCount`~~ — count playing sources
- ~~Pitch shifting on Source~~ — via SDL_SetAudioStreamFrequencyRatio
- ~~Proper seek/tell on Source~~ — byte-offset math on static source buffer
- ~~`getDuration()`~~ — audio length in seconds
- ~~`clone()`~~ — copy source sharing audio data
- ~~`type()`~~ — source type method (love2d compat)
- ~~`isStopped()` / `isPaused()`~~ — state queries
- ~~Looping~~ — poll SDL_GetAudioStreamAvailable, re-queue when empty
- ~~Master volume propagation~~ — setVolume iterates all sources
- ~~Auto-stop finished sources~~ — _updateSources per frame

**P2 (format support):**
- ~~OGG/MP3/FLAC decoding~~ DONE — via stb_vorbis + dr_mp3 + dr_flac (libaudio_decode.so)
- ~~`newQueueableSource`~~ DONE — streaming procedural audio via SDL audio streams + SoundData

**Not planned:**
- `setPosition` / `getPosition` / `setOrientation` / `getOrientation` — 3D listener (needs OpenAL or custom mixing)
- `setVelocity` / `getVelocity` / `setDistanceModel` / `setDopplerScale` — spatial audio (needs OpenAL or custom mixing)
- `setEffect` / `getEffect` / `getActiveEffects` — audio effects (needs DSP or OpenAL)
- `getMaxSceneEffects` / `getMaxSourceEffects` / `isEffectsSupported` — effect caps
- `getRecordingDevices` — microphone input (niche)
- `setMixWithSystem` — iOS-only

### love.physics — missing functions

**Done:**
- ~~World create/destroy, gravity, step, body count, getBodies~~ — core world management
- ~~Body position/angle/velocity, forces/impulses/torque~~ — full body dynamics
- ~~Body type (static/dynamic/kinematic), bullet, active, awake, fixedRotation~~ — body properties
- ~~Body gravityScale, linearDamping, angularDamping, sleepingAllowed~~ — advanced body properties
- ~~Body getMass, getMassData, getInertia, world/local point conversion~~ — mass and coordinate queries
- ~~Circle, box, polygon, edge, chain shapes~~ — all shape types
- ~~Fixture density/friction/restitution/sensor/filter~~ — fixture properties
- ~~Distance, revolute, prismatic, weld, mouse joints~~ — 5 joint types
- ~~Wheel, motor joints~~ — 2 additional joint types (Phase 2)
- ~~Joint anchors, reaction force/torque~~ — joint query methods (Phase 2)
- ~~`Body:setMassData`~~ — override mass properties (Phase 2)
- ~~Contact positions/impulses in postSolve~~ — hit event point + approach speed (Phase 2)
- ~~beginContact, endContact, postSolve, preSolve callbacks~~ — contact event dispatch
- ~~AABB query, ray cast~~ — world queries
- ~~Meter scaling (setMeter/getMeter)~~ — pixel↔meter conversion

**Remaining gaps:**
- ~~preSolve callback~~ DONE — 1-frame-delay enable-list pattern (C records events, JS decides, sends enable list next frame)
- Gear/pulley/rope/friction joints — do NOT exist in Box2D v3 (only distance/revolute/prismatic/weld/mouse/wheel/motor/filter)
- WASM fallback backend

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

### ~~Priority 1 — High Impact~~ DONE

#### ~~Image format support (PNG/JPG via SDL_image)~~ DONE
- **Implemented**: PNG, JPG, GIF, WebP, SVG, QOI loading via SDL_image
- `ffi_image.ts` with lazy dlopen, graceful fallback to BMP-only
- `bun run build-sdl_image` to build from source

### ~~Priority 2 — Important for Many Games~~ DONE

#### ~~love.data~~ DONE
- **Implemented**: `compress`/`decompress` (zlib, gzip, deflate), `encode`/`decode` (base64, hex), `hash` (md5, sha1, sha224, sha256, sha384, sha512), `ByteData`
- Uses Bun's built-in zlib, Buffer, and CryptoHasher APIs — no external dependencies

### Priority 3 — Useful for Specific Game Types

#### ~~love.physics (Box2D)~~ DONE
- **Implemented**: Box2D v3.1.1 via thin C wrapper (`box2d_jove.c`) for bun:ffi struct compatibility
- World, Body, Fixture (wraps b2ShapeId), Shape, 7 Joint types (distance/revolute/prismatic/weld/mouse/wheel/motor), Contact
- Contact events (beginContact, endContact, postSolve via hit events with point + approach speed, preSolve with 1-frame-delay enable-list)
- Joint anchors, reaction force/torque; Body.setMassData
- AABB query, ray cast
- Meter scaling (default 30px/m, matching love2d)
- `bun run build-box2d` to build from source

#### ~~Joystick / Gamepad (love.joystick)~~ DONE
- **Implemented**: Joystick detection, axes/buttons/hats, gamepad mapping (standard button/axis names), vibration, hot-plug events
- `joystick.ts` with Joystick object (getAxis, isDown, getHat, isGamepad, getGamepadAxis, isGamepadDown, setVibration)
- Module functions: getJoysticks, getJoystickCount
- Full event dispatch: joystickadded/removed, joystickpressed/released, joystickaxis, joystickhat, gamepadpressed/released, gamepadaxis

#### ~~love.image~~ DONE
- **Implemented**: `newImageData(w, h)` / `newImageData(filepath)`, getPixel/setPixel, mapPixel, paste, encode (PNG/BMP), getString
- `newImage(imageData)` creates GPU texture from ImageData
- Buffer-based RGBA8888 implementation, no external dependencies

#### love.sound (data-level audio APIs) — DONE
- **Implemented**: SoundData with getSample/setSample (normalized -1..1), newSoundData from empty buffer or file
- **Pairs with**: newQueueableSource for procedural audio generation

### Not Planned

#### love.thread
- Bun's async I/O covers most use cases (asset loading, network). For CPU-bound work, Bun Workers provide real OS threads + SharedArrayBuffer — superior to love.thread's serialized Lua channels.

#### love.touch
- Mobile-only. SDL3 has touch events if needed in the future.

#### love.video
- **Queued as #35** — video playback as drawable (intro videos, cutscenes, visual novels, FMV games). FFmpeg or platform codec via C wrapper; render frames as textures.

#### love.font (standalone module)
- Font functionality is integrated into graphics module; bitmap fonts supported via `newImageFont`. Current Font API covers 99% of use cases.

#### Positional/3D audio
- SDL3 has no spatial audio API. Would need OpenAL integration or custom mixing layer. High effort, low demand for 2D games.

#### Audio effects
- Reverb, echo, filters. Would need DSP implementation or OpenAL. High effort.

---

## Not Planned (table)

| Feature | Reason |
|---|---|
| love.graphics.newShader (compute/vertex) | Only fragment shaders supported via SDL_GPURenderState; compute/vertex require full GPU pipeline |
| love.thread | Bun async/Workers cover this — real OS threads + SharedArrayBuffer |
| love.touch | Mobile-only |
| love.sensor | Mobile-only (accelerometer, gyroscope) |
| Positional/3D audio | SDL3 has no spatial audio API; needs OpenAL or custom mixer |
| Audio effects (reverb, echo, filters) | Needs DSP implementation or OpenAL |
| love.font (standalone) | Integrated into graphics module; current API covers 99% of use cases |
| love.system.vibrate | Mobile-only |
| love.system.hasBackgroundMusic | iOS-only |
| love.keyboard.hasScreenKeyboard | Mobile-only |
| love.filesystem Lua-specific funcs | load, require paths, isFused — N/A for TypeScript |

---

## Implementation Order

### Completed

1. ~~**SDL_image**~~ DONE
2. ~~**Window gaps**~~ DONE — vsync, display info, pixel density, message box, flash, updateMode
3. ~~**Graphics quick wins**~~ DONE — defaultFilter, transformPoint, inverseTransformPoint, intersectScissor, getStackDepth, reset (colorMask is JS-side tracking only)
4. ~~**Mouse cursors**~~ DONE — newCursor, system cursors, setX/setY, isCursorSupported
5. ~~**Math gaps**~~ DONE — colorFromBytes/colorToBytes, BezierCurve, getRandomState/setRandomState
6. ~~**SpriteBatch**~~ DONE — performance for tile maps and particle systems
7. ~~**Shaders**~~ DONE — custom fragment shaders via SDL_GPURenderState + SPIR-V compilation
8. ~~**ParticleSystem**~~ DONE — SoA layout, compact-swap pool, full love2d API (~50 methods)
9. ~~**Audio improvements**~~ DONE — global controls, pitch, looping, seek/tell, clone, getDuration
10. ~~**Mesh**~~ DONE — custom vertex geometry (fan/strip/triangles/points, vertex map, textured/untextured)
11. ~~**Stencil**~~ DONE — canvas-based stencil simulation with custom blend modes (binary mask)
12. ~~**love.data**~~ DONE — compression/encoding utilities
13. ~~**Filesystem gaps**~~ DONE — directory queries, mount/unmount, File handle, FileData
14. ~~**Joystick**~~ DONE — gamepad support via SDL3 joystick/gamepad API
15. ~~**Physics**~~ DONE — Box2D v3.1.1 integration via C wrapper
16. ~~**Audio codecs**~~ DONE — OGG/MP3/FLAC via stb_vorbis + dr_mp3 + dr_flac
17. ~~**love.graphics newText**~~ DONE — cached text object (render-to-canvas with segment colors)
18. ~~**love.graphics applyTransform**~~ DONE — apply/replace Transform object on stack
19. ~~**love.image**~~ DONE — ImageData pixel manipulation (getPixel/setPixel/mapPixel/paste/encode)
20. ~~**Physics Phase 2**~~ DONE — wheel/motor joints, joint anchors/reactions, Body.setMassData, contact point/speed
21. ~~**window.setIcon/getIcon**~~ DONE — window icon from ImageData

### Next Up

**Quick wins:**
22. ~~**Graphics DPI/info queries**~~ DONE — getDPIScale, getPixelDimensions, getPixelWidth, getPixelHeight, getRendererInfo, getStats
23. ~~**setLineJoin / getLineJoin**~~ DONE — miter/bevel/none line join styles
24. ~~**preSolve callback**~~ DONE — 1-frame-delay enable-list pattern, Contact.setEnabled, one-way platforms
25. ~~**Bitmap font support**~~ DONE — newImageFont with separator-color glyph detection, pixel-art font rendering

26. ~~**Error recovery**~~ DONE — blue error screen for load/update/draw/event failures, setErrorHandler override, clipboard copy

**Real game value:**
27. ~~**newQueueableSource**~~ DONE — streaming/procedural audio via SDL audio streams
28. ~~**love.sound (SoundData/Decoder)**~~ DONE — sample-level get/set for procedural audio, pairs with newQueueableSource
29. ~~**Physics Phase 3**~~ DONE — joint getters (revolute/prismatic/wheel/motor/distance/weld/mouse), Body applyAngularImpulse + getWorldVector/getLocalVector, Fixture testPoint, World getJoints/getJointCount
30. ~~**textedited event**~~ DONE — IME composition (SDL_EVENT_TEXT_EDITING) for CJK input, dispatches to textedited(text, start, length) callback
31. **Graphics capability queries** — getSupported, getSystemLimits, getCanvasFormats, isGammaCorrect (mostly static returns)
32. **love.video** — video playback as drawable (intro videos, visual novels, FMV games). Needs video decoder library (FFmpeg or platform codec)

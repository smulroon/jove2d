# jove2d Feature Priorities

Comparison of love2d modules/features against jove2d's current implementation.
All 42 priorities completed. jove2d is feature complete.

---

## Module Completeness

| love2d module | jove2d coverage | Notes |
|---|---|---|
| love.timer | **6/6 Complete** | All functions implemented |
| love.mouse | **18/18 Complete** | All functions implemented |
| love.math | **16/16 Complete** | All functions implemented |
| love.data | **5/5 Complete** | compress/decompress, encode/decode, hash, ByteData |
| love.joystick | **~16/17 Complete** | Full gamepad support, vibration, hot-plug |
| love.event | **6/6 Complete** | All functions implemented (poll, push, clear, quit, wait) |
| love.keyboard | **7/7 Complete** | Missing `hasScreenKeyboard` (mobile-only, N/A) |
| love.window | **34/36 Complete** | Missing display orientation, safe area (mobile-only, N/A) |
| love.system | **6/6 Complete** | Missing `hasBackgroundMusic`, `vibrate` (mobile-only, N/A) |
| love.physics | **~93/93 Complete** | Box2D v3.1.1; World/Body/Fixture/7 joint types/queries/contacts/preSolve/all getters+setters; gear/pulley N/A in v3 |
| love.graphics | **~90/97 Complete** | Primitives/transforms/shaders/batching/mesh/stencil/newText/bitmap fonts/capability queries/wrap mode/replacePixels done |
| love.filesystem | **19/31 Complete** | Core functions done; remaining gaps are Lua-specific (N/A) |
| love.audio | **18/26 Complete** | WAV/OGG/MP3/FLAC playback, global controls, pitch, looping, seek/tell, clone, newQueueableSource, stream type; positional/effects not planned |
| love.touch | **Not planned** | Mobile-only |
| love.thread | **Not planned** | Bun async/Workers sufficient |
| love.video | **Complete** | MPEG-1 video+audio playback via pl_mpeg, drawable, seek/loop |
| love.sound | **3/3 Complete** | SoundData + newDecoder (streaming audio decode) |
| love.image | **8/8 Complete** | newImageData, getPixel/setPixel, mapPixel, paste, encode, getString, getFormat |
| love.font | **Inline** | Integrated into graphics module; bitmap fonts via newImageFont |
| love.sensor | **Not planned** | Mobile-only |

**Summary: 16/20 modules implemented, 12 at 100%. All desktop-relevant features complete.**

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
- ~~`isDisplaySleepEnabled` / `setDisplaySleepEnabled`~~ — via SDL3 screensaver API

**Not applicable (mobile-only):**
- `getDisplayOrientation` — mobile-only
- `getSafeArea` — mobile-only

### love.graphics — missing functions

**Done:**
- ~~`setDefaultFilter` / `getDefaultFilter`~~ — default texture filtering
- ~~`transformPoint` / `inverseTransformPoint`~~ — coordinate transforms
- ~~`intersectScissor`~~ — scissor intersection
- ~~`getStackDepth`~~ — transform stack depth
- ~~`reset`~~ — reset all graphics state to defaults
- ~~`setColorMask` / `getColorMask`~~ — GPU-enforced via custom blend modes
- ~~`newShader` / `setShader` / `getShader`~~ — custom fragment shaders via SDL_GPURenderState
- ~~`newSpriteBatch` / `flushBatch`~~ — batch rendering performance
- ~~`newParticleSystem`~~ — particle effects
- ~~`newMesh`~~ — custom vertex geometry (fan/strip/triangles/points, vertex map, textured/untextured)
- ~~`newText`~~ — cached text object (render-to-canvas, segment-based, full transform support)
- ~~`setStencilTest` / `stencil`~~ — stencil masking via canvas-based simulation
- ~~`applyTransform` / `replaceTransform`~~ — apply Transform object to stack
- ~~`setLineJoin` / `getLineJoin`~~ — miter/bevel/none line joins
- ~~`setLineStyle` / `getLineStyle`~~ — rough/smooth line style
- ~~`getDPIScale` / `getPixelDimensions` / `getPixelHeight` / `getPixelWidth`~~ — HiDPI pixel queries
- ~~`getRendererInfo` / `getStats`~~ — renderer info and per-frame draw stats
- ~~`getSupported` / `getSystemLimits`~~ — capability queries
- ~~`getCanvasFormats` / `getImageFormats` / `getTextureTypes`~~ — format queries
- ~~`isActive` / `isGammaCorrect`~~ — state queries
- ~~`setWireframe` / `isWireframe`~~ — wireframe mode
- ~~`Canvas:renderTo(fn)`~~ — convenience wrapper for setCanvas/restore
- ~~`Image:setWrap` / `getWrap`~~ — texture wrap mode (clamp/repeat)
- ~~`Image:replacePixels`~~ — in-place GPU texture update from ImageData

**Not planned:**
- `setDepthMode` / `getDepthMode` — SDL3 2D renderer has no depth buffer
- `drawInstanced` / `drawLayer` — SpriteBatch covers common case
- `setMeshCullMode` / `getMeshCullMode` — barely used in 2D
- `setFrontFaceWinding` / `getFrontFaceWinding` — barely used in 2D
- `present` / `discard` — manual frame control, not needed for desktop
- `newArrayImage` / `newCubeImage` — advanced texture types

### ~~love.mouse — missing functions~~ DONE

### ~~love.math — missing functions~~ DONE

### ~~love.filesystem — missing functions~~ DONE

**Lua-specific (N/A):**
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
- ~~OGG/MP3/FLAC decoding~~ — via stb_vorbis + dr_mp3 + dr_flac
- ~~`newQueueableSource`~~ — streaming procedural audio via SDL audio streams + SoundData
- ~~`newDecoder`~~ — streaming audio decode for memory-efficient music playback
- ~~`newSource(path, "stream")`~~ — uses Decoder internally for incremental chunk feeding

**Not planned:**
- `setPosition` / `getPosition` / `setOrientation` / `getOrientation` — 3D listener (needs OpenAL or custom mixing)
- `setVelocity` / `getVelocity` / `setDistanceModel` / `setDopplerScale` — spatial audio (needs OpenAL or custom mixing)
- `setEffect` / `getEffect` / `getActiveEffects` — audio effects (needs DSP or OpenAL)
- `getMaxSceneEffects` / `getMaxSourceEffects` / `isEffectsSupported` — effect caps
- `getRecordingDevices` — microphone input (niche)
- `setMixWithSystem` — iOS-only

### love.physics — complete

All physics features implemented. Gear/pulley/rope/friction joints do NOT exist in Box2D v3 (only distance/revolute/prismatic/weld/mouse/wheel/motor/filter).

### love.event — complete

### love.keyboard — complete (mobile-only `hasScreenKeyboard` N/A)

### love.system — complete (mobile-only `vibrate`, `hasBackgroundMusic` N/A)

---

## New Modules

### ~~Priority 1 — High Impact~~ DONE

#### ~~Image format support (PNG/JPG via SDL_image)~~ DONE
- **Implemented**: PNG, JPG, GIF, WebP, SVG, QOI loading via SDL_image
- `ffi_image.ts` with lazy dlopen, graceful fallback to BMP-only
- `bun run build-sdl_image` to build from source

### ~~Priority 2 — Important for Many Games~~ DONE

#### ~~love.data~~ DONE
- **Implemented**: `compress`/`decompress` (zlib, gzip, deflate), `encode`/`decode` (base64, hex), `hash` (md5, sha1, sha224, sha256, sha384, sha512), `ByteData`
- Uses Bun's built-in zlib, Buffer, and CryptoHasher APIs — no external dependencies

### ~~Priority 3 — Useful for Specific Game Types~~ DONE

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
- **Implemented**: `newImageData(w, h)` / `newImageData(filepath)`, getPixel/setPixel, mapPixel, paste, encode (PNG/BMP), getString, getFormat
- `newImage(imageData)` creates GPU texture from ImageData
- `Image:replacePixels` for in-place GPU texture updates
- Buffer-based byte-order RGBA implementation, no external dependencies

#### ~~love.sound (data-level audio APIs)~~ DONE
- **Implemented**: SoundData with getSample/setSample (normalized -1..1), newSoundData from empty buffer or file
- **Pairs with**: newQueueableSource for procedural audio generation
- **newDecoder**: streaming audio decode for memory-efficient music playback (C handle table + JS Decoder class)
- **newSource(path, "stream")**: uses Decoder internally for incremental chunk feeding

#### ~~love.video~~ DONE
- **Implemented**: MPEG-1 video + MP2 audio playback via pl_mpeg (single-header decoder)
- Video object is drawable, supports play/pause/rewind/seek/loop
- Audio synced via SDL audio streams
- Format: .mpg (love2d uses .ogv Theora)
- `bun run build-pl_mpeg` to build from source

### Not Planned

#### love.thread
- Bun's async I/O covers most use cases (asset loading, network). For CPU-bound work, Bun Workers provide real OS threads + SharedArrayBuffer — superior to love.thread's serialized Lua channels.

#### love.touch
- Mobile-only. SDL3 has touch events if needed in the future.

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
| love.graphics.drawInstanced / drawLayer | SpriteBatch covers the common batched-draw case |
| love.graphics.setMeshCullMode / getMeshCullMode | Barely used in 2D games |
| love.graphics.setFrontFaceWinding / getFrontFaceWinding | Barely used in 2D games |
| love.graphics.present / discard | Manual frame control, not needed for desktop game loop |
| Box2D WASM fallback | Native lib works on all targets; high effort for edge case |
| love.data.pack / unpack | Lua 5.3 `string.pack` wrapper; barely used in love2d games; TypeScript has DataView |
| love.video.newVideoStream | Reflects libtheora's Ogg architecture; jove2d's combined Video object is correct for pl_mpeg |
| love.graphics.setDepthMode / getDepthMode | SDL3 2D renderer has no depth buffer; love2d only uses with custom shaders |

---

## Implementation Order (all 42 completed)

1. ~~**SDL_image**~~ DONE
2. ~~**Window gaps**~~ DONE — vsync, display info, pixel density, message box, flash, updateMode
3. ~~**Graphics quick wins**~~ DONE — defaultFilter, transformPoint, inverseTransformPoint, intersectScissor, getStackDepth, reset
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
22. ~~**Graphics DPI/info queries**~~ DONE — getDPIScale, getPixelDimensions, getPixelWidth, getPixelHeight, getRendererInfo, getStats
23. ~~**setLineJoin / getLineJoin**~~ DONE — miter/bevel/none line join styles
24. ~~**preSolve callback**~~ DONE — 1-frame-delay enable-list pattern, Contact.setEnabled, one-way platforms
25. ~~**Bitmap font support**~~ DONE — newImageFont with separator-color glyph detection, pixel-art font rendering
26. ~~**Error recovery**~~ DONE — blue error screen for load/update/draw/event failures, setErrorHandler override, clipboard copy
27. ~~**newQueueableSource**~~ DONE — streaming/procedural audio via SDL audio streams
28. ~~**love.sound (SoundData)**~~ DONE — sample-level get/set for procedural audio, pairs with newQueueableSource
29. ~~**Physics Phase 3**~~ DONE — joint getters, Body applyAngularImpulse + getWorldVector/getLocalVector, Fixture testPoint, World getJoints/getJointCount
30. ~~**textedited event**~~ DONE — IME composition (SDL_EVENT_TEXT_EDITING) for CJK input
31. ~~**Graphics capability queries**~~ DONE — getSupported, getSystemLimits, getCanvasFormats, getImageFormats, getTextureTypes, isGammaCorrect, isActive
32. ~~**love.video**~~ DONE — MPEG-1 video+MP2 audio playback via pl_mpeg, drawable Video object, play/pause/seek/loop
33. ~~**Display sleep control**~~ DONE — `isDisplaySleepEnabled` / `setDisplaySleepEnabled` via SDL3 screensaver API
34. ~~**event.wait**~~ DONE — blocks until event via SDL_WaitEvent
35. ~~**colorMask GPU enforcement**~~ DONE — GPU-enforced via `SDL_ComposeCustomBlendMode`
36. ~~**Wireframe mode**~~ DONE — `setWireframe` / `isWireframe`
37. ~~**newDecoder**~~ DONE — streaming audio decode (C wrapper handle table + JS Decoder class + stream source type)
38. ~~**Physics convenience setters**~~ DONE — `Body:setX/setY`, `Body:getTransform/setTransform`, `Fixture:setCategory/setMask/setGroupIndex`
39. ~~**Canvas:renderTo(fn)**~~ DONE — sugar for `setCanvas(c); fn(); setCanvas(prev)`
40. ~~**Image wrap mode**~~ DONE — `Image:setWrap/getWrap` (SDL3 `SDL_SetRenderTextureAddressMode`; "clamp" and "repeat")
41. ~~**Image:replacePixels**~~ DONE — update GPU texture from ImageData without recreating (SDL3 `SDL_UpdateTexture`)
42. ~~**ImageData:getFormat()**~~ DONE — always returns `"rgba8"`

# Love2d to jove2d Migration Guide

This guide covers the key differences you'll encounter when porting a love2d game to jove2d, ordered by impact.

## 1. Colors: 0-255, not 0-1

jove2d uses SDL's 0-255 color range. This is the most common source of "everything is black" bugs.

**love2d:**
```lua
love.graphics.setColor(1, 0.5, 0, 1)
love.graphics.setBackgroundColor(0.1, 0.1, 0.2)
```

**jove2d:**
```ts
jove.graphics.setColor(255, 128, 0, 255);
jove.graphics.setBackgroundColor(25, 25, 51);
```

To convert: multiply each value by 255. Alpha defaults to 255 if omitted.

## 2. Game Structure

love2d uses global callback functions. jove2d passes callbacks as an object to `jove.run()`.

**love2d:**
```lua
function love.load()
  -- setup
end

function love.update(dt)
  -- logic
end

function love.draw()
  -- render
end
```

**jove2d:**
```ts
import jove from "jove2d";

await jove.run({
  load() {
    // setup
  },
  update(dt) {
    // logic
  },
  draw() {
    // render
  },
});
```

There is no `conf.lua` equivalent. Window size, title, and flags are set in `load()` via `jove.window.setMode()` and `jove.window.setTitle()`.

## 3. Imports

love2d provides a global `love` table. jove2d uses a single default import.

**love2d:**
```lua
love.graphics.print("Hello", 10, 10)
love.keyboard.isDown("space")
```

**jove2d:**
```ts
import jove from "jove2d";

jove.graphics.print("Hello", 10, 10);
jove.keyboard.isDown("space");
```

When using the CLI (`bun cli/jove.ts mygame/`), `import jove from "jove2d"` works automatically. When running files directly, use the relative import path to `src/index.ts`.

## 4. Null Returns Instead of Exceptions

Functions that load resources return `null` on failure instead of throwing.

**love2d:**
```lua
local img = love.graphics.newImage("sprite.png")  -- throws on failure
```

**jove2d:**
```ts
const img = jove.graphics.newImage("sprite.png");  // returns null on failure
if (!img) {
  console.error("Failed to load sprite.png");
}
```

This applies to: `newImage`, `newSource`, `newFont`, `newCanvas`, `newShader`, `newVideo`, `newParticleSystem`.

## 5. Async Shaders

`newShader()` is async because SPIR-V compilation uses a CLI subprocess.

**love2d:**
```lua
local shader = love.graphics.newShader(fragmentCode)
```

**jove2d:**
```ts
const shader = await jove.graphics.newShader(fragmentCode);
```

Create shaders in `load()` (which supports `async`) rather than in `draw()`.

## 6. Physics: Box2D v3

jove2d uses Box2D v3.1.1 (love2d uses v2.x). Most of the API is the same, but:

**Available joint types (7):** distance, revolute, prismatic, weld, mouse, wheel, motor

**Not available in Box2D v3:** gear, pulley, rope, friction joints

**Other differences:**
- `Fixture:setSensor()` is creation-time only — cannot change after creation
- `preSolve` uses a 1-frame-delay enable-list pattern (contacts disabled by default, enabled next frame)
- `postSolve` is called "hit events" — fires on initial contact, not every frame
- Joint creation: `world:newJoint(type, bodyA, bodyB, ...)` instead of `love.physics.newDistanceJoint(bodyA, bodyB, ...)`

## 7. Video Format

jove2d uses MPEG-1 (.mpg) instead of love2d's Ogg Theora (.ogv).

Convert with ffmpeg:
```bash
ffmpeg -i video.ogv -c:v mpeg1video -q:v 5 -c:a mp2 -b:a 192k video.mpg
```

## 8. Quick Mapping Table

| love2d | jove2d | Notes |
|--------|--------|-------|
| `love.load()` | `{ load() {} }` | Callback object |
| `love.update(dt)` | `{ update(dt) {} }` | Same |
| `love.draw()` | `{ draw() {} }` | Same |
| `love.keypressed(key)` | `{ keypressed(key) {} }` | Same |
| `love.graphics.setColor(r, g, b, a)` | `jove.graphics.setColor(r, g, b, a)` | 0-255, not 0-1 |
| `love.graphics.newShader(code)` | `await jove.graphics.newShader(code)` | Async |
| `love.graphics.newImage(path)` | `jove.graphics.newImage(path)` | Returns null on fail |
| `love.audio.newSource(path, type)` | `jove.audio.newSource(path, type)` | Returns null on fail |
| `love.physics.newWorld(gx, gy)` | `jove.physics.newWorld(gx, gy)` | Box2D v3 |
| `love.physics.newDistanceJoint(...)` | `world.newJoint("distance", ...)` | Method on World |
| `love.filesystem.read(path)` | `await jove.filesystem.read(path)` | Async |
| `love.video.newVideoStream(path)` | `jove.video.newVideo(path)` | .mpg not .ogv |
| `love.math.random()` | `jove.math.random()` | Same |
| `love.timer.getDelta()` | `jove.timer.getDelta()` | Same |
| `love.window.setMode(w, h, flags)` | `jove.window.setMode(w, h, flags)` | Same |

## 9. What's Not Implemented

| Feature | Reason |
|---------|--------|
| love.thread | Bun async/Workers cover this (real OS threads + SharedArrayBuffer) |
| love.touch | Mobile-only |
| love.sensor | Mobile-only (accelerometer, gyroscope) |
| Vertex/compute shaders | Only fragment shaders via SDL_GPURenderState |
| Positional/3D audio | SDL3 has no spatial audio API |
| Audio effects (reverb, echo) | Needs DSP or OpenAL |
| `love.data.pack/unpack` | Lua 5.3 string.pack wrapper; use TypeScript DataView |
| Gear/pulley/rope/friction joints | Don't exist in Box2D v3 |
| `drawInstanced`, `drawLayer` | SpriteBatch covers the common case |
| `setDepthMode` | SDL3 2D renderer has no depth buffer |
| `love.filesystem.load` | Lua-specific (load chunk); use TypeScript `import()` |

## 10. Common Pitfalls

1. **Black screen** — You're using 0-1 colors. Use 0-255.
2. **Shader fails silently** — `newShader()` returns null. Check that `glslang-tools` is installed (`sudo apt install glslang-tools`).
3. **`extern` uniforms** — jove2d's GLSL transpiler converts love2d's `extern` keyword to a std140 uniform block. `Texel()` becomes `texture()`, `effect()` becomes `main()`. Most love2d shaders work as-is.
4. **No conf.lua** — Set window size in `load()` with `jove.window.setMode(w, h)`.
5. **Physics joint creation** — Use `world.newJoint("type", bodyA, bodyB, ...)` not top-level `jove.physics.newDistanceJoint(...)`.
6. **Async load** — `load()` can be async; `update()` and `draw()` cannot.
7. **Font loading** — `newFont()` is async (returns a Promise). Load fonts in `load()`.
8. **Image loading returns null** — If SDL_image isn't built, only BMP is supported. PNG/JPG need `bun run build-sdl_image`.
9. **Audio returns null** — OGG/MP3/FLAC need `bun run build-audio-decode`. WAV always works.
10. **preSolve contacts are disabled by default** — Set `contact.setEnabled(true)` to allow them through. This prevents 1-frame bounce-off on one-way platforms.

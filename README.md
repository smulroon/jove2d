# jove2d

A 2D game engine mirroring the [love2d](https://love2d.org/) API, built with TypeScript/Bun and powered by SDL3 via `bun:ffi`.

## What is jove2d?

jove2d reimplements love2d's API in TypeScript so you can write 2D games with the same familiar interface — `love.graphics.draw()`, `love.physics.newWorld()`, `love.audio.newSource()` — but running on Bun with direct SDL3 bindings instead of Lua and C++.

Every example ships with both a `main.ts` (jove2d) and `main.lua` (love2d) so you can compare output side-by-side.

## Features

| Module | Status | Notes |
|--------|--------|-------|
| love.timer | 6/6 Complete | All functions |
| love.mouse | 18/18 Complete | All functions |
| love.math | 16/16 Complete | RNG, simplex noise, Transform, triangulate |
| love.data | 5/5 Complete | compress/decompress, encode/decode, hash, ByteData |
| love.joystick | ~16/17 Complete | Gamepad support, vibration, hot-plug |
| love.event | 4/6 Complete | Core event loop |
| love.keyboard | 7/9 Complete | Key state, scancodes, text input |
| love.window | 33/36 Mostly done | Fullscreen, vsync, multi-monitor, icon |
| love.system | 6/8 Complete | OS info, clipboard, power |
| love.physics | ~56/60 Mostly done | Box2D v3.1.1 — bodies, fixtures, 7 joint types, queries, preSolve |
| love.graphics | ~81/97 Core done | Primitives, transforms, shaders, SpriteBatch, Mesh, particles, stencil, bitmap fonts |
| love.filesystem | 19/31 Mostly done | Read/write/mount, File handles, FileData |
| love.audio | 15/26 Core done | WAV/OGG/MP3/FLAC playback, pitch, looping, seek, clone |
| love.image | 7/7 Complete | newImageData, getPixel/setPixel, mapPixel, paste, encode |

**14/20 love2d modules implemented, 8 at 100%**

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- Linux (tested on Ubuntu/WSL2)
- Build tools: `cmake`, `ninja-build`, `build-essential`
- X11 dev libraries (for SDL3):
  ```bash
  sudo apt install cmake ninja-build build-essential \
    libx11-dev libxext-dev libxrandr-dev libxcursor-dev \
    libxi-dev libxfixes-dev libxss-dev libwayland-dev \
    libxkbcommon-dev
  ```

### Setup

```bash
git clone https://github.com/smulroon/jove2d.git
cd jove2d
bun install

# Build SDL3 (required)
bun run build-sdl3
```

### Run an example

```bash
bun examples/hello/main.ts
```

## Building Native Libraries

SDL3 is required. The other libraries are optional and enable additional features.

```bash
# SDL3 — required
bun run build-sdl3

# SDL_ttf — TrueType font rendering (requires libfreetype-dev)
sudo apt install libfreetype-dev
bun run build-sdl_ttf

# SDL_image — PNG/JPG/WebP/GIF loading (requires libpng-dev)
sudo apt install libpng-dev
bun run build-sdl_image

# Box2D v3 — physics engine
bun run build-box2d

# Audio codecs — OGG/MP3/FLAC decoding
bun run build-audio-decode
```

Without optional libraries, the engine gracefully falls back:
- No SDL_ttf: uses built-in 8x8 debug font
- No SDL_image: loads BMP images only
- No Box2D: `love.physics` module unavailable
- No audio_decode: loads WAV files only
- No glslang-tools: `newShader()` unavailable

Shaders require the `glslangValidator` CLI for SPIR-V compilation:

```bash
sudo apt install glslang-tools
```

## Examples

All 24 examples have both `main.ts` (jove2d) and `main.lua` (love2d) versions.

| Example | Description |
|---------|-------------|
| `hello` | Timer, system info, frame counter |
| `drawing` | All primitives, ellipse, arc, polygon, transforms, scissor, blend modes |
| `input` | Keyboard, mouse, text input, cursor visibility |
| `screenshot` | Screenshot capture |
| `canvas` | Off-screen render targets |
| `noise` | Simplex noise, RNG, triangulation |
| `filesystem` | File I/O, directory ops, File handles |
| `transforms` | Nested push/pop solar system, shear, scale |
| `event` | Event push/clear/quit, text input, file drop |
| `system` | OS info, clipboard, power state |
| `font` | Default font, custom sizes, alignment, font metrics, newText |
| `spritebatch` | Tilemap demo with SpriteBatch and quads |
| `shader` | Color cycling, wave distortion, vignette fragment shaders |
| `particles` | Fire + smoke particle systems |
| `audio` | Play/pause/stop, pitch, volume, looping, seek, format switching (WAV/OGG/MP3/FLAC) |
| `mesh` | Colored triangle, textured quad, vertex map, triangle strip |
| `data` | Compress/decompress, base64/hex encoding, hashing |
| `joystick` | Joystick detection, axes, buttons, gamepad mapping |
| `physics` | Bouncing balls, static walls, click-to-spawn, contact flash |
| `physics2` | Wheel joints (car), motor joint, joint anchors, contact point/speed |
| `imagedata` | Procedural textures, pixel manipulation, paste, readback |
| `presolve` | One-way platforms via preSolve callback |
| `bitmapfont` | Bitmap font (newImageFont), color tinting, printf alignment, word wrap |
| `benchmark` | "Chaos Box" stress test — 300 physics bodies, particles, SpriteBatch |

Run any example:

```bash
bun examples/<name>/main.ts
```

### Comparing with love2d

Each example includes a `main.lua` and `conf.lua` for love2d:

```bash
love examples/<name>
```

## Testing

```bash
# Run all tests (headless, no window needed)
SDL_VIDEODRIVER=dummy bun test
```

618 tests across 27 test files. Font/image tests skip gracefully if SDL_ttf/SDL_image aren't built. Physics/joystick/audio-codec tests skip if their libraries aren't built.

## WSL2 Notes

jove2d auto-detects WSL2 and sets `SDL_VIDEODRIVER=x11` to avoid Wayland hangs. Audio device opening is lazy to prevent ALSA hangs when no audio device is present.

## Project Status

**Alpha** — the API is functional but not yet stable. 14 of 20 love2d modules are implemented with good coverage. See [PRIORITIES.md](PRIORITIES.md) for the full roadmap and module gap analysis.

Key differences from love2d:
- Colors use 0-255 range (SDL convention) instead of love2d's 0-1 range
- `newShader()` is async (SPIR-V compilation via CLI subprocess)
- Only fragment shaders are supported (no vertex/compute)
- Audio supports WAV/OGG/MP3/FLAC (OGG/MP3/FLAC require building `libaudio_decode.so`)
- Bitmap fonts (`newImageFont`) use the same separator-color convention as love2d

## License

[MIT](LICENSE)

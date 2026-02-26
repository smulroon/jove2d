# Changelog

## 0.6.0

### CI/CD

- Release workflow now runs tests and type checking before packaging
- CI type check is blocking (was informational)
- Release builds include pl_mpeg for Linux video support
- Release packages include CLI, docs, and changelog

## 0.5.0 — Initial Release

### Engine

- 16/20 love2d modules implemented (12 at 100%)
- Full Box2D v3.1.1 physics (7 joint types, preSolve, queries)
- Fragment shaders via SDL_GPURenderState + SPIR-V
- WAV/OGG/MP3/FLAC audio, MPEG-1 video
- SpriteBatch, Mesh, ParticleSystem, newText cached text objects
- Bitmap fonts (newImageFont), TTF font rendering
- Stencil, scissor, blend modes, colorMask (GPU-enforced)
- ImageData pixel manipulation, replacePixels
- 27 examples with love2d comparison versions

### CLI

- `jove run` — run games from folder, .ts file, or .jove archive
- `jove pack` — create distributable .jove archives
- `jove build` — compile standalone executables with bundled native libs

### Platform Support

- Linux x64, Windows x64
- 732+ tests across 30 files (16 CLI-specific)

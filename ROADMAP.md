# Roadmap

Future improvements for jove2d, beyond feature completeness. For stability status see `HARDENING.md`.

## 1. `jove` CLI Launcher (love2d-style distribution)

Mirror love2d's distribution model: a standalone `jove` command that runs games.

```bash
jove mygame/        # run main.ts in that folder
jove .              # run main.ts in current directory
jove --version      # print jove2d + SDL3 versions
```

**How love2d does it:** `love` is a single executable (~5 MB) bundling Lua, SDL2, and all deps. Users download it, put it on PATH, and run `love <folder>`.

**How jove would do it:**
- A `jove` shell script (Linux/macOS) or `jove.exe` wrapper (Windows) that invokes `bun <folder>/main.ts`
- Distributed as a self-contained archive with Bun runtime + all native libs:
  ```
  jove-linux-x64/
    jove              # launcher script
    bun               # bundled Bun runtime
    lib/
      libSDL3.so.0
      libSDL3_ttf.so.0
      libSDL3_image.so.0
      libbox2d_jove.so
      libaudio_decode.so
      libpl_mpeg_jove.so
    src/              # jove2d engine source
    assets/           # default font, bitmap font
  ```
- Game projects only need a `main.ts` — no `node_modules`, no `package.json`, no build step
- `lib-path.ts` already resolves libs relative to the executable, so this mostly works today

**What's needed:**
- [ ] CLI entry point (`src/cli.ts`) that resolves game directory from argv and imports `main.ts`
- [ ] Launcher script (`scripts/jove.sh`) that sets `LD_LIBRARY_PATH` and runs Bun
- [ ] Windows `.cmd` or `.exe` wrapper equivalent
- [ ] Update `package-release.sh` to include Bun binary and launcher
- [ ] `jove --version` flag
- [ ] Consider `bun build --compile` for the launcher (bundles Bun into single binary, but native libs still need to be alongside)

**Open questions:**
- Bundle Bun runtime or require users to install it? Bundling is ~90 MB but zero-dependency. Requiring Bun is lighter but adds a prerequisite.
- `.jove` archive format (zip containing game files, like `.love`)? Nice-to-have but not essential for v1.

## 2. npm Registry Publishing (`bun install jove2d`)

Publish to npm so users can `bun install jove2d` and import it as a dependency in their own projects.

```ts
import jove from "jove2d";

await jove.run({
  draw() {
    jove.graphics.print("Hello!", 100, 100);
  }
});
```

**What's needed:**
- [ ] Add `exports` and `files` fields to `package.json`
- [ ] Create `.npmignore` (exclude vendor/, examples/, scripts/, .github/)
- [ ] Decide native library strategy:
  - **Option A**: Platform-specific npm packages (`@jove2d/linux-x64`, `@jove2d/windows-x64`) with native libs, auto-selected via `optionalDependencies` (like esbuild/turbo)
  - **Option B**: Post-install script that downloads pre-built libs from GitHub releases
  - **Option C**: Require users to build libs locally (current model, unfriendly)
- [ ] Add `npm publish` step to release workflow
- [ ] Update README with npm installation instructions
- [ ] Test end-to-end: `bun install jove2d` in a fresh project

**Note:** The CLI launcher (section 1) and npm package are complementary distribution models. The CLI targets love2d users who want a drop-in replacement. The npm package targets TypeScript developers who want jove2d as a library dependency.

## 3. CI Quality Gates

Currently the release workflow only builds and packages — no tests run before publishing.

- [ ] Add test job to GitHub Actions (`SDL_VIDEODRIVER=dummy bun test` on push/PR)
- [ ] Add `soak` script to package.json (`bun tools/soak-test.ts --duration 30`)
- [ ] Run quick soak before tagging a release
- [ ] Type-check pass (`bunx tsc --noEmit`)
- [ ] Gate releases on test + soak passing

## 4. macOS Support

Currently Linux x64 and Windows x64 only.

- [ ] macOS build scripts (arm64 + x64 universal binary)
- [ ] CI matrix: Linux x64, Windows x64, macOS arm64
- [ ] Test on real macOS hardware (Metal renderer via SDL3)
- [ ] Update `lib-path.ts` for `.dylib` (already handled by `bun:ffi` suffix)

## 5. Visual Regression CI

Screenshot comparison tool exists (`tools/compare-images.ts`) but isn't automated.

- [ ] CI job that runs each example for 1 frame, captures screenshot
- [ ] Compare against checked-in reference images
- [ ] Threshold-based pass/fail (handle anti-aliasing differences)
- [ ] Run on Linux (headless via Xvfb or virtual framebuffer)

## 6. Developer Experience

- [ ] `create-jove2d` scaffolding: `bun create jove2d my-game` bootstraps a new project
- [ ] API documentation site (auto-generated from TypeScript types)
- [ ] Love2d migration guide (color range, async shaders, API mapping table)
- [ ] CHANGELOG.md for curated release notes

## 7. Game Distribution (stretch goal)

Help users package their games as standalone executables.

- [ ] `jove build mygame/` — bundles game + engine + libs into a distributable archive
- [ ] Platform-specific output (Linux tarball, Windows zip, macOS .app bundle)
- [ ] Asset bundling (embed images/audio/fonts into the archive)
- [ ] Consider `bun build --compile` for single-binary games (pending Bun FFI support)

## Priority Order

1. **`jove` CLI launcher** — highest impact, mirrors love2d's UX, differentiator
2. **CI quality gates** — quick wins, prevents regressions
3. **npm publishing** — broadens reach to TypeScript ecosystem
4. **macOS support** — expands platform coverage
5. **Visual regression CI** — automated quality assurance
6. **Developer experience** — lowers barrier to entry
7. **Game distribution** — stretch goal, depends on Bun's compile capabilities

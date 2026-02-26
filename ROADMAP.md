# Roadmap

Future improvements for jove2d, beyond feature completeness. For stability status see `HARDENING.md`.

## 1. `jove` CLI Launcher — DONE

The `jove` CLI mirrors love2d's distribution model. Run, pack, and build games from the command line.

```bash
bun cli/jove.ts mygame/            # run main.ts in that folder
bun cli/jove.ts mygame.jove        # run a .jove archive
bun cli/jove.ts pack mygame/       # create .jove archive
bun cli/jove.ts build mygame/      # build standalone executable
```

- `jove run` — runs games from folders, `.ts` files, or `.jove` archives
- `jove pack` — creates distributable `.jove` zip archives
- `jove build` — compiles standalone executables via `bun build --compile` with bundled native libs
- Games use `import jove from "jove2d"` — the CLI sets up a `node_modules/jove2d` junction symlink
- Verified on Linux x64 and Windows x64 (16 automated tests)

## 2. Game Distribution — DONE

Covered by `jove build`. Produces a standalone executable with all native libraries bundled alongside.

```bash
bun cli/jove.ts build mygame/ -o dist/
# Output:
#   dist/mygame          # standalone executable
#   dist/lib/            # native libraries (.so/.dll)
#   dist/assets/         # engine assets (fonts)
```

Cross-compilation supported via `--target` (e.g. `--target bun-windows-x64`).

## 3. CI Quality Gates

Currently the release workflow only builds and packages — no tests run before publishing.

- [ ] Add test job to GitHub Actions (`SDL_VIDEODRIVER=dummy bun test` on push/PR)
- [ ] Add `soak` script to package.json (`bun tools/soak-test.ts --duration 30`)
- [ ] Run quick soak before tagging a release
- [ ] Type-check pass (`bunx tsc --noEmit`)
- [ ] Gate releases on test + soak passing

## 4. npm Registry Publishing (`bun install jove2d`)

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

**Note:** The CLI launcher and npm package are complementary distribution models. The CLI targets love2d users who want a drop-in replacement. The npm package targets TypeScript developers who want jove2d as a library dependency.

## 5. macOS Support

Currently Linux x64 and Windows x64 only.

- [ ] macOS build scripts (arm64 + x64 universal binary)
- [ ] CI matrix: Linux x64, Windows x64, macOS arm64
- [ ] Test on real macOS hardware (Metal renderer via SDL3)
- [ ] Update `lib-path.ts` for `.dylib` (already handled by `bun:ffi` suffix)

## 6. Visual Regression CI

Screenshot comparison tool exists (`tools/compare-images.ts`) but isn't automated.

- [ ] CI job that runs each example for 1 frame, captures screenshot
- [ ] Compare against checked-in reference images
- [ ] Threshold-based pass/fail (handle anti-aliasing differences)
- [ ] Run on Linux (headless via Xvfb or virtual framebuffer)

## 7. Developer Experience

- [ ] `create-jove2d` scaffolding: `bun create jove2d my-game` bootstraps a new project
- [ ] API documentation site (auto-generated from TypeScript types)
- [x] Love2d migration guide — see [docs/MIGRATION.md](docs/MIGRATION.md)
- [x] CHANGELOG.md — see [CHANGELOG.md](CHANGELOG.md)
- [x] API reference — see [docs/API.md](docs/API.md)

## Priority Order

1. **CI quality gates** — quick wins, prevents regressions
2. **npm publishing** — broadens reach to TypeScript ecosystem
3. **macOS support** — expands platform coverage
4. **Visual regression CI** — automated quality assurance
5. **Developer experience** — lowers barrier to entry

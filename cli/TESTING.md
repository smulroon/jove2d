# jove CLI — Testing Guide

## Prerequisites

- Bun installed (`bun --version`)
- SDL3 and optional libs built (at least `vendor/SDL3/install/lib/`)

## Linux/WSL2 Tests

### Automated tests (no window needed)

```bash
bun test tests/cli.test.ts
```

16 tests covering: flags, run validation, file/folder execution, pack, pack+run round-trip, build validation.

### Manual tests

```bash
# Run game from folder (uses relative import ../../src/index.ts)
bun cli/jove.ts examples/hello

# Run a standalone .ts file
echo 'console.log("OK")' > /tmp/test.ts
bun cli/jove.ts /tmp/test.ts

# Create a test game using the "jove2d" import pattern
mkdir -p /tmp/jove-testgame
cat > /tmp/jove-testgame/main.ts << 'GAME'
import jove from "jove2d";
await jove.run({
  draw() {
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("Hello from jove CLI!", 10, 10);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 10, 30);
  },
  keypressed(key) {
    if (key === "escape") jove.window.close();
  },
});
GAME

# Run from folder
bun cli/jove.ts /tmp/jove-testgame

# Pack + run round-trip
bun cli/jove.ts pack /tmp/jove-testgame -o /tmp/testgame.jove
bun cli/jove.ts /tmp/testgame.jove

# Build standalone executable
bun cli/jove.ts build /tmp/jove-testgame -o /tmp/testgame-build
/tmp/testgame-build/jove-testgame

# Verify build output
ls -lh /tmp/testgame-build/
ls -lh /tmp/testgame-build/lib/
ls -lh /tmp/testgame-build/assets/
```

### Expected results

- `jove examples/hello` — window opens, shows FPS/timer/renderer info, console prints version/platform/cores
- `jove /tmp/jove-testgame` — window opens, shows "Hello from jove CLI!" and FPS
- `jove pack` — creates .jove file, `unzip -l` shows main.ts but no .lua or node_modules
- `jove <archive>.jove` — extracts to temp dir, runs, cleans up
- `jove build` — produces directory with executable + `lib/` (native .so files) + `assets/` (Vera.ttf, pixelfont.png)
- Built executable runs standalone without bun installed (just needs the lib/ and assets/ next to it)

## Windows Tests (from PowerShell)

The project lives at `D:\jove2d` when accessed from the Windows side of WSL2.

### Install Bun (if not already)

```powershell
irm bun.sh/install.ps1 | iex
```

### Create a test game

```powershell
mkdir C:\temp\jove-testgame -Force
@"
import jove from "jove2d";
await jove.run({
  draw() {
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("Hello from Windows!", 10, 10);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 10, 30);
  },
  keypressed(key) {
    if (key === "escape") jove.window.close();
  },
});
"@ | Out-File -Encoding utf8 C:\temp\jove-testgame\main.ts
```

### Run tests

```powershell
cd D:\jove2d

# 1. Run existing example (relative import)
bun cli\jove.ts examples\hello

# 2. Run test game (jove2d import, tests junction symlink creation)
bun cli\jove.ts C:\temp\jove-testgame

# 3. Pack (tests Windows tar -a -cf zip creation)
bun cli\jove.ts pack C:\temp\jove-testgame -o C:\temp\testgame.jove

# 4. Run archive (tests Windows tar -xf zip extraction)
bun cli\jove.ts C:\temp\testgame.jove

# 5. Build standalone (tests .dll copying + .exe compilation)
bun cli\jove.ts build C:\temp\jove-testgame -o C:\temp\testgame-build

# 6. Run standalone
C:\temp\testgame-build\jove-testgame.exe
```

### What to verify on Windows

| Step | What to check |
|------|--------------|
| Run folder | Window opens, no import errors, game renders |
| Run test game | `node_modules\jove2d` junction created pointing to `D:\jove2d` |
| Pack | `.jove` file created, no errors about missing `zip` command |
| Run archive | Extracts to `%TEMP%\jove-*`, game runs, temp cleaned up |
| Build | Output has `jove-testgame.exe` + `lib\` with `.dll` files + `assets\` |
| Run exe | Standalone exe runs without bun, finds DLLs in `lib\` |

### Windows-specific code paths

These are the parts that differ on Windows (grep for `IS_WINDOWS` / `win32`):

- **cli/run.ts** `extractZip()` — uses `tar -xf` instead of `unzip`
- **cli/pack.ts** `packWindows()` — uses `tar -a -cf` instead of `zip`
- **cli/run.ts + cli/build.ts** `symlinkSync(..., "junction")` — junction type for symlinks (no admin needed)
- **cli/build.ts** `copyNativeLibs()` — copies `.dll` files (no `lib` prefix) when target includes "windows"
- **src/sdl/lib-path.ts** — `process.execPath` resolves real exe path in compiled binaries

### Cleanup

```powershell
# Windows
Remove-Item -Recurse -Force C:\temp\jove-testgame, C:\temp\testgame-build, C:\temp\testgame.jove
# Also remove generated symlinks in examples
Remove-Item -Recurse -Force D:\jove2d\examples\hello\node_modules
```

```bash
# Linux
rm -rf /tmp/jove-testgame /tmp/testgame-build /tmp/testgame.jove
rm -rf examples/hello/node_modules
```

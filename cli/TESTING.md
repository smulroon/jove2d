# jove CLI — Windows Testing Walkthrough

All commands run in a **Windows PowerShell or Command Prompt** terminal. The project is at `D:\jove2d`.

## Quick start — run the batch file

```cmd
cd D:\jove2d
cli\test-windows.bat
```

This runs all 8 steps automatically with pass/fail reporting. Games that open a window require you to close them (Escape or X button) before the script continues.

## Manual walkthrough

If you prefer to run each step individually:

## Step 0: Prerequisites

```powershell
bun --version
# Need bun installed. If not: irm bun.sh/install.ps1 | iex

cd D:\jove2d
```

Clean up any leftover state from previous test runs:
```powershell
Remove-Item -Recurse -Force D:\jove2d\examples\hello\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force C:\temp\jove-testgame, C:\temp\testgame-build, C:\temp\testgame.jove -ErrorAction SilentlyContinue
```

## Step 1: Automated tests

```powershell
bun test tests\cli.test.ts
```

Expected: **16 pass, 0 fail**. These test flags, error handling, run, pack, and round-trip — all without opening windows.

## Step 2: Run an existing example

```powershell
bun cli\jove.ts examples\hello
```

Expected: Window opens showing FPS, timer, renderer info. Console prints:
```
jove2d 3.5.0
Platform: Windows
CPU cores: ...
```
Close with Escape or the X button.

Verify the junction was created:
```powershell
cmd /c dir /al D:\jove2d\examples\hello\node_modules
# Should show: jove2d [D:\jove2d]
```

Running the same command again should work (junction already exists, gets reused):
```powershell
bun cli\jove.ts examples\hello
```

## Step 3: Create a test game

This game uses `import jove from "jove2d"` (the portable import style, not relative paths).

```powershell
mkdir C:\temp\jove-testgame -Force | Out-Null
```

Then create `C:\temp\jove-testgame\main.ts` in any text editor with this content:

```typescript
import jove from "jove2d";
await jove.run({
  draw() {
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("Hello from Windows!", 10, 10);
    jove.graphics.print("FPS: " + jove.timer.getFPS(), 10, 30);
  },
  keypressed(key) {
    if (key === "escape") jove.window.close();
  },
});
```

Verify the file was created:
```powershell
type C:\temp\jove-testgame\main.ts
```

## Step 4: Run the test game from folder

```powershell
bun cli\jove.ts C:\temp\jove-testgame
```

Expected: Window opens showing "Hello from Windows!" and FPS. Close with Escape.

Verify the junction was created:
```powershell
cmd /c dir /al C:\temp\jove-testgame\node_modules
# Should show: jove2d [D:\jove2d]
```

## Step 5: Pack into a .jove archive

```powershell
bun cli\jove.ts pack C:\temp\jove-testgame -o C:\temp\testgame.jove
```

Expected output: `Created C:\temp\testgame.jove`

Verify contents:
```powershell
tar -tf C:\temp\testgame.jove
# Should list: main.ts
# Should NOT contain: node_modules, .lua files
```

## Step 6: Run the .jove archive

```powershell
bun cli\jove.ts C:\temp\testgame.jove
```

Expected: Same window as Step 4 ("Hello from Windows!" + FPS). The archive is extracted to a temp directory, run, then cleaned up automatically.

## Step 7: Build a standalone executable

```powershell
bun cli\jove.ts build C:\temp\jove-testgame -o C:\temp\testgame-build
```

Expected output:
```
Compiling jove-testgame...
  ...
Copied 6 native lib(s) to lib/
Build complete: C:\temp\testgame-build/
```

Verify the output:
```powershell
dir C:\temp\testgame-build\
# Should contain: jove-testgame.exe, lib\, assets\

dir C:\temp\testgame-build\lib\
# Should contain: SDL3.dll, SDL3_ttf.dll, SDL3_image.dll,
#   box2d_jove.dll, audio_decode.dll, pl_mpeg_jove.dll

dir C:\temp\testgame-build\assets\
# Should contain: Vera.ttf, pixelfont.png
```

## Step 8: Run the standalone executable

```powershell
C:\temp\testgame-build\jove-testgame.exe
```

Expected: Same window as Step 4, running without bun — the exe finds DLLs in `lib\` next to it.

## Cleanup

```powershell
Remove-Item -Recurse -Force C:\temp\jove-testgame, C:\temp\testgame-build, C:\temp\testgame.jove -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force D:\jove2d\examples\hello\node_modules -ErrorAction SilentlyContinue
```

## Troubleshooting

- **EEXIST on symlink** — Stale junction from a previous run. Remove it: `Remove-Item -Recurse -Force <path>\node_modules` and retry.
- **"Executable not found: tar"** — Windows 10 build 17063+ required (tar is built-in). Check `tar --version`.
- **Junction creation fails** — Should not need admin. If it does, run PowerShell as Administrator.
- **DLLs not found at runtime** — The exe looks for `lib\` next to itself. Make sure the directory structure is intact.
- **bun build --compile fails** — Known limitation with some bun:ffi patterns. The build command bundles all TS into the exe, but native libs must be shipped alongside.

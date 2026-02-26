@echo off
setlocal enabledelayedexpansion

REM jove CLI — Windows manual test script
REM Run from the jove2d project root: cli\test-windows.bat

set "JOVE_ROOT=%~dp0.."
set "TESTGAME=C:\temp\jove-testgame"
set "ARCHIVE=C:\temp\testgame.jove"
set "BUILD=C:\temp\testgame-build"
set "PASS=0"
set "FAIL=0"

echo ============================================
echo  jove CLI — Windows Test Suite
echo ============================================
echo.

REM --- Cleanup from previous runs ---
echo [cleanup] Removing leftover state...
if exist "%JOVE_ROOT%\examples\hello\node_modules" rmdir /s /q "%JOVE_ROOT%\examples\hello\node_modules"
if exist "%TESTGAME%" rmdir /s /q "%TESTGAME%"
if exist "%ARCHIVE%" del /q "%ARCHIVE%"
if exist "%BUILD%" rmdir /s /q "%BUILD%"
echo.

REM --- Step 1: Automated tests ---
echo ============================================
echo  Step 1: Automated tests
echo ============================================
call bun test tests\cli.test.ts
if !errorlevel! equ 0 (
    echo [PASS] Automated tests
    set /a PASS+=1
) else (
    echo [FAIL] Automated tests
    set /a FAIL+=1
)
echo.

REM --- Step 2: Run existing example ---
echo ============================================
echo  Step 2: Run examples\hello
echo  Close the window to continue...
echo ============================================
call bun cli\jove.ts examples\hello
if !errorlevel! equ 0 (
    echo [PASS] Run examples\hello
    set /a PASS+=1
) else (
    echo [FAIL] Run examples\hello
    set /a FAIL+=1
)

REM Verify junction was created
if exist "%JOVE_ROOT%\examples\hello\node_modules\jove2d\package.json" (
    echo [PASS] Junction created for examples\hello
    set /a PASS+=1
) else (
    echo [FAIL] Junction not found for examples\hello
    set /a FAIL+=1
)
echo.

REM --- Step 2b: Re-run (junction reuse) ---
echo ============================================
echo  Step 2b: Re-run examples\hello (junction reuse)
echo  Close the window to continue...
echo ============================================
call bun cli\jove.ts examples\hello
if !errorlevel! equ 0 (
    echo [PASS] Re-run examples\hello
    set /a PASS+=1
) else (
    echo [FAIL] Re-run examples\hello
    set /a FAIL+=1
)
echo.

REM --- Step 3: Create test game ---
echo ============================================
echo  Step 3: Create test game
echo ============================================
mkdir "%TESTGAME%" 2>nul
(
echo import jove from "jove2d";
echo await jove.run({
echo   draw^(^) {
echo     jove.graphics.setColor^(255, 255, 255^);
echo     jove.graphics.print^("Hello from Windows!", 10, 10^);
echo     jove.graphics.print^("FPS: " + jove.timer.getFPS^(^), 10, 30^);
echo   },
echo   keypressed^(key^) {
echo     if ^(key === "escape"^) jove.window.close^(^);
echo   },
echo }^);
) > "%TESTGAME%\main.ts"

if exist "%TESTGAME%\main.ts" (
    echo [PASS] Test game created
    set /a PASS+=1
) else (
    echo [FAIL] Test game not created
    set /a FAIL+=1
    goto :summary
)
echo.

REM --- Step 4: Run test game from folder ---
echo ============================================
echo  Step 4: Run test game from folder
echo  Close the window to continue...
echo ============================================
call bun cli\jove.ts "%TESTGAME%"
if !errorlevel! equ 0 (
    echo [PASS] Run test game
    set /a PASS+=1
) else (
    echo [FAIL] Run test game
    set /a FAIL+=1
)

REM Verify junction
if exist "%TESTGAME%\node_modules\jove2d\package.json" (
    echo [PASS] Junction created for test game
    set /a PASS+=1
) else (
    echo [FAIL] Junction not found for test game
    set /a FAIL+=1
)
echo.

REM --- Step 5: Pack ---
echo ============================================
echo  Step 5: Pack into .jove archive
echo ============================================
call bun cli\jove.ts pack "%TESTGAME%" -o "%ARCHIVE%"
if !errorlevel! equ 0 (
    if exist "%ARCHIVE%" (
        echo [PASS] Pack created archive
        set /a PASS+=1
    ) else (
        echo [FAIL] Pack reported success but archive missing
        set /a FAIL+=1
    )
) else (
    echo [FAIL] Pack failed
    set /a FAIL+=1
)

REM Verify contents
echo.
echo Archive contents:
tar -tf "%ARCHIVE%" 2>nul
if !errorlevel! equ 0 (
    echo [PASS] Archive is valid
    set /a PASS+=1
) else (
    echo [FAIL] Archive is not a valid zip
    set /a FAIL+=1
)
echo.

REM --- Step 6: Run .jove archive ---
echo ============================================
echo  Step 6: Run .jove archive
echo  Close the window to continue...
echo ============================================
call bun cli\jove.ts "%ARCHIVE%"
if !errorlevel! equ 0 (
    echo [PASS] Run archive
    set /a PASS+=1
) else (
    echo [FAIL] Run archive
    set /a FAIL+=1
)
echo.

REM --- Step 7: Build standalone ---
echo ============================================
echo  Step 7: Build standalone executable
echo ============================================
call bun cli\jove.ts build "%TESTGAME%" -o "%BUILD%"
if !errorlevel! equ 0 (
    echo [PASS] Build completed
    set /a PASS+=1
) else (
    echo [FAIL] Build failed
    set /a FAIL+=1
)

REM Verify build output
if exist "%BUILD%\jove-testgame.exe" (
    echo [PASS] Executable exists
    set /a PASS+=1
) else (
    echo [FAIL] Executable missing
    set /a FAIL+=1
)

if exist "%BUILD%\lib\SDL3.dll" (
    echo [PASS] DLLs copied to lib\
    set /a PASS+=1
) else (
    echo [FAIL] DLLs missing from lib\
    set /a FAIL+=1
)

if exist "%BUILD%\assets\Vera.ttf" (
    echo [PASS] Engine assets copied
    set /a PASS+=1
) else (
    echo [FAIL] Engine assets missing
    set /a FAIL+=1
)
echo.

REM --- Step 8: Run standalone exe ---
echo ============================================
echo  Step 8: Run standalone executable
echo  Close the window to continue...
echo ============================================
if exist "%BUILD%\jove-testgame.exe" (
    call "%BUILD%\jove-testgame.exe"
    if !errorlevel! equ 0 (
        echo [PASS] Standalone exe ran
        set /a PASS+=1
    ) else (
        echo [FAIL] Standalone exe failed
        set /a FAIL+=1
    )
) else (
    echo [SKIP] No exe to run
    set /a FAIL+=1
)
echo.

:summary
REM --- Summary ---
echo ============================================
echo  Results: !PASS! passed, !FAIL! failed
echo ============================================

REM --- Cleanup ---
echo.
set /p CLEANUP="Clean up temp files? (y/n): "
if /i "%CLEANUP%"=="y" (
    if exist "%TESTGAME%" rmdir /s /q "%TESTGAME%"
    if exist "%ARCHIVE%" del /q "%ARCHIVE%"
    if exist "%BUILD%" rmdir /s /q "%BUILD%"
    if exist "%JOVE_ROOT%\examples\hello\node_modules" rmdir /s /q "%JOVE_ROOT%\examples\hello\node_modules"
    echo Cleaned up.
)

endlocal

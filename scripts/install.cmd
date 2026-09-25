@echo off
rem One-click entry point for the full offline openrtk package.
rem Runs scripts\install-full.mjs with Node.js, falling back to Bun.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if not errorlevel 1 (
  node "scripts\install-full.mjs"
  set "EXITCODE=%errorlevel%"
  goto :finish
)

where bun >nul 2>nul
if not errorlevel 1 (
  bun "scripts\install-full.mjs"
  set "EXITCODE=%errorlevel%"
  goto :finish
)

echo Node.js or Bun is required to run the installer.
echo OpenCode itself needs one of them, so install one first.
set "EXITCODE=1"

:finish
echo.
if not "%EXITCODE%"=="0" echo Installer failed with exit code %EXITCODE%.
if "%~1"=="" pause
exit /b %EXITCODE%

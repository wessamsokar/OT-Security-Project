@echo off
setlocal

cd /d "%~dp0"

echo [ICS] Starting full platform setup and run...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-platform.ps1"

if errorlevel 1 (
  echo.
  echo [ICS] Startup failed. Check the messages above.
  pause
  exit /b 1
)

echo.
echo [ICS] Done.
pause

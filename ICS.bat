@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title ICS Platform

rem Keep output readable on Windows terminals.
chcp 65001 >nul 2>&1

call :header
echo [START] Running dev startup script...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-dev.ps1"
if errorlevel 1 (
    echo.
    echo [ERROR] start-dev.ps1 failed.
    pause
    exit /b 1
)
echo.
echo [INFO ] Project is running.
echo [INFO ] Type q then press Enter to STOP containers (images stay cached).
:wait_for_q
set "USER_INPUT="
set /p USER_INPUT="> "
if /I "%USER_INPUT%"=="q" goto shutdown
echo [INFO ] Unknown input. Type q to stop.
goto wait_for_q

:shutdown
echo [STOP ] Stopping containers (compose stop — images/volumes untouched)...
docker compose -f docker-compose.yml -f docker-compose.dev.yml stop
if errorlevel 1 (
    echo [WARN ] Some services may still be running. Check with: docker compose ps
)
echo [DONE ] Containers stopped.
exit /b 0

:header
cls
echo.
echo ==========================================
echo   OT Sentinel AI - ICS Platform
echo   Industrial Cyber Security Platform
echo ==========================================
echo.
exit /b

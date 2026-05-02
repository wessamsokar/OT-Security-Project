@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title ICS Platform

rem Keep output readable on Windows terminals.
chcp 65001 >nul 2>&1

call :header

echo [CHECK] Docker Desktop...
docker info >nul 2>&1
if errorlevel 1 (
    echo [INFO ] Docker is not running. Attempting to start it...
    set DOCKER_EXE=
    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        set DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe
    ) else if exist "%LocalAppData%\Docker\Docker Desktop.exe" (
        set DOCKER_EXE=%LocalAppData%\Docker\Docker Desktop.exe
    )
    if "!DOCKER_EXE!"=="" (
        echo [ERROR] Docker Desktop not found. Please install/start Docker Desktop.
        pause
        exit /b 1
    )
    start "" "!DOCKER_EXE!"
    echo [WAIT ] Waiting for Docker to start...
    :wait_docker
    timeout /t 4 /nobreak >nul
    docker info >nul 2>&1
    if errorlevel 1 goto wait_docker
)
echo [  OK ] Docker is running.

echo [CHECK] Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [WARN ] Node.js not found. Frontend dev server may not work.
) else (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do echo [  OK ] Node.js %%v
)

echo [CHECK] Docker Compose...
docker compose version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Compose not found.
    pause
    exit /b 1
)
echo [  OK ] Docker Compose ready.

if not exist ".env" (
    echo [INFO ] No .env found. Copying from .env.example
    copy /Y ".env.example" ".env" >nul
)

echo.
echo [START] Building and starting all services (hot-reload mode)...
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build ^
    postgres redis ml-service backend backend-worker frontend-dev gateway
if errorlevel 1 (
    echo [ERROR] Failed to start services.
    pause
    exit /b 1
)

echo [MIGRT] Running database migrations...
timeout /t 5 /nobreak >nul
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T backend alembic upgrade head
if errorlevel 1 (
    echo [WARN ] Migration had issues. Check backend logs.
)

echo [SEED ] Ensuring default dev users/data are present...
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T backend python seed_data.py
if errorlevel 1 (
    echo [WARN ] Seed step had issues. Login may fail until fixed.
)

echo [WAIT ] Waiting for platform to be ready...
:wait_health
timeout /t 3 /nobreak >nul
curl -sf http://localhost:8080/healthz >nul 2>&1
if errorlevel 1 goto wait_health
echo [  OK ] Platform is healthy

echo.
call :banner
echo.
echo [INFO ] Services running:
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps --format "table {{.Name}}\t{{.Status}}"
echo.
echo [INFO ] Dev services are running in background.
echo [INFO ] Open http://localhost:8080 and keep coding.
echo [INFO ] To stop later, run:
echo [INFO ]   docker compose -f docker-compose.yml -f docker-compose.dev.yml down
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

:banner
echo ==========================================
echo   Platform is UP and READY
echo.
echo   App  -^> http://localhost:8080
echo   API  -^> http://localhost:8080/api/v1
echo   Docs -^> http://localhost:8080/docs
echo.
echo   Default Login : admin / admin123
echo   Backend  : Python hot-reload ON
echo   Frontend : Vite HMR ON
echo ==========================================
exit /b
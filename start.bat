@echo off
chcp 65001 >nul
title ASS Player

echo ========================================
echo        ASS Player Launcher
echo ========================================
echo.

cd /d "%~dp0"

python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python not found!
    echo.
    echo Please install Python 3.7 or higher
    echo Download: https://www.python.org/downloads/
    echo.
    echo Remember to check "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

echo Starting ASS Player...
echo Please wait...
echo.

python start.py

if errorlevel 1 (
    echo.
    echo Startup failed, please check error messages above
    pause
)
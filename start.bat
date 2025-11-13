@echo off
chcp 65001 >nul
title ASS Player

echo ========================================
echo        ASS Player Launcher
echo ========================================
echo.

cd /d "%~dp0"

set "PY312=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"

REM 优先使用已装依赖的 Python 3.12，其次回退到默认 python
set "PYEXE="
if exist "%PY312%" (
    set "PYEXE=%PY312%"
) else (
    where python >nul 2>&1
    if %errorlevel% equ 0 (
        for /f "delims=" %%i in ('where python ^| findstr /i /v pythonw.exe') do (
            set "PYEXE=%%i"
            goto :found
        )
    )
)

:found
if not defined PYEXE (
    echo Error: Python not found!
    echo.
    echo Please install Python 3.9 or higher
    echo Download: https://www.python.org/downloads/
    echo.
    echo Remember to check "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

echo Using Python: %PYEXE%
"%PYEXE%" -m pip show flask >nul 2>&1
if %errorlevel% neq 0 (
    echo Flask not found in this Python. Installing requirements...
    "%PYEXE%" -m pip install -r requirements.txt
)

echo Starting ASS Player...
echo Please wait...
echo.

"%PYEXE%" start.py

if errorlevel 1 (
    echo.
    echo Startup failed, please check error messages above
    pause
)
@echo off
chcp 65001 >nul 2>nul
title OPI Audio Generator
echo ========================================
echo  OPI 1-16 Audio Generator
echo ========================================
echo.

REM Find Python
set PYTHON=
for %%p in (python python3 py) do (
    %%p --version >nul 2>nul
    if not errorlevel 1 (
        set PYTHON=%%p
        goto found
    )
)

:found
if "%PYTHON%"=="" (
    echo ERROR: Python not found!
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

echo Python: %PYTHON%

REM Install edge-tts
echo.
echo Installing edge-tts...
%PYTHON% -m pip install edge-tts
if errorlevel 1 (
    echo Installation failed. Check internet connection.
    pause
    exit /b 1
)

REM Generate audio
echo.
echo ========================================
echo Generating audio files...
echo ========================================
cd /d "%~dp0"
%PYTHON% generate_all_opi_audio.py

echo.
echo ========================================
if errorlevel 1 (
    echo ERROR: Generation failed
) else (
    echo DONE! Audio files saved to:
    echo   src/assets/audio/part5_opi/
)
echo ========================================
pause

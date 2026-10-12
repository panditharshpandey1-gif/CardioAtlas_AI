@echo off
setlocal
cd /d "%~dp0"

rem 1. Check for dedicated project virtualenv python executable first
if exist "%~dp0.venv\Scripts\python.exe" (
    if exist "%~dp0.venv\Scripts\activate.bat" call "%~dp0.venv\Scripts\activate.bat" >nul 2>nul
    set "PYTHON_EXE="%~dp0.venv\Scripts\python.exe""
    goto :run_launcher
)
if exist "%~dp0venv\Scripts\python.exe" (
    if exist "%~dp0venv\Scripts\activate.bat" call "%~dp0venv\Scripts\activate.bat" >nul 2>nul
    set "PYTHON_EXE="%~dp0venv\Scripts\python.exe""
    goto :run_launcher
)

rem 2. Check for python in PATH
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PYTHON_EXE=python"
    goto :run_launcher
)

rem 3. Check for Python launcher 'py'
where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PYTHON_EXE=py -3"
    goto :run_launcher
)

echo.
echo [ERROR] Neither 'python' nor 'py' was found in PATH.
echo Please install Python 3.10+ from https://www.python.org/
pause
exit /b 1

:run_launcher
%PYTHON_EXE% run.py %*
set "EXIT_CODE=%ERRORLEVEL%"

if %EXIT_CODE% neq 0 (
    echo.
    echo [ERROR] Launcher exited with error code %EXIT_CODE%.
    pause
)

exit /b %EXIT_CODE%


@echo off
setlocal
cd /d "%~dp0"
title JARVIS - Clean Install
echo Cleaning previous (broken) install...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json
echo.
echo Installing dependencies (npm 12 install scripts are pre-approved in package.json)...
call npm install
if errorlevel 1 goto :fail
echo.
echo Verifying...
call npm run doctor
call npm run build
if errorlevel 1 goto :fail
echo.
echo DONE. Start JARVIS with: npm run dev   (or RUN-JARVIS.bat)
pause
exit /b 0
:fail
echo.
echo Install failed. Read the error above.
pause
exit /b 1

@echo off
setlocal
cd /d "%~dp0"
title JARVIS - Desktop
echo ========================================
echo       JARVIS DESKTOP ASSISTANT
echo ========================================
echo.
echo Node:
node -v
echo.
call npm run dev
if errorlevel 1 (
  echo.
  echo JARVIS stopped. Read the error above.
  pause
)

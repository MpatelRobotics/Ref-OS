@echo off
REM Ref OS Venue Server - Windows launcher. Double-click, or run from Command Prompt.
REM Optional settings (remove REM to change):
REM   set PORT=8080
REM   set REFOS_VENUE_DATA=C:\RefOS-Venue\data
REM   set REFOS_WEB_ROOT=C:\Users\%USERNAME%\Downloads\Ref-os\dist
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Install Node.js 22 LTS or 24 LTS from https://nodejs.org and try again. & pause & exit /b 1)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" || (echo This needs Node.js 22.13 or newer. Installed: & node --version & echo Install Node.js 22 LTS or 24 LTS from https://nodejs.org & pause & exit /b 1)
node --no-warnings server.mjs
pause

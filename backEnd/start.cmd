@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo Starting Next Class server...
start "" http://localhost:3000
node backEnd\server.js
pause

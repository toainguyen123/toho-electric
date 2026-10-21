@echo off
chcp 65001 >nul
title TOHO ADMIN - Server Quan Tri
cd /d "%~dp0"

echo ============================================
echo   TOHO ELECTRIC - SERVER ADMIN + WEBSITE
echo ============================================
echo.

where node >nul 2>nul
if not %errorlevel%==0 (
    echo [LOI] Can cai dat Node.js truoc! tai nodejs.org
    pause
    goto :eof
)

start "" http://localhost:8120/admin.html
echo Dang chay server tai http://localhost:8120 ...
echo Gioi thieu: cua so nay tac server - tat cua so = tat server
node server.js

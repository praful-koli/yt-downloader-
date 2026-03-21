@echo off
echo.
echo  ================================
echo    YTGrab Helper Server
echo  ================================
echo.
echo  Starting... keep this window open!
echo  while using the extension.
echo.
cd /d "%~dp0"
node server.js
pause

@echo off
title Personal Assistant - Digest
cd /d "%~dp0"
echo Making your digest. It will also be sent to your Telegram bot...
echo.
call npm run digest --silent
echo.
pause

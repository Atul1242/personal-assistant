@echo off
title Personal Assistant
cd /d "%~dp0"
echo Personal Assistant is starting. Send /digest to your Telegram bot.
echo Close this window or send /stop to the bot to turn it off.
echo.
call npm start --silent

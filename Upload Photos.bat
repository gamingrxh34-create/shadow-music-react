@echo off
title Shadow Music — Update Photos & Covers
color 0A
echo ======================================================
echo       SHADOW MUSIC - PHOTO & COVER UPDATER
echo ======================================================
echo.
echo Updating artist portraits and song covers...
echo.

cd /d "%~dp0"
call npm run update-photos

echo.
echo ======================================================
echo Finished updating photos!
echo ======================================================
pause

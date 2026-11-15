@echo off
title Shadow Music - Update Photos and Covers
color 0A
echo ======================================================
echo       SHADOW MUSIC - PHOTO AND COVER UPDATER
echo ======================================================
echo.
echo Updating artist portraits and song covers...
echo.

cd /d "C:\Users\sharm\OneDrive\Desktop\Shadow music\shadow-music-react"
call npm run update-photos

echo.
echo ======================================================
echo Finished updating photos!
echo ======================================================
pause

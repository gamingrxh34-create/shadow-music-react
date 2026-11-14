@echo off
title Shadow Music — Automated Music Ingestion
color 0B
echo ======================================================
echo       SHADOW MUSIC - AUTOMATED MUSIC INGESTION
echo ======================================================
echo.
echo Processing files in music_staging/songs...
echo.

cd /d "%~dp0"
call npm run ingest

echo.
echo ======================================================
echo Processing finished.
echo ======================================================
pause

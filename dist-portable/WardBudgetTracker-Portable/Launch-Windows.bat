@echo off
REM Ward Budget Tracker — portable launcher (Windows)
REM Opens the app in your default browser. Fully offline.
cd /d %~dp0
start "" "%~dp0app\index.html"
exit

@echo off
title BoatBuild CRM Server
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "start-server.ps1"
pause

@echo off
title TrustLedger Deployment Launcher
echo Launching TrustLedger Services...
powershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"
pause

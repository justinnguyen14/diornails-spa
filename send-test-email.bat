@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "CODEX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

cd /d "%PROJECT_DIR%"

where node >nul 2>nul
if %errorlevel%==0 (
  node test-resend-email.js
  goto :end
)

if exist "%CODEX_NODE%" (
  "%CODEX_NODE%" test-resend-email.js
  goto :end
)

echo Node.js was not found on this computer.
echo Install Node.js from https://nodejs.org, then run this file again.
pause

:end
endlocal

@echo off
rem git askpass helper: outputs username or password based on prompt text.
rem Password is provided via environment variable GIT_PASS (never on command line).
echo %* | findstr /I "Username" >nul
if %errorlevel%==0 (
  echo %GIT_USER%
) else (
  echo %GIT_PASS%
)

@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "INPUT_ERROR=21"
set "PATH_ERROR=22"
set "BACKUP_ERROR=23"
set "COPY_ERROR=24"

call :print_stop_notice

call :resolve_source_jar "%~1"
if errorlevel 1 exit /b %ERRORLEVEL%

call :resolve_app_home
if errorlevel 1 exit /b %ERRORLEVEL%

set "BACKEND_DIR=%APP_HOME_RESOLVED%\app\backend"
set "TARGET_JAR=%BACKEND_DIR%\mental-health-app.jar"
set "BACKUP_DIR=%APP_HOME_RESOLVED%\backups\release"
set "TEMP_JAR=%BACKEND_DIR%\mental-health-app.jar.deploy.%RANDOM%%RANDOM%.tmp"
set "BACKUP_JAR="
set "TARGET_ATTR="

if not exist "%BACKEND_DIR%\." (
  echo [deploy-backend] Path error: backend directory not found: "%BACKEND_DIR%"
  exit /b %PATH_ERROR%
)

if exist "%TARGET_JAR%" for %%I in ("%TARGET_JAR%") do set "TARGET_ATTR=%%~aI"
if /i "%TARGET_ATTR:~0,1%"=="d" (
  echo [deploy-backend] Path error: target jar path is a directory: "%TARGET_JAR%"
  exit /b %PATH_ERROR%
)

if exist "%TARGET_JAR%" (
  call :backup_current_target
  if errorlevel 1 exit /b %ERRORLEVEL%
)

copy /b /y "%SOURCE_JAR%" "%TEMP_JAR%" >nul
if errorlevel 1 (
  if exist "%TEMP_JAR%" del /f /q "%TEMP_JAR%" >nul 2>nul
  echo [deploy-backend] File copy failure: failed to copy new jar to temporary file.
  exit /b %COPY_ERROR%
)

if not exist "%TEMP_JAR%" (
  echo [deploy-backend] File copy failure: temporary jar was not created: "%TEMP_JAR%"
  exit /b %COPY_ERROR%
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "Move-Item -LiteralPath $env:TEMP_JAR -Destination $env:TARGET_JAR -Force"

set "MOVE_EXIT_CODE=%ERRORLEVEL%"
if not "%MOVE_EXIT_CODE%"=="0" (
  if exist "%TEMP_JAR%" del /f /q "%TEMP_JAR%" >nul 2>nul
  echo [deploy-backend] File copy failure: failed to replace target jar: "%TARGET_JAR%"
  exit /b %COPY_ERROR%
)

if not exist "%TARGET_JAR%" (
  echo [deploy-backend] File copy failure: target jar was not created: "%TARGET_JAR%"
  exit /b %COPY_ERROR%
)

echo [deploy-backend] source jar: "%SOURCE_JAR%"
echo [deploy-backend] target jar: "%TARGET_JAR%"
if defined BACKUP_JAR (
  echo [deploy-backend] backup jar: "%BACKUP_JAR%"
) else (
  echo [deploy-backend] backup jar: none
)

exit /b 0

:backup_current_target
call :build_backup_timestamp
if errorlevel 1 (
  echo [deploy-backend] Backup failure: timestamp generation failed.
  exit /b %BACKUP_ERROR%
)

if not exist "%BACKUP_DIR%\." mkdir "%BACKUP_DIR%" >nul 2>nul
if not exist "%BACKUP_DIR%\." (
  echo [deploy-backend] Backup failure: backup directory unavailable: "%BACKUP_DIR%"
  exit /b %BACKUP_ERROR%
)

set "BACKUP_JAR=%BACKUP_DIR%\mental-health-app-%BACKUP_TIMESTAMP%.jar"
if exist "%BACKUP_JAR%" (
  echo [deploy-backend] Backup failure: backup target already exists: "%BACKUP_JAR%"
  exit /b %BACKUP_ERROR%
)

copy /b /y "%TARGET_JAR%" "%BACKUP_JAR%" >nul
if errorlevel 1 (
  if exist "%BACKUP_JAR%" del /f /q "%BACKUP_JAR%" >nul 2>nul
  echo [deploy-backend] Backup failure: failed to copy current backend jar to release backup.
  exit /b %BACKUP_ERROR%
)

if not exist "%BACKUP_JAR%" (
  echo [deploy-backend] Backup failure: backup jar was not created: "%BACKUP_JAR%"
  exit /b %BACKUP_ERROR%
)

exit /b 0

:resolve_source_jar
set "SOURCE_JAR="
set "SOURCE_ATTR="
if not "%~1"=="" set "SOURCE_JAR=%~1"
if not defined SOURCE_JAR if defined RELEASE_JAR_PATH set "SOURCE_JAR=%RELEASE_JAR_PATH%"

if not defined SOURCE_JAR (
  echo [deploy-backend] Input missing: specify source jar as argument 1 or RELEASE_JAR_PATH.
  exit /b %INPUT_ERROR%
)

for %%I in ("%SOURCE_JAR%") do set "SOURCE_JAR=%%~fI"
for %%I in ("%SOURCE_JAR%") do set "SOURCE_ATTR=%%~aI"

if /i "%SOURCE_ATTR:~0,1%"=="d" (
  echo [deploy-backend] Input missing: source jar path points to a directory: "%SOURCE_JAR%"
  exit /b %INPUT_ERROR%
)

if not exist "%SOURCE_JAR%" (
  echo [deploy-backend] Input missing: source jar not found: "%SOURCE_JAR%"
  exit /b %INPUT_ERROR%
)

exit /b 0

:print_stop_notice
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$message = [string]::Concat([char]0xBC31,[char]0xC5D4,[char]0xB4DC,' ',[char]0xD504,[char]0xB85C,[char]0xC138,[char]0xC2A4,[char]0xB97C,' ',[char]0xBA3C,[char]0xC800,' ',[char]0xC911,[char]0xC9C0,[char]0xD558,[char]0xB77C);" ^
  "Write-Output ('[deploy-backend] Stop the backend process first. (' + $message + ')')"
if errorlevel 1 echo [deploy-backend] Stop the backend process first.
exit /b 0

:resolve_app_home
set "APP_HOME_RESOLVED="

if defined APP_HOME (
  for %%I in ("%APP_HOME%") do set "APP_HOME_RESOLVED=%%~fI"
) else (
  for %%I in ("%~dp0..") do set "APP_HOME_RESOLVED=%%~fI"
)

if not defined APP_HOME_RESOLVED (
  echo [deploy-backend] Path error: failed to resolve APP_HOME.
  exit /b %PATH_ERROR%
)

exit /b 0

:build_backup_timestamp
set "BACKUP_TIMESTAMP="
for /f "usebackq delims=" %%I in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[DateTime]::Now.ToString('yyyyMMdd-HHmmss')"`) do set "BACKUP_TIMESTAMP=%%I"

if not defined BACKUP_TIMESTAMP exit /b 1
exit /b 0

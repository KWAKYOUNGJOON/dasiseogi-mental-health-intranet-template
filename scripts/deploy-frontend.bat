@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "SOURCE_PATH_ERROR=31"
set "TARGET_PATH_ERROR=32"
set "BACKUP_ERROR=33"
set "COPY_ERROR=34"

call :print_notice

call :resolve_source_dist "%~1"
if errorlevel 1 exit /b %ERRORLEVEL%

call :resolve_app_home
if errorlevel 1 exit /b %ERRORLEVEL%

set "FRONTEND_DIR=%APP_HOME_RESOLVED%\app\frontend"
set "TARGET_DIST=%FRONTEND_DIR%\dist"
set "BACKUP_DIR=%APP_HOME_RESOLVED%\backups\release"
set "TEMP_DIST=%FRONTEND_DIR%\dist.deploy.%RANDOM%%RANDOM%.tmp"
set "BACKUP_PATH="
set "TARGET_ATTR="

if not exist "%FRONTEND_DIR%\." (
  echo [deploy-frontend] Target path error: frontend directory not found: "%FRONTEND_DIR%"
  exit /b %TARGET_PATH_ERROR%
)

if exist "%TARGET_DIST%" for %%I in ("%TARGET_DIST%") do set "TARGET_ATTR=%%~aI"
if exist "%TARGET_DIST%" if /i not "%TARGET_ATTR:~0,1%"=="d" (
  echo [deploy-frontend] Target path error: target dist path is not a directory: "%TARGET_DIST%"
  exit /b %TARGET_PATH_ERROR%
)

if exist "%TARGET_DIST%" (
  call :backup_current_target
  if errorlevel 1 exit /b %ERRORLEVEL%
)

if exist "%TEMP_DIST%" (
  echo [deploy-frontend] Copy failure: temporary dist path already exists: "%TEMP_DIST%"
  exit /b %COPY_ERROR%
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "Copy-Item -LiteralPath $env:SOURCE_DIST -Destination $env:TEMP_DIST -Recurse -Force"

set "COPY_TEMP_EXIT_CODE=%ERRORLEVEL%"
if not "%COPY_TEMP_EXIT_CODE%"=="0" (
  call :cleanup_temp_dist
  echo [deploy-frontend] Copy failure: failed to copy source dist to temporary directory.
  exit /b %COPY_ERROR%
)

if not exist "%TEMP_DIST%\." (
  echo [deploy-frontend] Copy failure: temporary dist directory was not created: "%TEMP_DIST%"
  exit /b %COPY_ERROR%
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "if (Test-Path -LiteralPath $env:TARGET_DIST) { Remove-Item -LiteralPath $env:TARGET_DIST -Recurse -Force };" ^
  "Move-Item -LiteralPath $env:TEMP_DIST -Destination $env:TARGET_DIST -Force"

set "REPLACE_EXIT_CODE=%ERRORLEVEL%"
if not "%REPLACE_EXIT_CODE%"=="0" (
  if exist "%TARGET_DIST%\." (
    echo [deploy-frontend] Copy failure: failed to replace target dist cleanly: "%TARGET_DIST%"
  ) else (
    echo [deploy-frontend] Copy failure: failed to replace target dist: "%TARGET_DIST%"
  )
  exit /b %COPY_ERROR%
)

if not exist "%TARGET_DIST%\." (
  echo [deploy-frontend] Copy failure: target dist directory was not created: "%TARGET_DIST%"
  exit /b %COPY_ERROR%
)

echo [deploy-frontend] source dist: "%SOURCE_DIST%"
echo [deploy-frontend] target dist: "%TARGET_DIST%"
if defined BACKUP_PATH (
  echo [deploy-frontend] backup path: "%BACKUP_PATH%"
) else (
  echo [deploy-frontend] backup path: none
)

exit /b 0

:backup_current_target
call :build_backup_timestamp
if errorlevel 1 (
  echo [deploy-frontend] Backup failure: timestamp generation failed.
  exit /b %BACKUP_ERROR%
)

if not exist "%BACKUP_DIR%\." mkdir "%BACKUP_DIR%" >nul 2>nul
if not exist "%BACKUP_DIR%\." (
  echo [deploy-frontend] Backup failure: backup directory unavailable: "%BACKUP_DIR%"
  exit /b %BACKUP_ERROR%
)

set "BACKUP_PATH=%BACKUP_DIR%\frontend-dist-%BACKUP_TIMESTAMP%"
if exist "%BACKUP_PATH%" (
  echo [deploy-frontend] Backup failure: backup target already exists: "%BACKUP_PATH%"
  exit /b %BACKUP_ERROR%
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "Copy-Item -LiteralPath $env:TARGET_DIST -Destination $env:BACKUP_PATH -Recurse -Force"

set "BACKUP_COPY_EXIT_CODE=%ERRORLEVEL%"
if not "%BACKUP_COPY_EXIT_CODE%"=="0" (
  call :cleanup_backup_path
  echo [deploy-frontend] Backup failure: failed to copy current dist to release backup.
  exit /b %BACKUP_ERROR%
)

if not exist "%BACKUP_PATH%\." (
  echo [deploy-frontend] Backup failure: backup directory was not created: "%BACKUP_PATH%"
  exit /b %BACKUP_ERROR%
)

exit /b 0

:resolve_source_dist
set "SOURCE_DIST="
set "SOURCE_ATTR="
if not "%~1"=="" set "SOURCE_DIST=%~1"
if not defined SOURCE_DIST if defined RELEASE_FRONTEND_DIST_PATH set "SOURCE_DIST=%RELEASE_FRONTEND_DIST_PATH%"

if not defined SOURCE_DIST (
  echo [deploy-frontend] Source path error: specify source dist as argument 1 or RELEASE_FRONTEND_DIST_PATH.
  exit /b %SOURCE_PATH_ERROR%
)

for %%I in ("%SOURCE_DIST%") do set "SOURCE_DIST=%%~fI"
for %%I in ("%SOURCE_DIST%") do set "SOURCE_ATTR=%%~aI"

if not exist "%SOURCE_DIST%" (
  echo [deploy-frontend] Source path error: source dist not found: "%SOURCE_DIST%"
  exit /b %SOURCE_PATH_ERROR%
)

if /i not "%SOURCE_ATTR:~0,1%"=="d" (
  echo [deploy-frontend] Source path error: source dist path is not a directory: "%SOURCE_DIST%"
  exit /b %SOURCE_PATH_ERROR%
)

exit /b 0

:print_notice
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$message = [string]::Concat([char]0xD504,[char]0xB860,[char]0xD2B8,' ',[char]0xC815,[char]0xC801,' ',[char]0xD30C,[char]0xC77C,[char]0xC744,' ',[char]0xC0AC,[char]0xC6A9,[char]0xD558,[char]0xB294,' ',[char]0xC6F9,[char]0xC11C,[char]0xBC84,' ',[char]0xBC18,[char]0xC601,' ',[char]0xBC29,[char]0xC2DD,[char]0xC740,' ',[char]0xBCC4,[char]0xB3C4,' ',[char]0xC6B4,[char]0xC601,' ',[char]0xC808,[char]0xCC28,[char]0xB97C,' ',[char]0xB530,[char]0xB974,[char]0xB77C);" ^
  "Write-Output ('[deploy-frontend] Follow the separate web server rollout procedure for static files. (' + $message + ')')"
if errorlevel 1 echo [deploy-frontend] Follow the separate web server rollout procedure for static files.
exit /b 0

:resolve_app_home
set "APP_HOME_RESOLVED="

if defined APP_HOME (
  for %%I in ("%APP_HOME%") do set "APP_HOME_RESOLVED=%%~fI"
) else (
  for %%I in ("%~dp0..") do set "APP_HOME_RESOLVED=%%~fI"
)

if not defined APP_HOME_RESOLVED (
  echo [deploy-frontend] Target path error: failed to resolve APP_HOME.
  exit /b %TARGET_PATH_ERROR%
)

exit /b 0

:build_backup_timestamp
set "BACKUP_TIMESTAMP="
for /f "usebackq delims=" %%I in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[DateTime]::Now.ToString('yyyyMMdd-HHmmss')"`) do set "BACKUP_TIMESTAMP=%%I"

if not defined BACKUP_TIMESTAMP exit /b 1
exit /b 0

:cleanup_temp_dist
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'SilentlyContinue';" ^
  "if (Test-Path -LiteralPath $env:TEMP_DIST) { Remove-Item -LiteralPath $env:TEMP_DIST -Recurse -Force }" >nul 2>nul
exit /b 0

:cleanup_backup_path
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'SilentlyContinue';" ^
  "if (Test-Path -LiteralPath $env:BACKUP_PATH) { Remove-Item -LiteralPath $env:BACKUP_PATH -Recurse -Force }" >nul 2>nul
exit /b 0

@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "INPUT_ERROR=21"
set "PATH_ERROR=22"
set "BACKUP_ERROR=23"
set "DEPLOY_ERROR=24"
set "VERIFY_ERROR=25"

call :resolve_source_dist "%~1"
if errorlevel 1 exit /b %ERRORLEVEL%

call :resolve_app_home
if errorlevel 1 exit /b %ERRORLEVEL%

call :build_deploy_timestamp
if errorlevel 1 (
  echo [deploy-frontend] Deploy failure: timestamp generation failed.
  exit /b %DEPLOY_ERROR%
)

set "TARGET_PARENT=%APP_HOME_RESOLVED%\app\frontend"
set "TARGET_DIST=%TARGET_PARENT%\dist"
set "BACKUP_ROOT=%APP_HOME_RESOLVED%\backups\release"
set "BACKUP_DIST=%BACKUP_ROOT%\frontend-dist-%DEPLOY_TIMESTAMP%"
set "TEMP_ROOT=%APP_HOME_RESOLVED%\temp"
set "TEMP_DIST=%TEMP_ROOT%\deploy-frontend-%DEPLOY_TIMESTAMP%"
set "STAGED_OLD_DIST=%TARGET_PARENT%\dist.previous.%DEPLOY_TIMESTAMP%.old"
set "BACKUP_SUMMARY=backup skipped"
set "DEPLOYED_INDEX_HTML=%TARGET_DIST%\index.html"

call :print_scope_notice

call :ensure_directory "%TARGET_PARENT%" "Path error" %PATH_ERROR%
if errorlevel 1 exit /b %ERRORLEVEL%

call :ensure_directory "%TEMP_ROOT%" "Path error" %PATH_ERROR%
if errorlevel 1 exit /b %ERRORLEVEL%

call :validate_target_dist_path
if errorlevel 1 exit /b %ERRORLEVEL%

call :ensure_path_absent "%TEMP_DIST%" "Deploy failure" %DEPLOY_ERROR%
if errorlevel 1 exit /b %ERRORLEVEL%

call :ensure_path_absent "%STAGED_OLD_DIST%" "Deploy failure" %DEPLOY_ERROR%
if errorlevel 1 exit /b %ERRORLEVEL%

if exist "%TARGET_DIST%\." (
  call :ensure_directory "%BACKUP_ROOT%" "Backup failure" %BACKUP_ERROR%
  if errorlevel 1 exit /b %ERRORLEVEL%
  call :backup_existing_dist
  if errorlevel 1 exit /b %ERRORLEVEL%
  set "BACKUP_SUMMARY=%BACKUP_DIST%"
)

call :copy_source_to_temp
if errorlevel 1 exit /b %ERRORLEVEL%

call :replace_target_dist
if errorlevel 1 exit /b %ERRORLEVEL%

call :verify_deployed_dist
if errorlevel 1 exit /b %ERRORLEVEL%

echo [deploy-frontend] Deployment completed.
echo [deploy-frontend] app home: "%APP_HOME_RESOLVED%"
echo [deploy-frontend] source dist path: "%SOURCE_DIST%"
if /i "%BACKUP_SUMMARY%"=="backup skipped" (
  echo [deploy-frontend] backup dist path: backup skipped
) else (
  echo [deploy-frontend] backup dist path: "%BACKUP_SUMMARY%"
)
echo [deploy-frontend] temp path: "%TEMP_DIST%"
echo [deploy-frontend] deployed dist path: "%TARGET_DIST%"
echo [deploy-frontend] deployed index.html path: "%DEPLOYED_INDEX_HTML%"
exit /b 0

:print_scope_notice
echo [deploy-frontend] Scope: frontend dist placement only. This script does not restart web servers, change IIS/Nginx settings, start or stop services, call health checks, or guarantee cache invalidation.
exit /b 0

:resolve_source_dist
set "SOURCE_DIST="
set "SOURCE_ATTR="

if "%~1"=="" (
  echo [deploy-frontend] Input error: specify source dist directory path as argument 1.
  exit /b %INPUT_ERROR%
)

for %%I in ("%~1") do (
  set "SOURCE_DIST=%%~fI"
  set "SOURCE_ATTR=%%~aI"
)

if not exist "%SOURCE_DIST%" (
  echo [deploy-frontend] Input error: source dist not found: "%SOURCE_DIST%"
  exit /b %INPUT_ERROR%
)

if /i not "%SOURCE_ATTR:~0,1%"=="d" (
  echo [deploy-frontend] Input error: source dist path is not a directory: "%SOURCE_DIST%"
  exit /b %INPUT_ERROR%
)

call :validate_required_file "%SOURCE_DIST%\index.html" "Input error" %INPUT_ERROR%
if errorlevel 1 exit /b %ERRORLEVEL%

exit /b 0

:resolve_app_home
set "APP_HOME_RESOLVED="

if defined APP_HOME (
  for %%I in ("%APP_HOME%") do set "APP_HOME_RESOLVED=%%~fI"
) else (
  for %%I in ("%~dp0..") do set "APP_HOME_RESOLVED=%%~fI"
)

if not defined APP_HOME_RESOLVED (
  echo [deploy-frontend] Path error: failed to resolve app home.
  exit /b %PATH_ERROR%
)

if exist "%APP_HOME_RESOLVED%" if not exist "%APP_HOME_RESOLVED%\." (
  echo [deploy-frontend] Path error: app home is not a directory: "%APP_HOME_RESOLVED%"
  exit /b %PATH_ERROR%
)

exit /b 0

:ensure_directory
set "ENSURE_DIR_PATH=%~1"
set "ENSURE_DIR_PREFIX=%~2"
set "ENSURE_DIR_EXIT=%~3"

if exist "%ENSURE_DIR_PATH%" (
  if not exist "%ENSURE_DIR_PATH%\." (
    echo [deploy-frontend] %ENSURE_DIR_PREFIX%: path is not a directory: "%ENSURE_DIR_PATH%"
    exit /b %ENSURE_DIR_EXIT%
  )
) else (
  mkdir "%ENSURE_DIR_PATH%" >nul 2>nul
  if errorlevel 1 (
    echo [deploy-frontend] %ENSURE_DIR_PREFIX%: failed to create directory: "%ENSURE_DIR_PATH%"
    exit /b %ENSURE_DIR_EXIT%
  )
  if not exist "%ENSURE_DIR_PATH%\." (
    echo [deploy-frontend] %ENSURE_DIR_PREFIX%: failed to create directory: "%ENSURE_DIR_PATH%"
    exit /b %ENSURE_DIR_EXIT%
  )
)

exit /b 0

:ensure_path_absent
if exist "%~1" (
  echo [deploy-frontend] %~2: path already exists: "%~1"
  exit /b %~3
)
exit /b 0

:validate_required_file
set "REQUIRED_FILE_PATH=%~1"
set "REQUIRED_FILE_PREFIX=%~2"
set "REQUIRED_FILE_EXIT=%~3"
set "REQUIRED_FILE_ATTR="

if not exist "%REQUIRED_FILE_PATH%" (
  echo [deploy-frontend] %REQUIRED_FILE_PREFIX%: required file not found: "%REQUIRED_FILE_PATH%"
  exit /b %REQUIRED_FILE_EXIT%
)

for %%I in ("%REQUIRED_FILE_PATH%") do set "REQUIRED_FILE_ATTR=%%~aI"
if /i "%REQUIRED_FILE_ATTR:~0,1%"=="d" (
  echo [deploy-frontend] %REQUIRED_FILE_PREFIX%: required file path is a directory: "%REQUIRED_FILE_PATH%"
  exit /b %REQUIRED_FILE_EXIT%
)

exit /b 0

:validate_target_dist_path
set "TARGET_ATTR="

if not exist "%TARGET_DIST%" exit /b 0

for %%I in ("%TARGET_DIST%") do set "TARGET_ATTR=%%~aI"
if /i "%TARGET_ATTR:~0,1%"=="d" exit /b 0

echo [deploy-frontend] Path error: deployed dist path exists and is not a directory: "%TARGET_DIST%"
exit /b %PATH_ERROR%

:backup_existing_dist
call :ensure_path_absent "%BACKUP_DIST%" "Backup failure" %BACKUP_ERROR%
if errorlevel 1 exit /b %ERRORLEVEL%

robocopy "%TARGET_DIST%" "%BACKUP_DIST%" /E /COPY:DAT /DCOPY:DAT /R:0 /W:0 /NFL /NDL /NJH /NJS /NP >nul
set "ROBOCOPY_EXIT=%ERRORLEVEL%"
if %ROBOCOPY_EXIT% GEQ 8 (
  call :cleanup_directory "%BACKUP_DIST%"
  echo [deploy-frontend] Backup failure: failed to copy existing dist to backup path. robocopy exit=%ROBOCOPY_EXIT%.
  exit /b %BACKUP_ERROR%
)

if not exist "%BACKUP_DIST%\." (
  echo [deploy-frontend] Backup failure: backup directory was not created: "%BACKUP_DIST%"
  exit /b %BACKUP_ERROR%
)

exit /b 0

:copy_source_to_temp
robocopy "%SOURCE_DIST%" "%TEMP_DIST%" /E /COPY:DAT /DCOPY:DAT /R:0 /W:0 /NFL /NDL /NJH /NJS /NP >nul
set "ROBOCOPY_EXIT=%ERRORLEVEL%"
if %ROBOCOPY_EXIT% GEQ 8 (
  call :cleanup_directory "%TEMP_DIST%"
  echo [deploy-frontend] Deploy failure: failed to copy source dist to temporary path. robocopy exit=%ROBOCOPY_EXIT%.
  exit /b %DEPLOY_ERROR%
)

if not exist "%TEMP_DIST%\." (
  echo [deploy-frontend] Deploy failure: temporary dist directory was not created: "%TEMP_DIST%"
  exit /b %DEPLOY_ERROR%
)

call :validate_required_file "%TEMP_DIST%\index.html" "Deploy failure" %DEPLOY_ERROR%
if errorlevel 1 (
  call :cleanup_directory "%TEMP_DIST%"
  exit /b %ERRORLEVEL%
)

exit /b 0

:replace_target_dist
if exist "%TARGET_DIST%\." (
  move "%TARGET_DIST%" "%STAGED_OLD_DIST%" >nul
  if errorlevel 1 (
    echo [deploy-frontend] Deploy failure: failed to stage existing dist before replacement: "%TARGET_DIST%"
    exit /b %DEPLOY_ERROR%
  )
)

move "%TEMP_DIST%" "%TARGET_DIST%" >nul
if errorlevel 1 (
  call :restore_staged_target
  echo [deploy-frontend] Deploy failure: failed to move temporary dist into deployed path: "%TARGET_DIST%"
  exit /b %DEPLOY_ERROR%
)

if exist "%STAGED_OLD_DIST%\." rmdir /s /q "%STAGED_OLD_DIST%" >nul 2>nul
if exist "%STAGED_OLD_DIST%\." (
  echo [deploy-frontend] Cleanup notice: staged old dist remains at "%STAGED_OLD_DIST%"
)

exit /b 0

:restore_staged_target
if exist "%TARGET_DIST%\." exit /b 0
if not exist "%STAGED_OLD_DIST%\." exit /b 0

move "%STAGED_OLD_DIST%" "%TARGET_DIST%" >nul
if errorlevel 1 (
  echo [deploy-frontend] Deploy failure: rollback failed. Previous dist remains staged at "%STAGED_OLD_DIST%"
) else (
  echo [deploy-frontend] Deploy failure: previous dist restored after replacement failure.
)
exit /b 0

:verify_deployed_dist
if not exist "%TARGET_DIST%\." (
  echo [deploy-frontend] Verify failure: deployed dist directory was not created: "%TARGET_DIST%"
  exit /b %VERIFY_ERROR%
)

call :validate_required_file "%DEPLOYED_INDEX_HTML%" "Verify failure" %VERIFY_ERROR%
if errorlevel 1 exit /b %ERRORLEVEL%

exit /b 0

:cleanup_directory
if exist "%~1\." rmdir /s /q "%~1" >nul 2>nul
exit /b 0

:build_deploy_timestamp
set "DEPLOY_TIMESTAMP="

call :build_deploy_timestamp_from_env
if errorlevel 1 exit /b 1
exit /b 0

:build_deploy_timestamp_from_env
set "DATE_ORDER="
set "DATE_PART1="
set "DATE_PART2="
set "DATE_PART3="
set "YEAR="
set "MONTH="
set "DAY="
set "HOUR="
set "MINUTE="
set "SECOND="

for /f "tokens=3" %%I in ('reg query "HKCU\Control Panel\International" /v iDate 2^>nul ^| find /i "iDate"') do if not defined DATE_ORDER set "DATE_ORDER=%%I"
if /i "%DATE_ORDER%"=="0x0" set "DATE_ORDER=0"
if /i "%DATE_ORDER%"=="0x1" set "DATE_ORDER=1"
if /i "%DATE_ORDER%"=="0x2" set "DATE_ORDER=2"
if not defined DATE_ORDER set "DATE_ORDER=0"

for /f "tokens=1-4 delims=/-. " %%A in ("%DATE%") do (
  call :append_numeric_date_part "%%~A"
  call :append_numeric_date_part "%%~B"
  call :append_numeric_date_part "%%~C"
  call :append_numeric_date_part "%%~D"
)

if not defined DATE_PART3 exit /b 1

if "%DATE_ORDER%"=="2" (
  set "YEAR=%DATE_PART1%"
  set "MONTH=%DATE_PART2%"
  set "DAY=%DATE_PART3%"
) else if "%DATE_ORDER%"=="1" (
  set "DAY=%DATE_PART1%"
  set "MONTH=%DATE_PART2%"
  set "YEAR=%DATE_PART3%"
) else (
  set "MONTH=%DATE_PART1%"
  set "DAY=%DATE_PART2%"
  set "YEAR=%DATE_PART3%"
)

if "%YEAR:~3,1%"=="" exit /b 1
if not "%YEAR:~4,1%"=="" exit /b 1
for /f "delims=0123456789" %%I in ("%YEAR%") do exit /b 1

call :normalize_two_digits MONTH
if errorlevel 1 exit /b 1
call :normalize_two_digits DAY
if errorlevel 1 exit /b 1

call :validate_two_digit_range MONTH 1 12
if errorlevel 1 exit /b 1
call :validate_two_digit_range DAY 1 31
if errorlevel 1 exit /b 1

for /f "tokens=1-3 delims=:., " %%A in ("%TIME%") do (
  set "HOUR=%%~A"
  set "MINUTE=%%~B"
  set "SECOND=%%~C"
)

call :normalize_two_digits HOUR
if errorlevel 1 exit /b 1
call :normalize_two_digits MINUTE
if errorlevel 1 exit /b 1
call :normalize_two_digits SECOND
if errorlevel 1 exit /b 1

call :validate_two_digit_range HOUR 0 23
if errorlevel 1 exit /b 1
call :validate_two_digit_range MINUTE 0 59
if errorlevel 1 exit /b 1
call :validate_two_digit_range SECOND 0 59
if errorlevel 1 exit /b 1

set "DEPLOY_TIMESTAMP=%YEAR%%MONTH%%DAY%-%HOUR%%MINUTE%%SECOND%"
exit /b 0

:append_numeric_date_part
set "DATE_TOKEN=%~1"
if not defined DATE_TOKEN exit /b 0
for /f "delims=0123456789" %%I in ("%DATE_TOKEN%") do exit /b 0

if not defined DATE_PART1 (
  set "DATE_PART1=%DATE_TOKEN%"
) else if not defined DATE_PART2 (
  set "DATE_PART2=%DATE_TOKEN%"
) else if not defined DATE_PART3 (
  set "DATE_PART3=%DATE_TOKEN%"
)
exit /b 0

:normalize_two_digits
set "TOKEN_NAME=%~1"
set "TOKEN_VALUE="
call set "TOKEN_VALUE=%%%TOKEN_NAME%%%"
if not defined TOKEN_VALUE exit /b 1
for /f "delims=0123456789" %%I in ("%TOKEN_VALUE%") do exit /b 1
if not "%TOKEN_VALUE:~2,1%"=="" exit /b 1
if "%TOKEN_VALUE:~1,1%"=="" set "TOKEN_VALUE=0%TOKEN_VALUE%"
set "%TOKEN_NAME%=%TOKEN_VALUE%"
exit /b 0

:validate_two_digit_range
set "VALUE_NAME=%~1"
set "VALUE_TEXT="
call set "VALUE_TEXT=%%%VALUE_NAME%%%"
if not defined VALUE_TEXT exit /b 1
set /a VALUE_NUM=1%VALUE_TEXT%-100 >nul 2>nul
if errorlevel 1 exit /b 1
if %VALUE_NUM% lss %~2 exit /b 1
if %VALUE_NUM% gtr %~3 exit /b 1
exit /b 0

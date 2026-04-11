@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "INPUT_ERROR=11"
set "PATH_ERROR=12"
set "BACKUP_ERROR=13"
set "DEPLOY_ERROR=14"
set "VERIFY_ERROR=15"

call :resolve_source_jar "%~1"
if errorlevel 1 exit /b %ERRORLEVEL%

call :resolve_app_home
if errorlevel 1 exit /b %ERRORLEVEL%

set "BACKEND_DIR=%APP_HOME_RESOLVED%\app\backend"
set "TARGET_JAR=%BACKEND_DIR%\mental-health-app.jar"
set "BACKUP_DIR=%BACKEND_DIR%\backup"
set "BACKUP_JAR="
set "DEPLOYED_JAR_SIZE="

call :ensure_backend_dir
if errorlevel 1 exit /b %ERRORLEVEL%

call :validate_target_path
if errorlevel 1 exit /b %ERRORLEVEL%

if exist "%TARGET_JAR%" call :backup_existing_target
if errorlevel 1 exit /b %ERRORLEVEL%

call :deploy_new_target
if errorlevel 1 exit /b %ERRORLEVEL%

echo [deploy-backend] Deployment completed.
echo [deploy-backend] app home: "%APP_HOME_RESOLVED%"
echo [deploy-backend] source jar: "%SOURCE_JAR%"
if defined BACKUP_JAR (
  echo [deploy-backend] backup jar path: "%BACKUP_JAR%"
) else (
  echo [deploy-backend] backup jar path: backup skipped
)
echo [deploy-backend] deployed jar path: "%TARGET_JAR%"
echo [deploy-backend] deployed jar size bytes: %DEPLOYED_JAR_SIZE%
exit /b 0

:resolve_source_jar
set "SOURCE_JAR="
set "SOURCE_EXT="
set "SOURCE_ATTR="
set "SOURCE_JAR_SIZE="

if "%~1"=="" (
  echo [deploy-backend] Input error: specify source jar path as argument 1.
  exit /b %INPUT_ERROR%
)

for %%I in ("%~1") do (
  set "SOURCE_JAR=%%~fI"
  set "SOURCE_EXT=%%~xI"
  set "SOURCE_ATTR=%%~aI"
)

if exist "%SOURCE_JAR%" if /i "%SOURCE_ATTR:~0,1%"=="d" (
  echo [deploy-backend] Input error: source jar path points to a directory: "%SOURCE_JAR%"
  exit /b %INPUT_ERROR%
)

if not exist "%SOURCE_JAR%" (
  echo [deploy-backend] Input error: source jar not found: "%SOURCE_JAR%"
  exit /b %INPUT_ERROR%
)

if /i not "%SOURCE_EXT%"==".jar" (
  echo [deploy-backend] Input error: source file extension must be .jar: "%SOURCE_JAR%"
  exit /b %INPUT_ERROR%
)

for %%I in ("%SOURCE_JAR%") do set "SOURCE_JAR_SIZE=%%~zI"
if not defined SOURCE_JAR_SIZE (
  echo [deploy-backend] Input error: failed to read source jar size: "%SOURCE_JAR%"
  exit /b %INPUT_ERROR%
)

exit /b 0

:resolve_app_home
set "APP_HOME_RESOLVED="

if not defined APP_HOME (
  echo [deploy-backend] Path error: APP_HOME is required. Set APP_HOME before running this script.
  exit /b %PATH_ERROR%
)

for %%I in ("%APP_HOME%") do set "APP_HOME_RESOLVED=%%~fI"

if not defined APP_HOME_RESOLVED (
  echo [deploy-backend] Path error: failed to resolve app home.
  exit /b %PATH_ERROR%
)

if exist "%APP_HOME_RESOLVED%" if not exist "%APP_HOME_RESOLVED%\." (
  echo [deploy-backend] Path error: app home is not a directory: "%APP_HOME_RESOLVED%"
  exit /b %PATH_ERROR%
)

exit /b 0

:ensure_backend_dir
if exist "%BACKEND_DIR%" (
  if not exist "%BACKEND_DIR%\." (
    echo [deploy-backend] Path error: backend path is not a directory: "%BACKEND_DIR%"
    exit /b %PATH_ERROR%
  )
) else (
  mkdir "%BACKEND_DIR%" >nul 2>nul
  if errorlevel 1 (
    echo [deploy-backend] Path error: failed to create backend directory: "%BACKEND_DIR%"
    exit /b %PATH_ERROR%
  )
  if not exist "%BACKEND_DIR%\." (
    echo [deploy-backend] Path error: failed to create backend directory: "%BACKEND_DIR%"
    exit /b %PATH_ERROR%
  )
)

exit /b 0

:validate_target_path
set "TARGET_ATTR="

if not exist "%TARGET_JAR%" exit /b 0

for %%I in ("%TARGET_JAR%") do set "TARGET_ATTR=%%~aI"
if /i "%TARGET_ATTR:~0,1%"=="d" (
  echo [deploy-backend] Path error: deployed jar path is a directory: "%TARGET_JAR%"
  exit /b %PATH_ERROR%
)

exit /b 0

:ensure_backup_dir
if exist "%BACKUP_DIR%" (
  if not exist "%BACKUP_DIR%\." (
    echo [deploy-backend] Backup failure: backup path is not a directory: "%BACKUP_DIR%"
    exit /b %BACKUP_ERROR%
  )
) else (
  mkdir "%BACKUP_DIR%" >nul 2>nul
  if errorlevel 1 (
    echo [deploy-backend] Backup failure: failed to create backup directory: "%BACKUP_DIR%"
    exit /b %BACKUP_ERROR%
  )
  if not exist "%BACKUP_DIR%\." (
    echo [deploy-backend] Backup failure: failed to create backup directory: "%BACKUP_DIR%"
    exit /b %BACKUP_ERROR%
  )
)

exit /b 0

:backup_existing_target
call :build_backup_timestamp
if errorlevel 1 (
  echo [deploy-backend] Backup failure: timestamp generation failed.
  exit /b %BACKUP_ERROR%
)

set "BACKUP_JAR=%BACKUP_DIR%\mental-health-app-%BACKUP_TIMESTAMP%.jar"
call :backup_current_target
if errorlevel 1 exit /b %ERRORLEVEL%
exit /b 0

:backup_current_target
set "BACKUP_ATTR="
set "CURRENT_JAR_SIZE="
set "BACKUP_JAR_SIZE="

call :ensure_backup_dir
if errorlevel 1 exit /b %ERRORLEVEL%

if not defined BACKUP_JAR (
  echo [deploy-backend] Backup failure: backup target path was not prepared.
  exit /b %BACKUP_ERROR%
)

call :validate_backup_target
if errorlevel 1 exit /b %ERRORLEVEL%

copy /b /y "%TARGET_JAR%" "%BACKUP_JAR%" >nul
if errorlevel 1 (
  if exist "%BACKUP_JAR%" del /f /q "%BACKUP_JAR%" >nul 2>nul
  echo [deploy-backend] Backup failure: failed to copy current backend jar to backup target.
  exit /b %BACKUP_ERROR%
)

if not exist "%BACKUP_JAR%" (
  echo [deploy-backend] Backup failure: backup jar was not created: "%BACKUP_JAR%"
  exit /b %BACKUP_ERROR%
)

for %%I in ("%TARGET_JAR%") do set "CURRENT_JAR_SIZE=%%~zI"
for %%I in ("%BACKUP_JAR%") do set "BACKUP_JAR_SIZE=%%~zI"

if not "%CURRENT_JAR_SIZE%"=="%BACKUP_JAR_SIZE%" (
  del /f /q "%BACKUP_JAR%" >nul 2>nul
  echo [deploy-backend] Backup failure: backup jar size mismatch. current bytes=%CURRENT_JAR_SIZE%, backup bytes=%BACKUP_JAR_SIZE%.
  exit /b %BACKUP_ERROR%
)

exit /b 0

:validate_backup_target
set "BACKUP_ATTR="

if not exist "%BACKUP_JAR%" exit /b 0

for %%I in ("%BACKUP_JAR%") do set "BACKUP_ATTR=%%~aI"
if /i "%BACKUP_ATTR:~0,1%"=="d" (
  echo [deploy-backend] Backup failure: backup jar path is a directory: "%BACKUP_JAR%"
) else (
  echo [deploy-backend] Backup failure: backup target already exists: "%BACKUP_JAR%"
)
exit /b %BACKUP_ERROR%

:deploy_new_target
set "TARGET_ATTR="
set "DEPLOYED_JAR_SIZE="

copy /b /y "%SOURCE_JAR%" "%TARGET_JAR%" >nul
if errorlevel 1 (
  echo [deploy-backend] Deploy failure: failed to copy source jar to deployed jar path: "%TARGET_JAR%"
  exit /b %DEPLOY_ERROR%
)

if not exist "%TARGET_JAR%" (
  echo [deploy-backend] Deploy failure: deployed jar was not created: "%TARGET_JAR%"
  exit /b %DEPLOY_ERROR%
)

for %%I in ("%TARGET_JAR%") do (
  set "TARGET_ATTR=%%~aI"
  set "DEPLOYED_JAR_SIZE=%%~zI"
)

if /i "%TARGET_ATTR:~0,1%"=="d" (
  echo [deploy-backend] Verify failure: deployed jar path is a directory: "%TARGET_JAR%"
  exit /b %VERIFY_ERROR%
)

if not defined DEPLOYED_JAR_SIZE (
  echo [deploy-backend] Verify failure: failed to read deployed jar size: "%TARGET_JAR%"
  exit /b %VERIFY_ERROR%
)

if not "%SOURCE_JAR_SIZE%"=="%DEPLOYED_JAR_SIZE%" (
  echo [deploy-backend] Verify failure: deployed jar size mismatch. source bytes=%SOURCE_JAR_SIZE%, deployed bytes=%DEPLOYED_JAR_SIZE%.
  exit /b %VERIFY_ERROR%
)

exit /b 0

:build_backup_timestamp
set "BACKUP_TIMESTAMP="

call :build_backup_timestamp_from_env
if errorlevel 1 exit /b 1
exit /b 0

:build_backup_timestamp_from_env
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

set "BACKUP_TIMESTAMP=%YEAR%%MONTH%%DAY%-%HOUR%%MINUTE%%SECOND%"
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

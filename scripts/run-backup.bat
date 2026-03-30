@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Operator-only helper for direct DB dump file creation.
rem This script does not call /api/v1/admin/backups/run, does not write backup_histories,
rem does not stop/start services, and does not create SNAPSHOT backups.
set "REQUIRED_ENV_ERROR=11"
set "DUMP_COMMAND_ERROR=12"
set "BACKUP_PATH_ERROR=13"
set "JDBC_PARSE_ERROR=14"
set "DUMP_EXECUTION_ERROR=15"

call :require_env APP_BACKUP_ROOT_PATH
if errorlevel 1 exit /b %ERRORLEVEL%

call :require_env APP_DB_URL
if errorlevel 1 exit /b %ERRORLEVEL%

call :require_env APP_DB_USERNAME
if errorlevel 1 exit /b %ERRORLEVEL%

call :require_env APP_DB_PASSWORD
if errorlevel 1 exit /b %ERRORLEVEL%

call :resolve_backup_root "%APP_BACKUP_ROOT_PATH%"
if errorlevel 1 exit /b %ERRORLEVEL%

if defined APP_DB_DUMP_COMMAND (
  call :resolve_dump_command "%APP_DB_DUMP_COMMAND%"
  if errorlevel 1 (
    echo [run-backup] Tool failure: APP_DB_DUMP_COMMAND could not be resolved: %APP_DB_DUMP_COMMAND%
    exit /b %DUMP_COMMAND_ERROR%
  )
) else (
  call :resolve_dump_command "mariadb-dump.exe"
  if errorlevel 1 call :resolve_dump_command "mysqldump.exe"
  if errorlevel 1 (
    echo [run-backup] Tool failure: mariadb-dump.exe or mysqldump.exe was not found in PATH.
    exit /b %DUMP_COMMAND_ERROR%
  )
)

call :parse_jdbc_url
if errorlevel 1 exit /b %ERRORLEVEL%

call :build_backup_target
if errorlevel 1 exit /b %ERRORLEVEL%

call :run_dump_command
if errorlevel 1 exit /b %ERRORLEVEL%

if not exist "%BACKUP_FILE_PATH%" (
  echo [run-backup] Dump execution failure: output file was not created.
  exit /b %DUMP_EXECUTION_ERROR%
)

for %%I in ("%BACKUP_FILE_PATH%") do set "BACKUP_FILE_SIZE=%%~zI"
if "%BACKUP_FILE_SIZE%"=="0" (
  del /f /q "%BACKUP_FILE_PATH%" >nul 2>nul
  echo [run-backup] Dump execution failure: output file is empty.
  exit /b %DUMP_EXECUTION_ERROR%
)

echo [run-backup] Backup completed.
echo [run-backup] dump command: %DB_DUMP_COMMAND%
echo [run-backup] datasource type: %DATASOURCE_TYPE%
echo [run-backup] host: %DB_HOST%
echo [run-backup] port: %DB_PORT%
echo [run-backup] dbName: %DB_NAME%
echo [run-backup] output file path: %BACKUP_FILE_PATH%
echo [run-backup] output file size bytes: %BACKUP_FILE_SIZE%
exit /b 0

:require_env
set "ENV_NAME=%~1"
set "ENV_VALUE="
call set "ENV_VALUE=%%%ENV_NAME%%%"
if not defined ENV_VALUE (
  echo [run-backup] Missing required environment variable: %ENV_NAME%
  exit /b %REQUIRED_ENV_ERROR%
)
exit /b 0

:resolve_backup_root
set "BACKUP_ROOT_PATH_INPUT=%~1"
for %%I in ("%BACKUP_ROOT_PATH_INPUT%") do set "BACKUP_ROOT_PATH=%%~fI"

if exist "%BACKUP_ROOT_PATH%" (
  if not exist "%BACKUP_ROOT_PATH%\." (
    echo [run-backup] Backup path error: path is not a directory: %BACKUP_ROOT_PATH%
    exit /b %BACKUP_PATH_ERROR%
  )
) else (
  mkdir "%BACKUP_ROOT_PATH%" >nul 2>nul
  if errorlevel 1 (
    echo [run-backup] Backup path error: failed to create directory: %BACKUP_ROOT_PATH%
    exit /b %BACKUP_PATH_ERROR%
  )
  if not exist "%BACKUP_ROOT_PATH%\." (
    echo [run-backup] Backup path error: failed to create directory: %BACKUP_ROOT_PATH%
    exit /b %BACKUP_PATH_ERROR%
  )
)

set "WRITE_TEST_FILE=%BACKUP_ROOT_PATH%\.__run_backup_write_test_%RANDOM%%RANDOM%.tmp"
> "%WRITE_TEST_FILE%" (
  echo write-test
) 2>nul
if not exist "%WRITE_TEST_FILE%" (
  echo [run-backup] Backup path error: directory is not writable: %BACKUP_ROOT_PATH%
  exit /b %BACKUP_PATH_ERROR%
)
del /f /q "%WRITE_TEST_FILE%" >nul 2>nul
exit /b 0

:resolve_dump_command
set "CANDIDATE=%~1"
set "CANDIDATE=%CANDIDATE:"=%"
set "DB_DUMP_COMMAND="
if not defined CANDIDATE exit /b 1

for %%I in ("%CANDIDATE%") do if exist "%%~fI" set "DB_DUMP_COMMAND=%%~fI"
if defined DB_DUMP_COMMAND exit /b 0

for /f "delims=" %%I in ('where "%CANDIDATE%" 2^>nul') do if not defined DB_DUMP_COMMAND set "DB_DUMP_COMMAND=%%~fI"
if defined DB_DUMP_COMMAND exit /b 0

exit /b 1

:parse_jdbc_url
set "DATASOURCE_TYPE="
set "DB_HOST="
set "DB_PORT="
set "DB_NAME="
set "JDBC_REMAINDER="
set "DB_AUTHORITY="
set "DB_PATH_AND_QUERY="
set "DB_EXTRA_AUTHORITY="
set "DB_PORT_SUFFIX="

if /i "%APP_DB_URL:~0,15%"=="jdbc:mariadb://" (
  set "DATASOURCE_TYPE=MARIADB"
  set "JDBC_REMAINDER=%APP_DB_URL:~15%"
) else if /i "%APP_DB_URL:~0,13%"=="jdbc:mysql://" (
  set "DATASOURCE_TYPE=MYSQL"
  set "JDBC_REMAINDER=%APP_DB_URL:~13%"
) else (
  goto :parse_jdbc_url_failed
)

for /f "tokens=1* delims=/" %%A in ("%JDBC_REMAINDER%") do (
  set "DB_AUTHORITY=%%A"
  set "DB_PATH_AND_QUERY=%%B"
)

if not defined DB_AUTHORITY goto :parse_jdbc_url_failed
if not defined DB_PATH_AND_QUERY goto :parse_jdbc_url_failed

for /f "tokens=1,2* delims=:" %%A in ("%DB_AUTHORITY%") do (
  set "DB_HOST=%%A"
  set "DB_PORT=%%B"
  set "DB_EXTRA_AUTHORITY=%%C"
)

if not defined DB_HOST goto :parse_jdbc_url_failed
if defined DB_EXTRA_AUTHORITY goto :parse_jdbc_url_failed
if not "%DB_HOST:@=%"=="%DB_HOST%" goto :parse_jdbc_url_failed
if not "%DB_HOST:,=%"=="%DB_HOST%" goto :parse_jdbc_url_failed
if not "%DB_HOST:\=%"=="%DB_HOST%" goto :parse_jdbc_url_failed

if not defined DB_PORT set "DB_PORT=3306"

for /f "tokens=1 delims=?;#" %%A in ("%DB_PATH_AND_QUERY%") do set "DB_NAME=%%A"

if not defined DB_NAME goto :parse_jdbc_url_failed
if not "%DB_NAME:/=%"=="%DB_NAME%" goto :parse_jdbc_url_failed
if not "%DB_NAME:\=%"=="%DB_NAME%" goto :parse_jdbc_url_failed

for /f "delims=0123456789" %%A in ("%DB_PORT%") do set "DB_PORT_SUFFIX=%%A"
if defined DB_PORT_SUFFIX goto :parse_jdbc_url_failed

set /a DB_PORT_NUM=%DB_PORT% >nul 2>nul
if errorlevel 1 goto :parse_jdbc_url_failed
if %DB_PORT_NUM% lss 1 goto :parse_jdbc_url_failed
if %DB_PORT_NUM% gtr 65535 goto :parse_jdbc_url_failed
set "DB_PORT=%DB_PORT_NUM%"
exit /b 0

:parse_jdbc_url_failed
echo [run-backup] JDBC URL parsing failed. APP_DB_URL must be jdbc:mariadb://host:port/dbname or jdbc:mysql://host:port/dbname.
exit /b %JDBC_PARSE_ERROR%

:build_backup_target
call :build_backup_timestamp
if errorlevel 1 (
  echo [run-backup] Dump execution failure: timestamp generation failed.
  exit /b %DUMP_EXECUTION_ERROR%
)

set "BACKUP_FILE_PATH=%BACKUP_ROOT_PATH%\db-backup-%BACKUP_TIMESTAMP%.sql"
if exist "%BACKUP_FILE_PATH%" (
  echo [run-backup] Dump execution failure: output file already exists: %BACKUP_FILE_PATH%
  exit /b %DUMP_EXECUTION_ERROR%
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

:run_dump_command
set "DUMP_STDERR_FILE=%TEMP%\run-backup-%RANDOM%%RANDOM%%RANDOM%.stderr"
if exist "%DUMP_STDERR_FILE%" del /f /q "%DUMP_STDERR_FILE%" >nul 2>nul
if exist "%BACKUP_FILE_PATH%" del /f /q "%BACKUP_FILE_PATH%" >nul 2>nul

set "MYSQL_PWD=%APP_DB_PASSWORD%"
call "%DB_DUMP_COMMAND%" --host="%DB_HOST%" --port=%DB_PORT% --user="%APP_DB_USERNAME%" --single-transaction --skip-lock-tables --skip-comments "%DB_NAME%" 1> "%BACKUP_FILE_PATH%" 2> "%DUMP_STDERR_FILE%"
set "DUMP_EXIT=%ERRORLEVEL%"
set "MYSQL_PWD="

if not "%DUMP_EXIT%"=="0" (
  if exist "%BACKUP_FILE_PATH%" del /f /q "%BACKUP_FILE_PATH%" >nul 2>nul
  echo [run-backup] Dump execution failure: dump command exited with code %DUMP_EXIT%.
  call :print_dump_output "%DUMP_STDERR_FILE%"
  call :cleanup_temp_file "%DUMP_STDERR_FILE%"
  exit /b %DUMP_EXECUTION_ERROR%
)

if not exist "%BACKUP_FILE_PATH%" (
  echo [run-backup] Dump execution failure: output file was not created.
  call :print_dump_output "%DUMP_STDERR_FILE%"
  call :cleanup_temp_file "%DUMP_STDERR_FILE%"
  exit /b %DUMP_EXECUTION_ERROR%
)

call :cleanup_temp_file "%DUMP_STDERR_FILE%"
exit /b 0

:print_dump_output
set "OUTPUT_FILE=%~1"
if not exist "%OUTPUT_FILE%" exit /b 0
for %%I in ("%OUTPUT_FILE%") do if %%~zI gtr 0 (
  echo [run-backup] dump stderr:
  type "%OUTPUT_FILE%"
  echo.
)
exit /b 0

:cleanup_temp_file
if exist "%~1" del /f /q "%~1" >nul 2>nul
exit /b 0

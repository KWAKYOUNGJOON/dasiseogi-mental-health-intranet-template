@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Operator-only helper for direct DB dump file creation.
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

for %%I in ("%APP_BACKUP_ROOT_PATH%") do set "BACKUP_ROOT_PATH=%%~fI"

if defined APP_DB_DUMP_COMMAND (
  call :resolve_dump_command "%APP_DB_DUMP_COMMAND%"
) else (
  call :resolve_dump_command "mariadb-dump"
  if errorlevel 1 call :resolve_dump_command "mysqldump"
)

if not defined DB_DUMP_COMMAND (
  echo [run-backup] Dump command missing. Set APP_DB_DUMP_COMMAND or install mariadb-dump/mysqldump in PATH.
  exit /b %DUMP_COMMAND_ERROR%
)

call :validate_backup_root
if errorlevel 1 exit /b %ERRORLEVEL%

call :parse_jdbc_url
if errorlevel 1 exit /b %ERRORLEVEL%

call :build_backup_target
if errorlevel 1 exit /b %DUMP_EXECUTION_ERROR%

echo [run-backup] backup root "%BACKUP_ROOT_PATH%"
echo [run-backup] datasource %DB_DRIVER% %DB_HOST%:%DB_PORT%/%DB_NAME%
echo [run-backup] dump command "%DB_DUMP_COMMAND%"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$command = [string]$env:DB_DUMP_COMMAND;" ^
  "$targetFile = [string]$env:BACKUP_FILE_PATH;" ^
  "$commandName = [System.IO.Path]::GetFileNameWithoutExtension($command).ToLowerInvariant();" ^
  "$arguments = @('--host=' + $env:DB_HOST, '--port=' + $env:DB_PORT, '--user=' + $env:APP_DB_USERNAME, '--single-transaction', '--routines', '--events', '--triggers', '--databases', $env:DB_NAME, '--result-file=' + $targetFile);" ^
  "if ($commandName -eq 'mysqldump') { $arguments += '--column-statistics=0' }" ^
  "$env:MYSQL_PWD = $env:APP_DB_PASSWORD;" ^
  "try {" ^
  "  & $command @arguments;" ^
  "  $exitCode = $LASTEXITCODE;" ^
  "} catch {" ^
  "  Write-Host ('[run-backup] dump execution failure: ' + $_.Exception.Message);" ^
  "  exit 1;" ^
  "} finally {" ^
  "  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue;" ^
  "}" ^
  "if ($exitCode -ne 0) { Write-Host ('[run-backup] dump execution failure: command exit code ' + $exitCode); exit $exitCode }" ^
  "exit 0"

set "DUMP_EXIT_CODE=%ERRORLEVEL%"
if not "%DUMP_EXIT_CODE%"=="0" (
  if exist "%BACKUP_FILE_PATH%" del /f /q "%BACKUP_FILE_PATH%" >nul 2>nul
  echo [run-backup] Dump execution failed.
  exit /b %DUMP_EXECUTION_ERROR%
)

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

echo [run-backup] Backup created: "%BACKUP_FILE_PATH%"
exit /b 0

:require_env
set "ENV_NAME=%~1"
set "ENV_VALUE="
call set "ENV_VALUE=%%%ENV_NAME%%%"
if defined ENV_VALUE exit /b 0
echo [run-backup] Missing required environment variable: %ENV_NAME%
exit /b %REQUIRED_ENV_ERROR%

:resolve_dump_command
set "CANDIDATE=%~1"
if not defined CANDIDATE exit /b 1

for %%I in ("%CANDIDATE%") do (
  if exist "%%~fI" (
    set "DB_DUMP_COMMAND=%%~fI"
    exit /b 0
  )
)

for /f "usebackq delims=" %%I in (`where "%CANDIDATE%" 2^>nul`) do (
  set "DB_DUMP_COMMAND=%%I"
  exit /b 0
)

exit /b 1

:validate_backup_root
if not exist "%BACKUP_ROOT_PATH%\." (
  echo [run-backup] Backup path error: directory not found or not accessible: "%BACKUP_ROOT_PATH%"
  exit /b %BACKUP_PATH_ERROR%
)

set "WRITE_TEST_FILE=%BACKUP_ROOT_PATH%\.__run_backup_write_test_%RANDOM%%RANDOM%.tmp"
> "%WRITE_TEST_FILE%" (
  echo write-test
) 2>nul

if not exist "%WRITE_TEST_FILE%" (
  echo [run-backup] Backup path error: directory is not writable: "%BACKUP_ROOT_PATH%"
  exit /b %BACKUP_PATH_ERROR%
)

del /f /q "%WRITE_TEST_FILE%" >nul 2>nul
exit /b 0

:parse_jdbc_url
set "DB_DRIVER="
set "DB_HOST="
set "DB_PORT="
set "DB_NAME="

for /f "usebackq tokens=1-4 delims=|" %%A in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$jdbcUrl = [string]$env:APP_DB_URL;" ^
  "if ([string]::IsNullOrWhiteSpace($jdbcUrl)) { exit 1 }" ^
  "if ($jdbcUrl -notmatch '^jdbc:(mariadb|mysql)://') { exit 1 }" ^
  "$driver = $Matches[1].ToUpperInvariant();" ^
  "$uri = [System.Uri]::new($jdbcUrl.Substring(5));" ^
  "$dbName = $uri.AbsolutePath.Trim('/');" ^
  "if ([string]::IsNullOrWhiteSpace($uri.Host) -or [string]::IsNullOrWhiteSpace($dbName) -or $dbName.Contains('/')) { exit 1 }" ^
  "$port = if ($uri.IsDefaultPort) { 3306 } else { $uri.Port };" ^
  "Write-Output ($driver + '|' + $uri.Host + '|' + $port + '|' + $dbName)"`) do (
  set "DB_DRIVER=%%A"
  set "DB_HOST=%%B"
  set "DB_PORT=%%C"
  set "DB_NAME=%%D"
)

if not defined DB_HOST (
  echo [run-backup] JDBC URL parsing failed. APP_DB_URL must be a MariaDB/MySQL JDBC URL.
  exit /b %JDBC_PARSE_ERROR%
)

exit /b 0

:build_backup_target
set "BACKUP_TIMESTAMP="
for /f "usebackq delims=" %%I in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[DateTime]::Now.ToString('yyyyMMdd-HHmmss')"`) do set "BACKUP_TIMESTAMP=%%I"

if not defined BACKUP_TIMESTAMP (
  echo [run-backup] Dump execution failure: timestamp generation failed.
  exit /b 1
)

set "BACKUP_FILE_NAME=db-backup-%BACKUP_TIMESTAMP%.sql"
set "BACKUP_FILE_PATH=%BACKUP_ROOT_PATH%\%BACKUP_FILE_NAME%"
exit /b 0

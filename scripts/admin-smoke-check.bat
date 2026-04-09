@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Operator-only helper for authenticated admin smoke verification against a running server.
rem This script also calls POST /api/v1/admin/backups/run.
rem Do not use it before backup path and dump-command policy are confirmed.
set "INPUT_ERROR=10"
set "TOOL_ERROR=11"
set "PAYLOAD_ERROR=12"
set "REQUEST_ERROR=20"

set "DEFAULT_BASE_URL=http://127.0.0.1:8080"
set "DEFAULT_LOGIN_ID=admina"
set "DEFAULT_PASSWORD=Test1234!"
set "MANUAL_BACKUP_REASON=Operational trace smoke check via admin-smoke-check.bat"

set "BASE_URL_INPUT=%~1"
if not defined BASE_URL_INPUT set "BASE_URL_INPUT=%DEFAULT_BASE_URL%"
if "%~1"=="" set "USED_DEFAULT_BASE_URL=1"

set "LOGIN_ID=%~2"
if not defined LOGIN_ID set "LOGIN_ID=%DEFAULT_LOGIN_ID%"
if "%~2"=="" set "USED_DEFAULT_LOGIN_ID=1"

set "LOGIN_PASSWORD=%~3"
if not defined LOGIN_PASSWORD set "LOGIN_PASSWORD=%DEFAULT_PASSWORD%"
if "%~3"=="" set "USED_DEFAULT_PASSWORD=1"

call :resolve_curl
if errorlevel 1 exit /b %ERRORLEVEL%

call :resolve_powershell
if errorlevel 1 exit /b %ERRORLEVEL%

call :normalize_api_base_url "%BASE_URL_INPUT%"
if errorlevel 1 exit /b %ERRORLEVEL%

call :prepare_temp_files
if errorlevel 1 exit /b %PAYLOAD_ERROR%

call :write_login_payload
if errorlevel 1 (
  echo [admin-smoke-check] Payload failure: failed to create login request body.
  call :cleanup_temp_files
  exit /b %PAYLOAD_ERROR%
)

call :write_backup_payload
if errorlevel 1 (
  echo [admin-smoke-check] Payload failure: failed to create backup request body.
  call :cleanup_temp_files
  exit /b %PAYLOAD_ERROR%
)

echo [admin-smoke-check] base URL: %BASE_URL%
echo [admin-smoke-check] api base URL: %API_BASE_URL%
echo [admin-smoke-check] loginId: %LOGIN_ID%
if defined USED_DEFAULT_BASE_URL echo [admin-smoke-check] Warning: default base URL is being used. Confirm it matches the production backend URL before continuing.
if defined USED_DEFAULT_LOGIN_ID echo [admin-smoke-check] Warning: default loginId admina is a local seed default, not a production credential.
if defined USED_DEFAULT_PASSWORD echo [admin-smoke-check] Warning: default password Test1234! is a local seed default, not a production credential.
echo [admin-smoke-check] Warning: this script will call POST /api/v1/admin/backups/run.
echo.

set /a TOTAL_FAILURES=0
set "FAILED_ENDPOINTS="

call :run_json_request "POST /api/v1/auth/login" "/auth/login" "%LOGIN_PAYLOAD_FILE%" "30"
call :run_request "GET /api/v1/health" "/health" "15"
call :run_request "GET /api/v1/admin/signup-requests?status=PENDING" "/admin/signup-requests?status=PENDING" "30"
call :run_request "GET /api/v1/admin/users" "/admin/users" "30"
call :run_request "GET /api/v1/admin/activity-logs" "/admin/activity-logs" "30"
call :run_request "GET /api/v1/admin/backups" "/admin/backups" "30"
call :run_json_request "POST /api/v1/admin/backups/run" "/admin/backups/run" "%BACKUP_PAYLOAD_FILE%" "180"

if %TOTAL_FAILURES% gtr 0 (
  echo [admin-smoke-check] Smoke check failed.
  echo [admin-smoke-check] failed endpoints: %FAILED_ENDPOINTS%
  call :cleanup_temp_files
  exit /b %REQUEST_ERROR%
)

echo [admin-smoke-check] Smoke check passed.
call :cleanup_temp_files
exit /b 0

:resolve_curl
set "CURL_EXE="
for /f "delims=" %%I in ('where curl.exe 2^>nul') do if not defined CURL_EXE set "CURL_EXE=%%~fI"
if not defined CURL_EXE (
  echo [admin-smoke-check] Tool failure: curl.exe was not found in PATH.
  exit /b %TOOL_ERROR%
)
exit /b 0

:resolve_powershell
set "POWERSHELL_EXE="
for /f "delims=" %%I in ('where powershell.exe 2^>nul') do if not defined POWERSHELL_EXE set "POWERSHELL_EXE=%%~fI"
if not defined POWERSHELL_EXE (
  echo [admin-smoke-check] Tool failure: powershell.exe was not found in PATH.
  exit /b %TOOL_ERROR%
)
exit /b 0

:normalize_api_base_url
set "RAW_URL=%~1"
if not defined RAW_URL (
  echo [admin-smoke-check] Input error: base URL is empty.
  exit /b %INPUT_ERROR%
)

if /i not "%RAW_URL:~0,7%"=="http://" if /i not "%RAW_URL:~0,8%"=="https://" (
  echo [admin-smoke-check] Input error: only http:// or https:// URLs are supported.
  exit /b %INPUT_ERROR%
)

set "BASE_URL=%RAW_URL%"
if "%BASE_URL:~-1%"=="/" set "BASE_URL=%BASE_URL:~0,-1%"

set "API_BASE_URL=%BASE_URL%"
if /i not "%API_BASE_URL:~-7%"=="/api/v1" set "API_BASE_URL=%BASE_URL%/api/v1"
exit /b 0

:prepare_temp_files
set "TEMP_PREFIX=%TEMP%\admin-smoke-check-%RANDOM%%RANDOM%%RANDOM%"
set "COOKIE_JAR=%TEMP_PREFIX%.cookies"
set "BODY_FILE=%TEMP_PREFIX%.body"
set "STATUS_FILE=%TEMP_PREFIX%.status"
set "ERROR_FILE=%TEMP_PREFIX%.stderr"
set "LOGIN_PAYLOAD_FILE=%TEMP_PREFIX%.login.json"
set "BACKUP_PAYLOAD_FILE=%TEMP_PREFIX%.backup.json"

if exist "%COOKIE_JAR%" del /f /q "%COOKIE_JAR%" >nul 2>nul
if exist "%BODY_FILE%" del /f /q "%BODY_FILE%" >nul 2>nul
if exist "%STATUS_FILE%" del /f /q "%STATUS_FILE%" >nul 2>nul
if exist "%ERROR_FILE%" del /f /q "%ERROR_FILE%" >nul 2>nul
if exist "%LOGIN_PAYLOAD_FILE%" del /f /q "%LOGIN_PAYLOAD_FILE%" >nul 2>nul
if exist "%BACKUP_PAYLOAD_FILE%" del /f /q "%BACKUP_PAYLOAD_FILE%" >nul 2>nul

type nul > "%COOKIE_JAR%" 2>nul
if not exist "%COOKIE_JAR%" exit /b 1
exit /b 0

:cleanup_temp_files
if defined COOKIE_JAR if exist "%COOKIE_JAR%" del /f /q "%COOKIE_JAR%" >nul 2>nul
if defined BODY_FILE if exist "%BODY_FILE%" del /f /q "%BODY_FILE%" >nul 2>nul
if defined STATUS_FILE if exist "%STATUS_FILE%" del /f /q "%STATUS_FILE%" >nul 2>nul
if defined ERROR_FILE if exist "%ERROR_FILE%" del /f /q "%ERROR_FILE%" >nul 2>nul
if defined LOGIN_PAYLOAD_FILE if exist "%LOGIN_PAYLOAD_FILE%" del /f /q "%LOGIN_PAYLOAD_FILE%" >nul 2>nul
if defined BACKUP_PAYLOAD_FILE if exist "%BACKUP_PAYLOAD_FILE%" del /f /q "%BACKUP_PAYLOAD_FILE%" >nul 2>nul
exit /b 0

:write_login_payload
set "ADMIN_SMOKE_JSON_OUT=%LOGIN_PAYLOAD_FILE%"
set "ADMIN_SMOKE_LOGIN_ID=%LOGIN_ID%"
set "ADMIN_SMOKE_PASSWORD=%LOGIN_PASSWORD%"
"%POWERSHELL_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$payload = [ordered]@{ loginId = $env:ADMIN_SMOKE_LOGIN_ID; password = $env:ADMIN_SMOKE_PASSWORD }; $json = $payload | ConvertTo-Json -Compress; $utf8 = New-Object System.Text.UTF8Encoding($false); [System.IO.File]::WriteAllText($env:ADMIN_SMOKE_JSON_OUT, $json, $utf8)"
set "PS_EXIT=%ERRORLEVEL%"
set "ADMIN_SMOKE_JSON_OUT="
set "ADMIN_SMOKE_LOGIN_ID="
set "ADMIN_SMOKE_PASSWORD="
exit /b %PS_EXIT%

:write_backup_payload
set "ADMIN_SMOKE_JSON_OUT=%BACKUP_PAYLOAD_FILE%"
set "ADMIN_SMOKE_BACKUP_REASON=%MANUAL_BACKUP_REASON%"
"%POWERSHELL_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$payload = [ordered]@{ reason = $env:ADMIN_SMOKE_BACKUP_REASON }; $json = $payload | ConvertTo-Json -Compress; $utf8 = New-Object System.Text.UTF8Encoding($false); [System.IO.File]::WriteAllText($env:ADMIN_SMOKE_JSON_OUT, $json, $utf8)"
set "PS_EXIT=%ERRORLEVEL%"
set "ADMIN_SMOKE_JSON_OUT="
set "ADMIN_SMOKE_BACKUP_REASON="
exit /b %PS_EXIT%

:run_request
call :perform_request "GET" "%~1" "%~2" "%~3"
exit /b 0

:run_json_request
call :perform_request "POST" "%~1" "%~2" "%~4" "%~3"
exit /b 0

:perform_request
set "REQUEST_METHOD=%~1"
set "ENDPOINT_LABEL=%~2"
set "REQUEST_PATH=%~3"
set "REQUEST_TIMEOUT=%~4"
set "REQUEST_BODY_FILE=%~5"
set "REQUEST_URL=%API_BASE_URL%%REQUEST_PATH%"

if exist "%BODY_FILE%" del /f /q "%BODY_FILE%" >nul 2>nul
if exist "%STATUS_FILE%" del /f /q "%STATUS_FILE%" >nul 2>nul
if exist "%ERROR_FILE%" del /f /q "%ERROR_FILE%" >nul 2>nul

if /i "%REQUEST_METHOD%"=="POST" (
  "%CURL_EXE%" --silent --show-error --location --max-time %REQUEST_TIMEOUT% --cookie "%COOKIE_JAR%" --cookie-jar "%COOKIE_JAR%" --header "Accept: application/json" --header "Content-Type: application/json; charset=utf-8" --output "%BODY_FILE%" --write-out "%%{http_code}" --request POST --data-binary "@%REQUEST_BODY_FILE%" "%REQUEST_URL%" > "%STATUS_FILE%" 2> "%ERROR_FILE%"
  call set "CURL_EXIT=%%ERRORLEVEL%%"
) else (
  "%CURL_EXE%" --silent --show-error --location --max-time %REQUEST_TIMEOUT% --cookie "%COOKIE_JAR%" --cookie-jar "%COOKIE_JAR%" --header "Accept: application/json" --output "%BODY_FILE%" --write-out "%%{http_code}" "%REQUEST_URL%" > "%STATUS_FILE%" 2> "%ERROR_FILE%"
  call set "CURL_EXIT=%%ERRORLEVEL%%"
)

set "HTTP_STATUS="
if exist "%STATUS_FILE%" set /p HTTP_STATUS=<"%STATUS_FILE%"
if not defined HTTP_STATUS set "HTTP_STATUS=000"

set "REQUEST_FAILED="
if not "%CURL_EXIT%"=="0" set "REQUEST_FAILED=1"
call :is_http_success "%HTTP_STATUS%"
if errorlevel 1 set "REQUEST_FAILED=1"

echo [admin-smoke-check] Endpoint: %ENDPOINT_LABEL%
echo [admin-smoke-check] HTTP status: %HTTP_STATUS%
if defined REQUEST_FAILED (
  echo [admin-smoke-check] Result: FAIL
  if not "%CURL_EXIT%"=="0" (
    echo [admin-smoke-check] curl exit code: %CURL_EXIT%
    call :print_curl_output
  )
  call :print_response_body
  call :record_failure "%ENDPOINT_LABEL%"
  echo.
  exit /b 0
)

echo [admin-smoke-check] Result: PASS
echo.
exit /b 0

:print_curl_output
if not exist "%ERROR_FILE%" exit /b 0
for %%I in ("%ERROR_FILE%") do if %%~zI gtr 0 (
  echo [admin-smoke-check] curl output:
  type "%ERROR_FILE%"
  echo.
)
exit /b 0

:print_response_body
if not exist "%BODY_FILE%" (
  echo [admin-smoke-check] response body: ^<empty^>
  exit /b 0
)

for %%I in ("%BODY_FILE%") do if %%~zI equ 0 (
  echo [admin-smoke-check] response body: ^<empty^>
  exit /b 0
)

echo [admin-smoke-check] response body:
type "%BODY_FILE%"
echo.
exit /b 0

:record_failure
set /a TOTAL_FAILURES+=1
if defined FAILED_ENDPOINTS (
  set "FAILED_ENDPOINTS=%FAILED_ENDPOINTS%; %~1"
) else (
  set "FAILED_ENDPOINTS=%~1"
)
exit /b 0

:is_http_success
set "STATUS_TEXT=%~1"
if not defined STATUS_TEXT exit /b 1
for /f "delims=0123456789" %%I in ("%STATUS_TEXT%") do exit /b 1
set /a STATUS_VALUE=%STATUS_TEXT% >nul 2>nul
if errorlevel 1 exit /b 1
if %STATUS_VALUE% geq 200 if %STATUS_VALUE% lss 300 exit /b 0
exit /b 1


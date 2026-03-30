@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Operator-only helper for /api/v1/health verification.
set "INPUT_ERROR=10"
set "TOOL_ERROR=11"
set "REQUEST_ERROR=20"
set "JSON_ERROR=30"
set "STATUS_ERROR=31"

set "DEFAULT_TARGET_URL=http://127.0.0.1:8080/api/v1/health"
set "TARGET_INPUT=%~1"
if not defined TARGET_INPUT set "TARGET_INPUT=%DEFAULT_TARGET_URL%"

call :resolve_curl
if errorlevel 1 exit /b %ERRORLEVEL%

call :normalize_target_url "%TARGET_INPUT%"
if errorlevel 1 exit /b %ERRORLEVEL%

call :prepare_temp_files
if errorlevel 1 exit /b %REQUEST_ERROR%

"%CURL_EXE%" --silent --show-error --location --max-time 15 --header "Accept: application/json" --output "%BODY_FILE%" --write-out "%%{http_code}" "%TARGET_URL%" > "%STATUS_FILE%" 2> "%ERROR_FILE%"
set "CURL_EXIT=%ERRORLEVEL%"
if not "%CURL_EXIT%"=="0" (
  echo [health-check] Request failure: curl exit code %CURL_EXIT%.
  if exist "%ERROR_FILE%" (
    echo [health-check] curl output:
    type "%ERROR_FILE%"
    echo.
  )
  call :cleanup_temp_files
  exit /b %REQUEST_ERROR%
)

set "HTTP_STATUS="
if exist "%STATUS_FILE%" set /p HTTP_STATUS=<"%STATUS_FILE%"
if not defined HTTP_STATUS set "HTTP_STATUS=000"

call :read_file "%BODY_FILE%" BODY_CONTENT

set "STATUS_VALUE="
set "APP_STATUS="
set "DB_STATUS="
set "SCALE_REGISTRY_STATUS="
set "LOADED_SCALE_COUNT="
call :parse_health_response BODY_CONTENT
set "PARSE_EXIT=%ERRORLEVEL%"

echo [health-check] URL: %TARGET_URL%
echo [health-check] HTTP status: %HTTP_STATUS%

if "%PARSE_EXIT%"=="0" (
  echo [health-check] status: %STATUS_VALUE%
  echo [health-check] appStatus: %APP_STATUS%
  echo [health-check] dbStatus: %DB_STATUS%
  echo [health-check] scaleRegistryStatus: %SCALE_REGISTRY_STATUS%
  echo [health-check] loadedScaleCount: %LOADED_SCALE_COUNT%
)

if not "%HTTP_STATUS%"=="200" (
  if not "%PARSE_EXIT%"=="0" call :print_response_body
  echo [health-check] HTTP failure: expected 200 but received %HTTP_STATUS%.
  call :cleanup_temp_files
  exit /b %REQUEST_ERROR%
)

if not "%PARSE_EXIT%"=="0" (
  call :print_response_body
  echo [health-check] JSON failure: required health fields are missing or invalid.
  call :cleanup_temp_files
  exit /b %JSON_ERROR%
)

set "STATUS_ISSUES="
if /i not "%STATUS_VALUE%"=="UP" call :append_issue STATUS_ISSUES "status=%STATUS_VALUE%"
if /i not "%APP_STATUS%"=="UP" call :append_issue STATUS_ISSUES "appStatus=%APP_STATUS%"
if /i not "%DB_STATUS%"=="UP" call :append_issue STATUS_ISSUES "dbStatus=%DB_STATUS%"
if /i not "%SCALE_REGISTRY_STATUS%"=="UP" call :append_issue STATUS_ISSUES "scaleRegistryStatus=%SCALE_REGISTRY_STATUS%"

if defined STATUS_ISSUES (
  echo [health-check] Health failure: %STATUS_ISSUES%
  call :cleanup_temp_files
  exit /b %STATUS_ERROR%
)

echo [health-check] Health check passed.
call :cleanup_temp_files
exit /b 0

:resolve_curl
set "CURL_EXE="
for /f "delims=" %%I in ('where curl.exe 2^>nul') do if not defined CURL_EXE set "CURL_EXE=%%~fI"
if not defined CURL_EXE (
  echo [health-check] Tool failure: curl.exe was not found in PATH.
  exit /b %TOOL_ERROR%
)
exit /b 0

:normalize_target_url
set "RAW_URL=%~1"
if not defined RAW_URL (
  echo [health-check] Input error: target URL is empty.
  exit /b %INPUT_ERROR%
)

if /i not "%RAW_URL:~0,7%"=="http://" if /i not "%RAW_URL:~0,8%"=="https://" (
  echo [health-check] Input error: only http:// or https:// URLs are supported.
  exit /b %INPUT_ERROR%
)

set "TARGET_URL=%RAW_URL%"
if /i "%TARGET_URL:~-8%"=="/health/" set "TARGET_URL=%TARGET_URL:~0,-1%"
if /i not "%TARGET_URL:~-7%"=="/health" (
  if "%TARGET_URL:~-1%"=="/" (
    set "TARGET_URL=%TARGET_URL%health"
  ) else (
    set "TARGET_URL=%TARGET_URL%/health"
  )
)
exit /b 0

:prepare_temp_files
set "TEMP_PREFIX=%TEMP%\health-check-%RANDOM%%RANDOM%%RANDOM%"
set "BODY_FILE=%TEMP_PREFIX%.body"
set "STATUS_FILE=%TEMP_PREFIX%.status"
set "ERROR_FILE=%TEMP_PREFIX%.stderr"
if exist "%BODY_FILE%" del /f /q "%BODY_FILE%" >nul 2>nul
if exist "%STATUS_FILE%" del /f /q "%STATUS_FILE%" >nul 2>nul
if exist "%ERROR_FILE%" del /f /q "%ERROR_FILE%" >nul 2>nul
exit /b 0

:cleanup_temp_files
if defined BODY_FILE if exist "%BODY_FILE%" del /f /q "%BODY_FILE%" >nul 2>nul
if defined STATUS_FILE if exist "%STATUS_FILE%" del /f /q "%STATUS_FILE%" >nul 2>nul
if defined ERROR_FILE if exist "%ERROR_FILE%" del /f /q "%ERROR_FILE%" >nul 2>nul
exit /b 0

:read_file
setlocal EnableDelayedExpansion
set "SOURCE_FILE=%~1"
set "FILE_CONTENT="
if exist "!SOURCE_FILE!" (
  for /f "usebackq delims=" %%I in ("!SOURCE_FILE!") do set "FILE_CONTENT=!FILE_CONTENT!%%I"
)
endlocal & set "%~2=%FILE_CONTENT%"
exit /b 0

:parse_health_response
setlocal EnableDelayedExpansion
call set "JSON_SOURCE=%%%~1%%"
if not defined JSON_SOURCE (
  endlocal & exit /b 1
)

set "JSON_FLAT=!JSON_SOURCE!"
set "JSON_FLAT=!JSON_FLAT:{= !"
set "JSON_FLAT=!JSON_FLAT:}= !"
set "JSON_FLAT=!JSON_FLAT:[= !"
set "JSON_FLAT=!JSON_FLAT:]= !"
set "JSON_FLAT=!JSON_FLAT::= !"
set "JSON_FLAT=!JSON_FLAT:,= !"
set "JSON_FLAT=!JSON_FLAT:"= !"

set "NEXT_FIELD="
set "PARSED_STATUS="
set "PARSED_APP_STATUS="
set "PARSED_DB_STATUS="
set "PARSED_SCALE_REGISTRY_STATUS="
set "PARSED_LOADED_SCALE_COUNT="

for %%T in (!JSON_FLAT!) do (
  if /i "%%T"=="status" (
    set "NEXT_FIELD=STATUS"
  ) else if /i "%%T"=="appStatus" (
    set "NEXT_FIELD=APP_STATUS"
  ) else if /i "%%T"=="dbStatus" (
    set "NEXT_FIELD=DB_STATUS"
  ) else if /i "%%T"=="scaleRegistryStatus" (
    set "NEXT_FIELD=SCALE_REGISTRY_STATUS"
  ) else if /i "%%T"=="loadedScaleCount" (
    set "NEXT_FIELD=LOADED_SCALE_COUNT"
  ) else if defined NEXT_FIELD (
    if /i "!NEXT_FIELD!"=="STATUS" if not defined PARSED_STATUS set "PARSED_STATUS=%%T"
    if /i "!NEXT_FIELD!"=="APP_STATUS" if not defined PARSED_APP_STATUS set "PARSED_APP_STATUS=%%T"
    if /i "!NEXT_FIELD!"=="DB_STATUS" if not defined PARSED_DB_STATUS set "PARSED_DB_STATUS=%%T"
    if /i "!NEXT_FIELD!"=="SCALE_REGISTRY_STATUS" if not defined PARSED_SCALE_REGISTRY_STATUS set "PARSED_SCALE_REGISTRY_STATUS=%%T"
    if /i "!NEXT_FIELD!"=="LOADED_SCALE_COUNT" if not defined PARSED_LOADED_SCALE_COUNT set "PARSED_LOADED_SCALE_COUNT=%%T"
    set "NEXT_FIELD="
  )
)

if not defined PARSED_STATUS (
  endlocal
  exit /b 1
)
if not defined PARSED_APP_STATUS (
  endlocal
  exit /b 1
)
if not defined PARSED_DB_STATUS (
  endlocal
  exit /b 1
)
if not defined PARSED_SCALE_REGISTRY_STATUS (
  endlocal
  exit /b 1
)
if not defined PARSED_LOADED_SCALE_COUNT (
  endlocal
  exit /b 1
)

endlocal & (
  set "STATUS_VALUE=%PARSED_STATUS%"
  set "APP_STATUS=%PARSED_APP_STATUS%"
  set "DB_STATUS=%PARSED_DB_STATUS%"
  set "SCALE_REGISTRY_STATUS=%PARSED_SCALE_REGISTRY_STATUS%"
  set "LOADED_SCALE_COUNT=%PARSED_LOADED_SCALE_COUNT%"
)
exit /b 0

:append_issue
set "ISSUE_VAR=%~1"
set "ISSUE_TEXT=%~2"
call set "ISSUE_VALUE=%%%ISSUE_VAR%%%"
if defined ISSUE_VALUE (
  call set "%ISSUE_VAR%=%%%ISSUE_VAR%%, %ISSUE_TEXT%"
) else (
  set "%ISSUE_VAR%=%ISSUE_TEXT%"
)
exit /b 0

:print_response_body
if not exist "%BODY_FILE%" exit /b 0
echo [health-check] response body:
type "%BODY_FILE%"
echo.
exit /b 0

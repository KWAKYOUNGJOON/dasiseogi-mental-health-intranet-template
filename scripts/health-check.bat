@echo off
setlocal EnableExtensions

set "DEFAULT_TARGET_URL=http://127.0.0.1:8080/api/v1/health"
set "RAW_TARGET_URL=%~1"

if not defined RAW_TARGET_URL if defined BASE_URL set "RAW_TARGET_URL=%BASE_URL%"
if not defined RAW_TARGET_URL if defined APP_BASE_URL set "RAW_TARGET_URL=%APP_BASE_URL%"
if not defined RAW_TARGET_URL set "RAW_TARGET_URL=%DEFAULT_TARGET_URL%"

call :normalize_target_url "%RAW_TARGET_URL%"
if errorlevel 1 (
  echo [health-check] Invalid target URL
  exit /b 10
)

set "HEALTH_CHECK_TARGET=%TARGET_URL%"
echo [health-check] target %TARGET_URL%

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$targetUrl = $env:HEALTH_CHECK_TARGET;" ^
  "try {" ^
  "  $response = Invoke-WebRequest -Uri $targetUrl -UseBasicParsing -TimeoutSec 15;" ^
  "} catch {" ^
  "  $webResponse = $null;" ^
  "  if ($_.Exception -and $_.Exception.Response) { $webResponse = $_.Exception.Response }" ^
  "  if ($null -ne $webResponse) {" ^
  "    $statusCode = [int]$webResponse.StatusCode;" ^
  "    Write-Host ('[health-check] HTTP failure: ' + $statusCode + ' ' + $targetUrl);" ^
  "    exit 21;" ^
  "  }" ^
  "  Write-Host ('[health-check] Network failure: unable to reach ' + $targetUrl);" ^
  "  exit 20;" ^
  "}" ^
  "if ([int]$response.StatusCode -ne 200) {" ^
  "  Write-Host ('[health-check] HTTP failure: ' + [int]$response.StatusCode + ' ' + $targetUrl);" ^
  "  exit 21;" ^
  "}" ^
  "try {" ^
  "  $json = $response.Content | ConvertFrom-Json;" ^
  "} catch {" ^
  "  Write-Host '[health-check] JSON failure: invalid JSON response';" ^
  "  exit 30;" ^
  "}" ^
  "$errors = New-Object System.Collections.Generic.List[string];" ^
  "if ($json.status -ne 'UP') { $errors.Add('status=' + [string]$json.status) }" ^
  "if ($json.appStatus -ne 'UP') { $errors.Add('appStatus=' + [string]$json.appStatus) }" ^
  "if ($json.dbStatus -ne 'UP') { $errors.Add('dbStatus=' + [string]$json.dbStatus) }" ^
  "if ($json.scaleRegistryStatus -ne 'UP') { $errors.Add('scaleRegistryStatus=' + [string]$json.scaleRegistryStatus) }" ^
  "$loadedScaleCount = $json.loadedScaleCount;" ^
  "if ($null -eq $loadedScaleCount -or [string]::IsNullOrWhiteSpace([string]$loadedScaleCount)) { $errors.Add('loadedScaleCount=missing') }" ^
  "if ($errors.Count -gt 0) {" ^
  "  Write-Host ('[health-check] JSON failure: ' + ($errors -join ', '));" ^
  "  exit 30;" ^
  "}" ^
  "Write-Host ('[health-check] OK loadedScaleCount=' + [string]$loadedScaleCount);" ^
  "exit 0"

exit /b %ERRORLEVEL%

:normalize_target_url
set "TARGET_URL=%~1"
if not defined TARGET_URL exit /b 1

if /I "%TARGET_URL:~-7%"=="/health" exit /b 0

if "%TARGET_URL:~-1%"=="/" (
  set "TARGET_URL=%TARGET_URL%health"
) else (
  set "TARGET_URL=%TARGET_URL%/health"
)

exit /b 0

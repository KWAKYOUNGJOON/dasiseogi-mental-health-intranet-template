[CmdletBinding()]
param(
    [string]$BackendJarPath,
    [string]$FrontendDistPath,
    [switch]$DeployBackend,
    [switch]$DeployFrontend,
    [switch]$RunBackup,
    [switch]$RunHealthCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$deployBackendScript = Join-Path $PSScriptRoot "deploy-backend.bat"
$deployFrontendScript = Join-Path $PSScriptRoot "deploy-frontend.bat"
$runBackupScript = Join-Path $PSScriptRoot "run-backup.bat"
$healthCheckScript = Join-Path $PSScriptRoot "health-check.bat"

function Write-Step {
    param([string]$Message)
    Write-Host "[deploy-from-github-actions] $Message"
}

function Get-RequiredEnvironmentVariable {
    param([string]$Name)

    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Environment variable $Name is required."
    }

    return $value
}

function Invoke-BatchFile {
    param(
        [string]$Path,
        [string[]]$Arguments
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Required script was not found: $Path"
    }

    $output = & $Path @Arguments 2>&1
    foreach ($line in @($output)) {
        if (-not [string]::IsNullOrWhiteSpace($line)) {
            Write-Host $line.ToString()
        }
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $Path $($Arguments -join ' ')"
    }
}

function Invoke-ConfiguredPowerShell {
    param(
        [string]$VariableName,
        [string]$Description
    )

    $command = [Environment]::GetEnvironmentVariable($VariableName)
    if ([string]::IsNullOrWhiteSpace($command)) {
        Write-Step "Skipping $Description because $VariableName is not configured."
        return
    }

    Write-Step "Running $Description"
    Set-Variable -Scope Global -Name LASTEXITCODE -Value 0
    Invoke-Expression $command
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

if (-not $DeployBackend.IsPresent -and -not $DeployFrontend.IsPresent) {
    Write-Step "No deploy target was selected. Nothing to do."
    exit 0
}

$appHome = Get-RequiredEnvironmentVariable -Name "APP_HOME"
if (-not (Test-Path -LiteralPath $appHome)) {
    throw "APP_HOME path was not found: $appHome"
}

if ($DeployBackend.IsPresent) {
    if ([string]::IsNullOrWhiteSpace($BackendJarPath)) {
        throw "BackendJarPath is required when DeployBackend is selected."
    }
    if (-not (Test-Path -LiteralPath $BackendJarPath)) {
        throw "Backend jar artifact was not found: $BackendJarPath"
    }
}

if ($DeployFrontend.IsPresent) {
    if ([string]::IsNullOrWhiteSpace($FrontendDistPath)) {
        throw "FrontendDistPath is required when DeployFrontend is selected."
    }
    if (-not (Test-Path -LiteralPath $FrontendDistPath)) {
        throw "Frontend dist artifact was not found: $FrontendDistPath"
    }
}

if ($RunBackup.IsPresent -and $DeployBackend.IsPresent) {
    $null = Get-RequiredEnvironmentVariable -Name "APP_BACKUP_ROOT_PATH"
    $null = Get-RequiredEnvironmentVariable -Name "APP_DB_URL"
    $null = Get-RequiredEnvironmentVariable -Name "APP_DB_USERNAME"
    $null = Get-RequiredEnvironmentVariable -Name "APP_DB_PASSWORD"

    Write-Step "Running pre-deploy backup"
    Invoke-BatchFile -Path $runBackupScript -Arguments @()
}

if ($DeployBackend.IsPresent) {
    Invoke-ConfiguredPowerShell -VariableName "APP_BACKEND_STOP_COMMAND_PWSH" -Description "backend stop command"

    Write-Step "Deploying backend jar"
    Invoke-BatchFile -Path $deployBackendScript -Arguments @($BackendJarPath)

    Invoke-ConfiguredPowerShell -VariableName "APP_BACKEND_START_COMMAND_PWSH" -Description "backend start command"
}

if ($DeployFrontend.IsPresent) {
    Write-Step "Deploying frontend dist"
    Invoke-BatchFile -Path $deployFrontendScript -Arguments @($FrontendDistPath)

    Invoke-ConfiguredPowerShell -VariableName "APP_FRONTEND_POST_DEPLOY_COMMAND_PWSH" -Description "frontend post-deploy command"
}

if ($RunHealthCheck.IsPresent) {
    $healthCheckUrl = [Environment]::GetEnvironmentVariable("APP_HEALTHCHECK_URL")

    Write-Step "Running health check"
    if ([string]::IsNullOrWhiteSpace($healthCheckUrl)) {
        Invoke-BatchFile -Path $healthCheckScript -Arguments @()
    } else {
        Invoke-BatchFile -Path $healthCheckScript -Arguments @($healthCheckUrl)
    }
}

Write-Step "Deployment flow completed."

[CmdletBinding()]
param(
    [string]$ContainerName = "mental-health-local-db",
    [string]$BackupRootPath,
    [string]$DockerExe
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

function Resolve-DockerExe {
    param([string]$RequestedPath)

    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
        if (-not (Test-Path -LiteralPath $RequestedPath)) {
            throw "Docker executable not found: $RequestedPath"
        }
        return (Resolve-Path -LiteralPath $RequestedPath).Path
    }

    $candidate = Get-Command docker -ErrorAction SilentlyContinue
    if ($candidate) {
        return $candidate.Source
    }

    $defaultPath = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
    if (Test-Path -LiteralPath $defaultPath) {
        return $defaultPath
    }

    throw "docker.exe was not found in PATH or the default Docker Desktop location."
}

function Resolve-BackupRoot {
    param([string]$RequestedPath)

    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
        return $RequestedPath
    }

    $envPath = [Environment]::GetEnvironmentVariable("APP_BACKUP_ROOT_PATH", "User")
    if (-not [string]::IsNullOrWhiteSpace($envPath)) {
        return $envPath
    }

    return (Join-Path $repoRoot "local-backups")
}

function Parse-JdbcDatabaseName {
    param([string]$JdbcUrl)

    if ([string]::IsNullOrWhiteSpace($JdbcUrl)) {
        throw "APP_DB_URL is not configured."
    }

    if ($JdbcUrl -notmatch '^jdbc:(mariadb|mysql)://') {
        throw "APP_DB_URL must be a MariaDB/MySQL JDBC URL."
    }

    $uri = [System.Uri]::new($JdbcUrl.Substring(5))
    $databaseName = $uri.AbsolutePath.Trim("/")
    if ([string]::IsNullOrWhiteSpace($databaseName) -or $databaseName.Contains("/")) {
        throw "Could not determine database name from APP_DB_URL."
    }

    return $databaseName
}

$docker = Resolve-DockerExe -RequestedPath $DockerExe
$backupRoot = Resolve-BackupRoot -RequestedPath $BackupRootPath
$jdbcUrl = [Environment]::GetEnvironmentVariable("APP_DB_URL", "User")
$dbUser = [Environment]::GetEnvironmentVariable("APP_DB_USERNAME", "User")
$dbPassword = [Environment]::GetEnvironmentVariable("APP_DB_PASSWORD", "User")

if ([string]::IsNullOrWhiteSpace($dbUser)) {
    throw "APP_DB_USERNAME is not configured."
}

if ([string]::IsNullOrWhiteSpace($dbPassword)) {
    throw "APP_DB_PASSWORD is not configured."
}

$databaseName = Parse-JdbcDatabaseName -JdbcUrl $jdbcUrl
$scheduledBackupRoot = Join-Path $backupRoot "scheduled"
if (-not (Test-Path -LiteralPath $scheduledBackupRoot)) {
    New-Item -ItemType Directory -Path $scheduledBackupRoot -Force | Out-Null
}

$containerState = & $docker inspect -f "{{.State.Status}}" $ContainerName 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerState)) {
    throw "Docker container '$ContainerName' was not found."
}

if ($containerState.Trim() -ne "running") {
    throw "Docker container '$ContainerName' is not running."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$fileName = "db-backup-$timestamp.sql"
$targetFile = Join-Path $scheduledBackupRoot $fileName
$containerTempFile = "/tmp/$fileName"

$containerCommand = 'mariadb-dump --host=127.0.0.1 --port=3306 --user="$DB_USER" --password="$DB_PASSWORD" --single-transaction --routines --events --triggers --databases "$DB_NAME" > "$TARGET_FILE"'

try {
    & $docker exec `
        -e "DB_USER=$dbUser" `
        -e "DB_PASSWORD=$dbPassword" `
        -e "DB_NAME=$databaseName" `
        -e "TARGET_FILE=$containerTempFile" `
        $ContainerName sh -lc $containerCommand
    if ($LASTEXITCODE -ne 0) {
        throw "mariadb-dump failed inside container '$ContainerName'."
    }

    & $docker cp "${ContainerName}:${containerTempFile}" $targetFile
    if ($LASTEXITCODE -ne 0) {
        throw "docker cp failed for '$containerTempFile'."
    }

    $fileInfo = Get-Item -LiteralPath $targetFile -ErrorAction Stop
    if ($fileInfo.Length -le 0) {
        throw "Backup file '$targetFile' is empty."
    }

    Write-Host "[run-docker-mariadb-backup] Backup created: $targetFile"
} finally {
    & $docker exec $ContainerName sh -lc "rm -f '$containerTempFile'" *> $null
}

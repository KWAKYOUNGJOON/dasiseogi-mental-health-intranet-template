[CmdletBinding()]
param(
    [string]$MariaDbVersion = "12.2.2",
    [int]$DbPort = 3307,
    [int]$AppPort = 18080,
    [string]$DatabaseName = "mental_health_local",
    [string]$DatabaseUser = "mental_user",
    [string]$DatabasePassword = "mental_pass",
    [string]$RootPassword = "RootPass123!",
    [string]$AdminLoginId = "admina",
    [string]$AdminPassword = "Test1234!",
    [string]$BackupReason = "배포 직전 수동 백업"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$tmpRoot = Join-Path $repoRoot "tmp"
$mariaRoot = Join-Path $tmpRoot "mariadb"
$distRoot = Join-Path $mariaRoot "dist"
$runtimeRoot = Join-Path $mariaRoot "runtime"
$dataDir = Join-Path $runtimeRoot "data"
$tmpDir = Join-Path $runtimeRoot "tmp"
$logDir = Join-Path $runtimeRoot "logs"
$majorMinor = (($MariaDbVersion -split "\.")[0..1] -join ".")
$msiName = "mariadb-$MariaDbVersion-winx64.msi"
$msiPath = Join-Path $mariaRoot $msiName
$installerUrl = "https://downloads.mariadb.org/rest-api/mariadb/$MariaDbVersion/$msiName"
$installRoot = Join-Path $distRoot "MariaDB-$majorMinor"
$legacyInstallRoot = Join-Path $distRoot "MariaDB $majorMinor"
$mariaDbdExe = Join-Path $installRoot "bin\mariadbd.exe"
$mariaDbExe = Join-Path $installRoot "bin\mariadb.exe"
$mariaDbDumpExe = Join-Path $installRoot "bin\mariadb-dump.exe"
$installDbExe = Join-Path $installRoot "bin\mariadb-install-db.exe"
$myIniPath = Join-Path $dataDir "my.ini"
$backendDir = Join-Path $repoRoot "backend"
$backupRoot = Join-Path $repoRoot "local-backups"
$backendStdout = Join-Path $tmpRoot "backend-mariadb-stdout.log"
$backendStderr = Join-Path $tmpRoot "backend-mariadb-stderr.log"
$mariaStdout = Join-Path $runtimeRoot "mariadb-stdout.log"
$mariaStderr = Join-Path $runtimeRoot "mariadb-stderr.log"
$launcherPath = Join-Path $tmpRoot "launch-backend-mariadb.ps1"
$jdbcUrl = "jdbc:mariadb://127.0.0.1:$DbPort/${DatabaseName}?useUnicode=true&characterEncoding=utf8"
$healthUrl = "http://127.0.0.1:$AppPort/api/v1/health"
$loginUrl = "http://127.0.0.1:$AppPort/api/v1/auth/login"
$runBackupUrl = "http://127.0.0.1:$AppPort/api/v1/admin/backups/run"
$listBackupsUrl = "http://127.0.0.1:$AppPort/api/v1/admin/backups?page=1&size=5"

function Write-Step {
    param([string]$Message)
    Write-Host "[verify-db-dump] $Message"
}

function Get-NativeCommandExitCode {
    $exitCodeVar = Get-Variable -Name LASTEXITCODE -Scope Global -ErrorAction SilentlyContinue
    if ($null -eq $exitCodeVar) {
        return 0
    }
    return [int]$exitCodeVar.Value
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Get-ListeningProcesses {
    param([int]$Port)
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) {
        return @()
    }
    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    return $processIds | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue } | Where-Object { $_ }
}

function Wait-ForPort {
    param(
        [int]$Port,
        [int]$TimeoutSeconds
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
            return $true
        }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Wait-ForHealth {
    param(
        [string]$Url,
        [int]$TimeoutSeconds
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-RestMethod -Uri $Url -TimeoutSec 5
            if ($response.success -eq $true -and $response.data.status -eq "UP") {
                return $response
            }
        } catch {
        }
        Start-Sleep -Seconds 2
    }
    throw "Timed out waiting for health endpoint: $Url"
}

function Invoke-MariaDbCommand {
    param(
        [string]$Sql,
        [string]$Database
    )
    $arguments = @(
        "--protocol=tcp",
        "--host=127.0.0.1",
        "--port=$DbPort",
        "--user=root",
        "--password=$RootPassword",
        "--ssl=0",
        "--batch",
        "--raw",
        "--skip-column-names"
    )
    if ($Database) {
        $arguments += "--database=$Database"
    }
    $arguments += @("-e", $Sql)
    $output = & $mariaDbExe @arguments 2>&1
    $exitCode = Get-NativeCommandExitCode
    if ($exitCode -ne 0) {
        throw "MariaDB command failed: $($output -join [Environment]::NewLine)"
    }
    return $output
}

function Ensure-MariaDbDistribution {
    Ensure-Directory -Path $mariaRoot
    Ensure-Directory -Path $distRoot

    if ((Test-Path -LiteralPath $mariaDbDumpExe) -and (Test-Path -LiteralPath $mariaDbdExe)) {
        return
    }

    if (-not (Test-Path -LiteralPath $msiPath)) {
        Write-Step "Downloading MariaDB $MariaDbVersion MSI"
        $ProgressPreference = "SilentlyContinue"
        Invoke-WebRequest -Uri $installerUrl -OutFile $msiPath
    }

    Write-Step "Extracting MariaDB binaries to $distRoot"
    $extract = Start-Process -FilePath "msiexec.exe" -ArgumentList "/a", $msiPath, "/qn", "TARGETDIR=$distRoot" -Wait -PassThru
    if ($extract.ExitCode -ne 0) {
        throw "msiexec extraction failed with exit code $($extract.ExitCode)"
    }

    if ((Test-Path -LiteralPath $legacyInstallRoot) -and -not (Test-Path -LiteralPath $installRoot)) {
        Move-Item -LiteralPath $legacyInstallRoot -Destination $installRoot
    }

    if (-not (Test-Path -LiteralPath $mariaDbDumpExe)) {
        throw "Failed to resolve mariadb-dump.exe after extraction."
    }
}

function Ensure-MariaDbInitialized {
    Ensure-Directory -Path $runtimeRoot
    Ensure-Directory -Path $dataDir
    Ensure-Directory -Path $tmpDir
    Ensure-Directory -Path $logDir

    if (Test-Path -LiteralPath (Join-Path $dataDir "mysql")) {
        return
    }

    Write-Step "Initializing MariaDB data directory"
    $init = & $installDbExe "--datadir=$dataDir" "--password=$RootPassword" "--port=$DbPort" "--allow-remote-root-access" "--silent" 2>&1
    $exitCode = Get-NativeCommandExitCode
    if ($exitCode -ne 0) {
        throw "mariadb-install-db failed: $($init -join [Environment]::NewLine)"
    }
}

function Update-MariaDbConfig {
    $content = @"
[mysqld]
datadir=$($dataDir -replace "\\", "/")
port=$DbPort
bind-address=127.0.0.1
tmpdir=$($tmpDir -replace "\\", "/")
[client]
port=$DbPort
plugin-dir=$($installRoot -replace "\\", "/")/lib/plugin
"@
    Set-Content -Path $myIniPath -Value $content -Encoding ASCII
}

function Ensure-MariaDbServer {
    $existing = @(Get-ListeningProcesses -Port $DbPort)
    if ($existing.Count -gt 0) {
        $serverProcess = $existing | Where-Object { $_.ProcessName -in @("mariadbd", "mysqld") } | Select-Object -First 1
        if (-not $serverProcess) {
            $summary = ($existing | ForEach-Object { "$($_.ProcessName) ($($_.Id))" }) -join ", "
            throw "Port $DbPort is already in use by $summary."
        }
        Write-Step "MariaDB already listening on port $DbPort via pid $($serverProcess.Id)"
        return
    }

    Write-Step "Starting MariaDB on port $DbPort"
    if (Test-Path -LiteralPath $mariaStdout) {
        Remove-Item -LiteralPath $mariaStdout -Force
    }
    if (Test-Path -LiteralPath $mariaStderr) {
        Remove-Item -LiteralPath $mariaStderr -Force
    }

    $arguments = @(
        "--defaults-file=$myIniPath",
        "--basedir=$installRoot",
        "--console",
        "--standalone",
        "--skip-ssl"
    )
    Start-Process -FilePath $mariaDbdExe -ArgumentList $arguments -RedirectStandardOutput $mariaStdout -RedirectStandardError $mariaStderr | Out-Null

    if (-not (Wait-ForPort -Port $DbPort -TimeoutSeconds 30)) {
        $stderr = if (Test-Path -LiteralPath $mariaStderr) { Get-Content -Path $mariaStderr -Raw } else { "" }
        throw "MariaDB failed to listen on port $DbPort. $stderr"
    }
}

function Ensure-DatabaseAndUser {
    Write-Step "Creating database and backup test user"
    $sql = @"
CREATE DATABASE IF NOT EXISTS $DatabaseName CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER IF NOT EXISTS '$DatabaseUser'@'localhost' IDENTIFIED BY '$DatabasePassword';
CREATE USER IF NOT EXISTS '$DatabaseUser'@'127.0.0.1' IDENTIFIED BY '$DatabasePassword';
GRANT ALL PRIVILEGES ON $DatabaseName.* TO '$DatabaseUser'@'localhost';
GRANT ALL PRIVILEGES ON $DatabaseName.* TO '$DatabaseUser'@'127.0.0.1';
FLUSH PRIVILEGES;
"@
    Invoke-MariaDbCommand -Sql $sql -Database ""
}

function Start-BackendIfNeeded {
    Ensure-Directory -Path $tmpRoot
    Ensure-Directory -Path $backupRoot

    $existing = @(Get-ListeningProcesses -Port $AppPort)
    if ($existing.Count -gt 0) {
        $summary = ($existing | ForEach-Object { "$($_.ProcessName) ($($_.Id))" }) -join ", "
        Write-Step "Backend already listening on port $AppPort via $summary"
        return
    }

    Write-Step "Starting backend on port $AppPort against $jdbcUrl"
    $launcher = @"
`$env:APP_DB_URL = '$jdbcUrl'
`$env:APP_DB_USERNAME = '$DatabaseUser'
`$env:APP_DB_PASSWORD = '$DatabasePassword'
`$env:APP_DB_DRIVER = 'org.mariadb.jdbc.Driver'
`$env:APP_DB_DUMP_COMMAND = '$mariaDbDumpExe'
`$env:APP_BACKUP_ROOT_PATH = '$backupRoot'
Set-Location '$backendDir'
.\gradlew.bat bootRun --args='--spring.profiles.active=local --server.port=$AppPort'
"@
    Set-Content -Path $launcherPath -Value $launcher -Encoding ASCII

    if (Test-Path -LiteralPath $backendStdout) {
        Remove-Item -LiteralPath $backendStdout -Force
    }
    if (Test-Path -LiteralPath $backendStderr) {
        Remove-Item -LiteralPath $backendStderr -Force
    }

    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoLogo", "-NoProfile", "-File", $launcherPath -RedirectStandardOutput $backendStdout -RedirectStandardError $backendStderr | Out-Null
}

function Invoke-BackupVerification {
    Write-Step "Waiting for backend health endpoint"
    $health = Wait-ForHealth -Url $healthUrl -TimeoutSeconds 180

    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $loginBody = @{ loginId = $AdminLoginId; password = $AdminPassword } | ConvertTo-Json -Compress
    $login = Invoke-RestMethod -Method Post -Uri $loginUrl -ContentType "application/json" -Body $loginBody -WebSession $session

    if ($login.data.user.loginId -ne $AdminLoginId) {
        throw "Unexpected login user: $($login.data.user.loginId)"
    }

    $backupBody = @{ reason = $BackupReason } | ConvertTo-Json -Compress
    $backup = Invoke-RestMethod -Method Post -Uri $runBackupUrl -ContentType "application/json" -Body $backupBody -WebSession $session
    $history = Invoke-RestMethod -Method Get -Uri $listBackupsUrl -WebSession $session

    if ($backup.data.status -ne "SUCCESS") {
        throw "Backup request returned status $($backup.data.status)"
    }
    if ($backup.data.backupMethod -ne "DB_DUMP") {
        throw "Expected backupMethod=DB_DUMP but got $($backup.data.backupMethod)"
    }
    if ($backup.data.datasourceType -notin @("MARIADB", "MYSQL")) {
        throw "Expected datasourceType=MARIADB or MYSQL but got $($backup.data.datasourceType)"
    }
    if (-not ($backup.data.fileName -like "*.sql")) {
        throw "Expected SQL dump output but got $($backup.data.fileName)"
    }
    if (-not (Test-Path -LiteralPath $backup.data.filePath)) {
        throw "Backup file does not exist: $($backup.data.filePath)"
    }

    $file = Get-Item -LiteralPath $backup.data.filePath
    if ($file.Length -le 0) {
        throw "Backup file is empty: $($backup.data.filePath)"
    }

    if (-not $history.data.items -or $history.data.items.Count -lt 1) {
        throw "Backup history API returned no items."
    }
    $latestHistory = $history.data.items[0]
    if ($latestHistory.backupMethod -ne "DB_DUMP" -or $latestHistory.status -ne "SUCCESS") {
        throw "Latest backup history API item does not show DB_DUMP SUCCESS: $($latestHistory | ConvertTo-Json -Compress)"
    }

    return [pscustomobject]@{
        healthStatus = $health.data.status
        loginUser = $login.data.user.loginId
        backupMethod = $backup.data.backupMethod
        datasourceType = $backup.data.datasourceType
        backupStatus = $backup.data.status
        fileName = $backup.data.fileName
        filePath = $backup.data.filePath
        fileSizeBytes = $file.Length
        preflightSummary = $backup.data.preflightSummary
        latestHistoryId = $latestHistory.backupId
        latestHistoryMethod = $latestHistory.backupMethod
        latestHistoryStatus = $latestHistory.status
        latestHistoryFileName = $latestHistory.fileName
        latestHistoryStartedAt = $latestHistory.startedAt
        latestHistoryCompletedAt = $latestHistory.completedAt
        latestHistoryExecutedBy = $latestHistory.executedByName
        appPort = $AppPort
        dbPort = $DbPort
        dumpCommand = $mariaDbDumpExe
        apiHistoryMethod = $history.data.items[0].backupMethod
    }
}

Write-Step "Preparing local MariaDB DB_DUMP verification environment"
Ensure-MariaDbDistribution
Ensure-MariaDbInitialized
Update-MariaDbConfig
Ensure-MariaDbServer
Ensure-DatabaseAndUser
Start-BackendIfNeeded
$result = Invoke-BackupVerification
Write-Step "DB_DUMP verification passed"
$result | ConvertTo-Json -Depth 5

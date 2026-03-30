[CmdletBinding()]
param(
    [string]$TaskName = "DasiseogiLocalMariaDbBackup",
    [string]$DailyTime = "23:35"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$runnerPath = Join-Path $PSScriptRoot "run-docker-mariadb-backup.ps1"
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

if (-not (Test-Path -LiteralPath $runnerPath)) {
    throw "Missing runner script: $runnerPath"
}

try {
    $parsedTime = [DateTime]::ParseExact($DailyTime, "HH:mm", [System.Globalization.CultureInfo]::InvariantCulture)
} catch {
    throw "DailyTime must use HH:mm format, for example 23:35."
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$runnerPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At $parsedTime
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Creates a daily MariaDB dump from the local Docker container." `
    -Force | Out-Null

Write-Host "[register-docker-mariadb-backup-task] registered $TaskName for $DailyTime ($currentUser)"

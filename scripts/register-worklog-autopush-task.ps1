[CmdletBinding()]
param(
    [string]$TaskName = "DasiseogiWorklogAutoPush",
    [string]$DailyTime = "23:50"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$runnerPath = Join-Path $PSScriptRoot "publish-worklog.bat"
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

if (-not (Test-Path -LiteralPath $runnerPath)) {
    throw "Missing runner script: $runnerPath"
}

try {
    $parsedTime = [DateTime]::ParseExact($DailyTime, "HH:mm", [System.Globalization.CultureInfo]::InvariantCulture)
} catch {
    throw "DailyTime must use HH:mm format, for example 23:50."
}

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$runnerPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At $parsedTime
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Updates the daily worklog and pushes it to GitHub." `
    -Force | Out-Null

Write-Host "[register-worklog-autopush] registered $TaskName for $DailyTime ($currentUser)"

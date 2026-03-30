[CmdletBinding()]
param(
    [string]$AutoStartName = "DasiseogiRepoAutoPushWatcher",
    [int]$DebounceSeconds = 5,
    [string]$LegacyTaskName = "DasiseogiWorklogAutoPush",
    [string]$Branch = "main"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$watcherScript = Join-Path $PSScriptRoot "watch-and-publish-repo.ps1"
$runKeyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$watcherArguments = @(
    "-NoLogo",
    "-NoProfile",
    "-WindowStyle", "Hidden",
    "-ExecutionPolicy", "Bypass",
    "-File", $watcherScript,
    "-DebounceSeconds", $DebounceSeconds,
    "-Branch", $Branch
)
$watcherCommand = 'powershell.exe ' + (($watcherArguments | ForEach-Object {
    if ($_ -match '\s') { '"' + $_ + '"' } else { $_ }
}) -join ' ')

if (-not (Test-Path -LiteralPath $watcherScript)) {
    throw "Missing watcher script: $watcherScript"
}

if (-not (Test-Path -LiteralPath $runKeyPath)) {
    New-Item -Path $runKeyPath -Force | Out-Null
}

New-ItemProperty -Path $runKeyPath -Name $AutoStartName -Value $watcherCommand -PropertyType String -Force | Out-Null

try {
    schtasks /Delete /TN $LegacyTaskName /F 2>$null | Out-Null
} catch {
}

$watcherProcesses = @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match '^powershell(\.exe)?$' -and $_.CommandLine -like '*watch-and-publish-repo.ps1*'
})

foreach ($watcherProcess in $watcherProcesses) {
    Stop-Process -Id $watcherProcess.ProcessId -Force -ErrorAction SilentlyContinue
}

$process = Start-Process -FilePath "powershell.exe" -ArgumentList $watcherArguments -WindowStyle Hidden -PassThru

Write-Host "[register-repo-autopush-watcher] autostart enabled via HKCU Run and watcher launched for branch $Branch (pid $($process.Id))"

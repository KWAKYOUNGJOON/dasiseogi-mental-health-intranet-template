[CmdletBinding()]
param(
    [string]$AutoStartName = "DasiseogiRepoAutoPushWatcher"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$runKeyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

if (Get-ItemProperty -Path $runKeyPath -Name $AutoStartName -ErrorAction SilentlyContinue) {
    Remove-ItemProperty -Path $runKeyPath -Name $AutoStartName -Force
    Write-Host "[unregister-repo-autopush-watcher] removed HKCU Run entry $AutoStartName"
} else {
    Write-Host "[unregister-repo-autopush-watcher] HKCU Run entry not found: $AutoStartName"
}

$watcherProcesses = @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match '^powershell(\.exe)?$' -and $_.CommandLine -like '*watch-and-publish-repo.ps1*'
})

foreach ($process in $watcherProcesses) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

Write-Host "[unregister-repo-autopush-watcher] stopped $($watcherProcesses.Count) watcher process(es)"

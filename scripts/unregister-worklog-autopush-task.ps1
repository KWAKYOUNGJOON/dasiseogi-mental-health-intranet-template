[CmdletBinding()]
param(
    [string]$TaskName = "DasiseogiWorklogAutoPush"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Host "[unregister-worklog-autopush] task not found: $TaskName"
    exit 0
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "[unregister-worklog-autopush] removed $TaskName"

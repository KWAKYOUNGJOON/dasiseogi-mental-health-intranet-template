[CmdletBinding()]
param(
    [int]$DebounceSeconds = 5,
    [string]$Remote = "origin",
    [string]$Branch,
    [switch]$SkipWorklogUpdate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$publishScript = Join-Path $PSScriptRoot "publish-repo.ps1"
$logRoot = Join-Path $repoRoot "logs"
$logPath = Join-Path $logRoot "repo-autopush-watcher.log"
$mutexName = "Local\DasiseogiRepoAutoPushWatcher"
$ignoredPrefixes = @(
    ".git/",
    "tmp/",
    "backend/backend/data/",
    "backend/data/",
    "backend/build/",
    "backend/.gradle/",
    "backend/logs/",
    "frontend/node_modules/",
    "frontend/dist/",
    "local-backups/",
    "logs/"
)

function Ensure-Directory {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Write-Log {
    param([string]$Message)

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "$timestamp $Message"
    Write-Host $line
    Add-Content -LiteralPath $logPath -Value $line
}

if (-not (Test-Path -LiteralPath $publishScript)) {
    throw "Missing publish script: $publishScript"
}

Ensure-Directory -Path $logRoot

$mutex = New-Object System.Threading.Mutex($false, $mutexName)
$hasHandle = $false

try {
    $hasHandle = $mutex.WaitOne(0, $false)
    if (-not $hasHandle) {
        Write-Log "[watcher] another watcher instance is already running"
        exit 0
    }

    $state = [hashtable]::Synchronized(@{
        Pending = $false
        LastEventAt = [DateTime]::MinValue
        IgnoreUntil = [DateTime]::MinValue
        IsPublishing = $false
        LastPath = ""
    })

    $watcher = New-Object System.IO.FileSystemWatcher
    $watcher.Path = $repoRoot
    $watcher.Filter = "*"
    $watcher.IncludeSubdirectories = $true
    $watcher.NotifyFilter = [System.IO.NotifyFilters]"FileName, DirectoryName, LastWrite, CreationTime"

    $action = {
        $sharedState = $using:state
        $eventPath = $null
        if ($Event.SourceEventArgs.PSObject.Properties.Name -contains "FullPath") {
            $eventPath = $Event.SourceEventArgs.FullPath
        }
        if ([string]::IsNullOrWhiteSpace($eventPath) -and ($Event.SourceEventArgs.PSObject.Properties.Name -contains "OldFullPath")) {
            $eventPath = $Event.SourceEventArgs.OldFullPath
        }
        if ([string]::IsNullOrWhiteSpace($eventPath)) {
            return
        }
        if ((Get-Date) -lt $sharedState.IgnoreUntil) {
            return
        }
        if (-not $eventPath.StartsWith($using:repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            return
        }

        $relative = $eventPath.Substring($using:repoRoot.Length).TrimStart([char[]]"\/").Replace("\", "/")
        if ([string]::IsNullOrWhiteSpace($relative)) {
            return
        }

        foreach ($prefix in $using:ignoredPrefixes) {
            if ($relative.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                return
            }
        }

        $name = [System.IO.Path]::GetFileName($relative)
        if ($name -match '(^~\$)|(\.tmp$)|(\.temp$)|(\.swp$)|(~$)|(^\.#)') {
            return
        }

        $sharedState.Pending = $true
        $sharedState.LastEventAt = Get-Date
        $sharedState.LastPath = $relative
    }

    $subscriptions = @(
        (Register-ObjectEvent -InputObject $watcher -EventName Changed -Action $action),
        (Register-ObjectEvent -InputObject $watcher -EventName Created -Action $action),
        (Register-ObjectEvent -InputObject $watcher -EventName Deleted -Action $action),
        (Register-ObjectEvent -InputObject $watcher -EventName Renamed -Action $action)
    )

    $watcher.EnableRaisingEvents = $true
    Write-Log "[watcher] started for $repoRoot"

    while ($true) {
        Start-Sleep -Seconds 1

        if ($state.IsPublishing -or -not $state.Pending) {
            continue
        }

        if ((Get-Date) -lt $state.LastEventAt.AddSeconds($DebounceSeconds)) {
            continue
        }

        $state.Pending = $false
        $state.IsPublishing = $true
        $changedPath = $state.LastPath

        try {
            Write-Log "[watcher] change detected: $changedPath"
            $publishArgs = @{
                Remote = $Remote
            }
            if (-not [string]::IsNullOrWhiteSpace($Branch)) {
                $publishArgs.Branch = $Branch
            }
            if ($SkipWorklogUpdate) {
                $publishArgs.SkipWorklogUpdate = $true
            }

            $output = & $publishScript @publishArgs 2>&1
            foreach ($line in @($output)) {
                if (-not [string]::IsNullOrWhiteSpace($line)) {
                    Write-Log ($line.ToString())
                }
            }

            $state.IgnoreUntil = (Get-Date).AddSeconds($DebounceSeconds)
        } catch {
            Write-Log "[watcher] publish failed: $($_.Exception.Message)"
            $state.IgnoreUntil = (Get-Date).AddSeconds(2)
        } finally {
            $state.IsPublishing = $false
        }
    }
} finally {
    if ($watcher) {
        $watcher.EnableRaisingEvents = $false
    }
    if ($subscriptions) {
        foreach ($subscription in $subscriptions) {
            if ($subscription) {
                Unregister-Event -SubscriptionId $subscription.Id -ErrorAction SilentlyContinue
                Remove-Job -Id $subscription.Id -Force -ErrorAction SilentlyContinue
            }
        }
    }
    if ($watcher) {
        $watcher.Dispose()
    }
    if ($hasHandle -and $mutex) {
        $mutex.ReleaseMutex() | Out-Null
    }
    if ($mutex) {
        $mutex.Dispose()
    }
}

[CmdletBinding()]
param(
    [string]$Date = (Get-Date -Format "yyyy-MM-dd"),
    [string]$Remote = "origin",
    [string]$CommitMessage,
    [switch]$SkipWorklogUpdate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$updateScriptPath = Join-Path $PSScriptRoot "update-worklog.ps1"
$publishTargets = @(
    "worklog",
    "scripts/update-worklog.ps1",
    "scripts/update-worklog.bat",
    "scripts/publish-worklog.ps1",
    "scripts/publish-worklog.bat",
    "scripts/register-worklog-autopush-task.ps1",
    "scripts/unregister-worklog-autopush-task.ps1"
)

function Write-Step {
    param([string]$Message)
    Write-Host "[publish-worklog] $Message"
}

function Invoke-Git {
    param([string[]]$Arguments)

    $output = & git -C $repoRoot @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        $message = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
        throw "Git command failed: git $($Arguments -join ' ')$([Environment]::NewLine)$message"
    }

    return @(
        $output |
            ForEach-Object { $_.ToString() } |
            Where-Object { $_ -and -not $_.StartsWith("warning:", [System.StringComparison]::OrdinalIgnoreCase) }
    )
}

if (-not (Test-Path -LiteralPath $updateScriptPath)) {
    throw "Missing script: $updateScriptPath"
}

$null = Invoke-Git -Arguments @("rev-parse", "--show-toplevel")
$branch = (Invoke-Git -Arguments @("rev-parse", "--abbrev-ref", "HEAD") | Select-Object -First 1)

if ([string]::IsNullOrWhiteSpace($branch) -or $branch -eq "HEAD") {
    throw "Current checkout is detached. Switch to a branch before publishing."
}

if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
    $CommitMessage = "docs(worklog): update $Date"
}

if (-not $SkipWorklogUpdate) {
    Write-Step "Updating worklog for $Date"
    & $updateScriptPath -Date $Date
    if ($LASTEXITCODE -ne 0) {
        throw "Worklog update failed."
    }
}

$targetStatus = @(Invoke-Git -Arguments (@("status", "--porcelain=v1", "--untracked-files=all", "--") + $publishTargets))
if ($targetStatus.Count -eq 0) {
    Write-Step "No publishable changes detected. Nothing to commit."
    exit 0
}

Write-Step "Staging worklog automation files"
$null = Invoke-Git -Arguments (@("add", "--all", "--") + $publishTargets)

$stagedTargets = @(Invoke-Git -Arguments (@("diff", "--cached", "--name-only", "--") + $publishTargets))
if ($stagedTargets.Count -eq 0) {
    Write-Step "No staged publishable changes found after git add."
    exit 0
}

Write-Step "Creating commit: $CommitMessage"
$null = Invoke-Git -Arguments (@("commit", "--only", "-m", $CommitMessage, "--") + $publishTargets)

Write-Step "Pushing to $Remote/$branch"
$null = Invoke-Git -Arguments @("push", $Remote, $branch)

Write-Step "Publish completed"

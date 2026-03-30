[CmdletBinding()]
param(
    [string]$Remote = "origin",
    [string]$Branch,
    [string]$CommitMessage,
    [switch]$SkipWorklogUpdate,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$updateWorklogScript = Join-Path $PSScriptRoot "update-worklog.ps1"

function Write-Step {
    param([string]$Message)
    Write-Host "[publish-repo] $Message"
}

function Invoke-Git {
    param([string[]]$Arguments)

    $stdoutPath = [System.IO.Path]::GetTempFileName()
    $stderrPath = [System.IO.Path]::GetTempFileName()
    $gitExecutable = (Get-Command git).Source

    try {
        $process = Start-Process `
            -FilePath $gitExecutable `
            -ArgumentList (@("-C", $repoRoot) + $Arguments) `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath `
            -Wait `
            -NoNewWindow `
            -PassThru

        $stdoutLines = if ((Test-Path -LiteralPath $stdoutPath) -and ((Get-Item -LiteralPath $stdoutPath).Length -gt 0)) {
            Get-Content -LiteralPath $stdoutPath
        } else {
            @()
        }
        $stderrLines = if ((Test-Path -LiteralPath $stderrPath) -and ((Get-Item -LiteralPath $stderrPath).Length -gt 0)) {
            Get-Content -LiteralPath $stderrPath
        } else {
            @()
        }
    } finally {
        foreach ($path in @($stdoutPath, $stderrPath)) {
            if (Test-Path -LiteralPath $path) {
                Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
            }
        }
    }

    $output = @($stdoutLines + $stderrLines)

    if ($process.ExitCode -ne 0) {
        $message = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
        throw "Git command failed: git $($Arguments -join ' ')$([Environment]::NewLine)$message"
    }

    return @(
        $output |
            ForEach-Object { $_.ToString() } |
            Where-Object { $_ -and -not $_.StartsWith("warning:", [System.StringComparison]::OrdinalIgnoreCase) }
    )
}

function Get-StatusLines {
    return @(Invoke-Git -Arguments @("status", "--porcelain=v1", "--untracked-files=all"))
}

function Get-StagedPaths {
    return @(Invoke-Git -Arguments @("diff", "--cached", "--name-only"))
}

function Get-TopAreas {
    param([string[]]$Paths)

    $areas = @(
        $Paths |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            ForEach-Object {
                $normalized = $_.Replace("\", "/")
                if ($normalized.Contains("/")) {
                    ($normalized -split "/", 2)[0]
                } else {
                    "(root)"
                }
            } |
            Group-Object |
            Sort-Object -Property @(
                @{ Expression = { $_.Count }; Descending = $true },
                @{ Expression = { $_.Name }; Descending = $false }
            ) |
            Select-Object -First 3 -ExpandProperty Name
    )

    return $areas
}

$null = Invoke-Git -Arguments @("rev-parse", "--show-toplevel")

if ([string]::IsNullOrWhiteSpace($Branch)) {
    $Branch = (Invoke-Git -Arguments @("rev-parse", "--abbrev-ref", "HEAD") | Select-Object -First 1)
}

if ([string]::IsNullOrWhiteSpace($Branch) -or $Branch -eq "HEAD") {
    throw "Current checkout is detached. Switch to a branch before auto-publishing."
}

$unmerged = @(Invoke-Git -Arguments @("diff", "--name-only", "--diff-filter=U"))
if ($unmerged.Count -gt 0) {
    throw "Unmerged files are present. Resolve conflicts before auto-publishing."
}

$statusBeforeWorklog = Get-StatusLines
if ($statusBeforeWorklog.Count -eq 0) {
    Write-Step "No publishable changes detected."
    exit 0
}

if (-not $DryRun -and -not $SkipWorklogUpdate -and (Test-Path -LiteralPath $updateWorklogScript)) {
    Write-Step "Updating worklog before publish"
    & $updateWorklogScript
    if ($LASTEXITCODE -ne 0) {
        throw "Worklog update failed."
    }
}

$statusLines = Get-StatusLines
if ($statusLines.Count -eq 0) {
    Write-Step "No publishable changes remain after worklog update."
    exit 0
}

if ($DryRun) {
    Write-Step "Dry run: $($statusLines.Count) path(s) would be published."
    foreach ($line in $statusLines | Select-Object -First 20) {
        Write-Host $line
    }
    if ($statusLines.Count -gt 20) {
        Write-Host "... $($statusLines.Count - 20) more"
    }
    exit 0
}

Write-Step "Staging publishable changes"
$null = Invoke-Git -Arguments @("add", "-A")

$stagedPaths = Get-StagedPaths
if ($stagedPaths.Count -eq 0) {
    Write-Step "No staged changes found after git add."
    exit 0
}

if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
    $areas = Get-TopAreas -Paths $stagedPaths
    $suffix = if ($areas.Count -gt 0) { " [" + ($areas -join ", ") + "]" } else { "" }
    $CommitMessage = "chore(auto-sync): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')$suffix"
}

Write-Step "Creating commit: $CommitMessage"
$null = Invoke-Git -Arguments @("commit", "-m", $CommitMessage)

Write-Step "Pushing to $Remote/$Branch"
$null = Invoke-Git -Arguments @("push", $Remote, $Branch)

Write-Step "Publish completed"

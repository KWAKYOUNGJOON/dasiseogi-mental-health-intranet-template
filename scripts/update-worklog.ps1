[CmdletBinding()]
param(
    [string]$Date = (Get-Date -Format "yyyy-MM-dd"),
    [int]$MaxCommitItems = 10,
    [int]$MaxChangedFiles = 25,
    [switch]$OpenFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$worklogRoot = Join-Path $repoRoot "worklog"
$dailyRoot = Join-Path $worklogRoot "daily"
$templatePath = Join-Path $worklogRoot "_template.md"
$yearRoot = Join-Path $dailyRoot $Date.Substring(0, 4)
$targetPath = Join-Path $yearRoot "$Date.md"
$autoStartMarker = "<!-- AUTO-GENERATED:START -->"
$autoEndMarker = "<!-- AUTO-GENERATED:END -->"
$excludedPrefixes = @(
    "worklog/",
    "tmp/",
    "local-backups/",
    "logs/",
    "backend/backend/data/"
)

function Ensure-Directory {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
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

function Normalize-Path {
    param([string]$Path)

    return $Path.Replace("\", "/")
}

function Test-IncludedPath {
    param([string]$Path)

    $normalized = Normalize-Path -Path $Path
    foreach ($prefix in $excludedPrefixes) {
        if ($normalized.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $false
        }
    }

    return $true
}

function Get-TopLevelBucket {
    param([string]$Path)

    $normalized = Normalize-Path -Path $Path
    if ($normalized.Contains("/")) {
        return ($normalized -split "/", 2)[0]
    }

    return "(root)"
}

function Get-ChangeLabel {
    param(
        [string]$IndexStatus,
        [string]$WorktreeStatus
    )

    if ($IndexStatus -eq "?" -and $WorktreeStatus -eq "?") {
        return "신규"
    }
    if ($IndexStatus -eq "D" -or $WorktreeStatus -eq "D") {
        return "삭제"
    }
    if ($IndexStatus -eq "R" -or $WorktreeStatus -eq "R") {
        return "이동"
    }
    if ($IndexStatus -eq "A") {
        return "스테이징 추가"
    }
    if ($IndexStatus -eq "M" -and $WorktreeStatus -eq "M") {
        return "스테이징+수정"
    }
    if ($IndexStatus -ne " " -and $IndexStatus -ne "?") {
        return "스테이징 변경"
    }
    if ($WorktreeStatus -ne " " -and $WorktreeStatus -ne "?") {
        return "작업중 변경"
    }

    return "변경"
}

function Get-WorkingTreeChanges {
    $statusLines = Invoke-Git -Arguments @("status", "--porcelain=v1", "--untracked-files=all")
    $changes = @()

    foreach ($line in $statusLines) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.Length -lt 4) {
            continue
        }

        $indexStatus = $line.Substring(0, 1)
        $worktreeStatus = $line.Substring(1, 1)
        $path = $line.Substring(3).Trim()
        if ($path.Contains(" -> ")) {
            $path = ($path -split " -> ")[-1]
        }

        if (-not (Test-IncludedPath -Path $path)) {
            continue
        }

        $changes += [pscustomobject]@{
            IndexStatus = $indexStatus
            WorktreeStatus = $worktreeStatus
            Path = Normalize-Path -Path $path
            Label = Get-ChangeLabel -IndexStatus $indexStatus -WorktreeStatus $worktreeStatus
        }
    }

    return $changes
}

function Get-TodaysCommits {
    $commitLines = Invoke-Git -Arguments @(
        "log",
        "--since=$Date 00:00:00",
        "--date=format:%H:%M",
        "--pretty=format:%h|%ad|%s"
    )

    $commits = @()
    foreach ($line in $commitLines) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        $parts = $line -split "\|", 3
        if ($parts.Length -lt 3) {
            continue
        }

        $commits += [pscustomobject]@{
            Hash = $parts[0]
            Time = $parts[1]
            Subject = $parts[2]
        }
    }

    return $commits
}

function Format-SummaryList {
    param([object[]]$Items)

    $itemsArray = @($Items)

    if (-not $itemsArray -or $itemsArray.Count -eq 0) {
        return "없음"
    }

    return ($itemsArray | ForEach-Object { "$($_.Name) $($_.Count)건" }) -join ", "
}

function Build-AutoBlock {
    param(
        [string]$Branch,
        [object[]]$Commits,
        [object[]]$Changes
    )

    $stagedCount = @($Changes | Where-Object { $_.IndexStatus -ne " " -and $_.IndexStatus -ne "?" }).Count
    $worktreeCount = @($Changes | Where-Object { $_.WorktreeStatus -ne " " -and $_.WorktreeStatus -ne "?" }).Count
    $newCount = @($Changes | Where-Object { $_.IndexStatus -eq "?" -and $_.WorktreeStatus -eq "?" }).Count
    $topAreas = @(
        $Changes |
            Group-Object { Get-TopLevelBucket -Path $_.Path } |
            Sort-Object -Property @(
                @{ Expression = { $_.Count }; Descending = $true },
                @{ Expression = { $_.Name }; Descending = $false }
            ) |
            Select-Object -First 5 @{ Name = "Name"; Expression = { $_.Name } }, Count
    )

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add($autoStartMarker)
    $lines.Add("- 마지막 갱신: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')")
    $lines.Add("- 브랜치: $Branch")
    $lines.Add("- 오늘 커밋: $($Commits.Count)건")
    $lines.Add("- 현재 변경 파일: $($Changes.Count)건")
    $lines.Add("- 스테이징된 변경: ${stagedCount}건")
    $lines.Add("- 작업 트리 변경: ${worktreeCount}건")
    $lines.Add("- 신규 파일: ${newCount}건")
    $lines.Add("- 상위 변경 영역: $(Format-SummaryList -Items $topAreas)")
    $lines.Add("")
    $lines.Add("### 오늘 커밋")
    if ($Commits.Count -eq 0) {
        $lines.Add("- 없음")
    } else {
        foreach ($commit in ($Commits | Select-Object -First $MaxCommitItems)) {
            $lines.Add("- [$($commit.Time)] ``$($commit.Hash)`` $($commit.Subject)")
        }
        if ($Commits.Count -gt $MaxCommitItems) {
            $lines.Add("- ...외 $($Commits.Count - $MaxCommitItems)건")
        }
    }

    $lines.Add("")
    $lines.Add("### 현재 변경 파일")
    if ($Changes.Count -eq 0) {
        $lines.Add("- 없음")
    } else {
        foreach ($change in ($Changes | Select-Object -First $MaxChangedFiles)) {
            $lines.Add("- [$($change.Label)] ``$($change.Path)``")
        }
        if ($Changes.Count -gt $MaxChangedFiles) {
            $lines.Add("- ...외 $($Changes.Count - $MaxChangedFiles)건")
        }
    }

    $lines.Add($autoEndMarker)
    return $lines -join [Environment]::NewLine
}

function Ensure-LogFile {
    Ensure-Directory -Path $worklogRoot
    Ensure-Directory -Path $dailyRoot
    Ensure-Directory -Path $yearRoot

    if (Test-Path -LiteralPath $targetPath) {
        return
    }

    if (-not (Test-Path -LiteralPath $templatePath)) {
        throw "Template not found: $templatePath"
    }

    $template = Get-Content -LiteralPath $templatePath -Raw
    $content = $template.Replace("{{DATE}}", $Date)
    Set-Content -LiteralPath $targetPath -Value $content -Encoding UTF8
}

function Update-AutoSection {
    param([string]$AutoBlock)

    $content = Get-Content -LiteralPath $targetPath -Raw
    $pattern = "(?s)<!-- AUTO-GENERATED:START -->.*?<!-- AUTO-GENERATED:END -->"

    if ($content -match $pattern) {
        $updated = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $AutoBlock })
    } else {
        $updated = $AutoBlock + [Environment]::NewLine + [Environment]::NewLine + $content
    }

    Set-Content -LiteralPath $targetPath -Value $updated -Encoding UTF8
}

$null = Invoke-Git -Arguments @("rev-parse", "--show-toplevel")
$branch = (Invoke-Git -Arguments @("rev-parse", "--abbrev-ref", "HEAD") | Select-Object -First 1)
$commits = @(Get-TodaysCommits)
$changes = @(Get-WorkingTreeChanges)
$autoBlock = Build-AutoBlock -Branch $branch -Commits $commits -Changes $changes

Ensure-LogFile
Update-AutoSection -AutoBlock $autoBlock

Write-Host "[worklog] updated $targetPath"

if ($OpenFile) {
    Start-Process $targetPath | Out-Null
}

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DbHost,

    [int]$DbPort = 3306,

    [Parameter(Mandatory = $true)]
    [string]$DbName,

    [Parameter(Mandatory = $true)]
    [string]$DbUsername,

    [Parameter(Mandatory = $true)]
    [string]$DbPassword,

    [int]$ServerPort = 8080,

    [string]$BackupRootPath = "",

    [string]$DbDumpCommand = "mariadb-dump",

    [string]$ScaleResourcePath = "classpath:scales",

    [string]$ExportTempPath = "",

    [switch]$SkipBackupCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$script:BackendDir = Join-Path $script:RepoRoot "backend"
$script:GradleWrapperJarPath = Join-Path $script:BackendDir "gradle\wrapper\gradle-wrapper.jar"
$script:ResourceRoot = Join-Path $script:BackendDir "src\main\resources"
$script:JavaExePath = $null

function Stop-Script {
    param(
        [string]$Message,
        [int]$ExitCode = 1
    )

    Write-Host "[run-local-mariadb-backend] ERROR: $Message"
    exit $ExitCode
}

function Assert-NotBlank {
    param(
        [string]$Name,
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        Stop-Script "$Name is required and must not be blank." 10
    }
}

function Resolve-RepoPath {
    param([string]$PathValue)

    Assert-NotBlank -Name "Path" -Value $PathValue

    try {
        if ([System.IO.Path]::IsPathRooted($PathValue)) {
            return [System.IO.Path]::GetFullPath($PathValue)
        }

        return [System.IO.Path]::GetFullPath((Join-Path $script:RepoRoot $PathValue))
    } catch {
        Stop-Script "Invalid path '$PathValue'. $($_.Exception.Message)" 11
    }
}

function Normalize-PathForArgument {
    param([string]$PathValue)

    return ($PathValue -replace "\\", "/")
}

function Ensure-WritableDirectory {
    param(
        [string]$RequestedPath,
        [string]$Label
    )

    $resolvedPath = Resolve-RepoPath -PathValue $RequestedPath

    if (Test-Path -LiteralPath $resolvedPath) {
        if (-not (Test-Path -LiteralPath $resolvedPath -PathType Container)) {
            Stop-Script "$Label must be a directory: $resolvedPath" 11
        }
    } else {
        try {
            New-Item -ItemType Directory -Path $resolvedPath -Force | Out-Null
        } catch {
            Stop-Script "$Label could not be created: $resolvedPath. $($_.Exception.Message)" 11
        }
    }

    $probePath = Join-Path $resolvedPath (".__write-test-" + [System.Guid]::NewGuid().ToString("N") + ".tmp")
    try {
        Set-Content -LiteralPath $probePath -Value "write-test" -Encoding ASCII
        Remove-Item -LiteralPath $probePath -Force
    } catch {
        if (Test-Path -LiteralPath $probePath) {
            Remove-Item -LiteralPath $probePath -Force -ErrorAction SilentlyContinue
        }
        Stop-Script "$Label is not writable: $resolvedPath. $($_.Exception.Message)" 11
    }

    return $resolvedPath
}

function Resolve-DumpCommandArgument {
    param(
        [string]$RequestedCommand,
        [bool]$SkipCheck
    )

    Assert-NotBlank -Name "DbDumpCommand" -Value $RequestedCommand

    $trimmedCommand = $RequestedCommand.Trim()
    $containsDirectorySeparator = $trimmedCommand.Contains("\") -or $trimmedCommand.Contains("/")

    if ($SkipCheck) {
        if ([System.IO.Path]::IsPathRooted($trimmedCommand) -or $containsDirectorySeparator) {
            return Normalize-PathForArgument -PathValue (Resolve-RepoPath -PathValue $trimmedCommand)
        }

        return $trimmedCommand
    }

    if ([System.IO.Path]::IsPathRooted($trimmedCommand) -or $containsDirectorySeparator) {
        $resolvedCommandPath = Resolve-RepoPath -PathValue $trimmedCommand
        if (-not (Test-Path -LiteralPath $resolvedCommandPath -PathType Leaf)) {
            Stop-Script "Db dump command not found: $resolvedCommandPath" 12
        }
        return Normalize-PathForArgument -PathValue $resolvedCommandPath
    }

    try {
        $command = Get-Command -Name $trimmedCommand -CommandType Application -ErrorAction Stop | Select-Object -First 1
        return Normalize-PathForArgument -PathValue $command.Source
    } catch {
        Stop-Script "Db dump command '$trimmedCommand' was not found in PATH. Pass -DbDumpCommand explicitly or use -SkipBackupCheck intentionally." 12
    }
}

function Resolve-ScaleResourceArgument {
    param([string]$RequestedPath)

    $configuredPath = if ([string]::IsNullOrWhiteSpace($RequestedPath)) { "classpath:scales" } else { $RequestedPath.Trim() }

    if ($configuredPath.StartsWith("classpath:", [System.StringComparison]::OrdinalIgnoreCase)) {
        $classpathPath = ($configuredPath -replace "\\", "/").Trim()
        while ($classpathPath.EndsWith("/")) {
            $classpathPath = $classpathPath.Substring(0, $classpathPath.Length - 1)
        }
        if ($classpathPath -eq "classpath:") {
            $classpathPath = "classpath:scales"
        }

        $relativePath = $classpathPath.Substring("classpath:".Length).TrimStart("/", "\")
        if ([string]::IsNullOrWhiteSpace($relativePath)) {
            $relativePath = "scales"
        }

        $resolvedBase = [System.IO.Path]::GetFullPath((Join-Path $script:ResourceRoot $relativePath))
        $normalizedResourceRoot = [System.IO.Path]::GetFullPath($script:ResourceRoot)
        if (-not $resolvedBase.StartsWith($normalizedResourceRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            Stop-Script "Scale resource path escapes backend resources: $classpathPath" 11
        }

        $registryPath = Join-Path $resolvedBase "common\scale-registry.json"
        if (-not (Test-Path -LiteralPath $registryPath -PathType Leaf)) {
            Stop-Script "Scale resource path must contain common\\scale-registry.json: $classpathPath" 11
        }

        return [PSCustomObject]@{
            ArgumentValue = $classpathPath
            SummaryValue  = "$classpathPath ($resolvedBase)"
        }
    }

    $resolvedFilesystemPath = Resolve-RepoPath -PathValue $configuredPath
    if (-not (Test-Path -LiteralPath $resolvedFilesystemPath -PathType Container)) {
        Stop-Script "Scale resource path directory not found: $resolvedFilesystemPath" 11
    }

    $filesystemRegistryPath = Join-Path $resolvedFilesystemPath "common\scale-registry.json"
    if (-not (Test-Path -LiteralPath $filesystemRegistryPath -PathType Leaf)) {
        Stop-Script "Scale resource path must contain common\\scale-registry.json: $resolvedFilesystemPath" 11
    }

    $argumentValue = Normalize-PathForArgument -PathValue $resolvedFilesystemPath
    return [PSCustomObject]@{
        ArgumentValue = $argumentValue
        SummaryValue  = $argumentValue
    }
}

function Convert-ToBootArgValue {
    param([string]$Value)

    if ($null -eq $Value) {
        return '""'
    }

    if ($Value.Contains("`r") -or $Value.Contains("`n")) {
        Stop-Script "Boot argument values must not contain new lines." 10
    }

    $escapedValue = [System.Text.RegularExpressions.Regex]::Replace($Value, '(\\*)"', '$1$1\"')
    $escapedValue = [System.Text.RegularExpressions.Regex]::Replace($escapedValue, '(\\+)$', '$1$1')
    return '"' + $escapedValue + '"'
}

function Build-BootArgString {
    param(
        [System.Collections.Specialized.OrderedDictionary]$Properties,
        [bool]$MaskPassword
    )

    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($entry in $Properties.GetEnumerator()) {
        $value = [string]$entry.Value
        if ($MaskPassword -and $entry.Key -eq "spring.datasource.password") {
            $value = "<hidden>"
        }
        $parts.Add("--$($entry.Key)=" + (Convert-ToBootArgValue -Value $value))
    }
    return ($parts -join " ")
}

function Write-Setting {
    param(
        [string]$Label,
        [string]$Value
    )

    $normalizedLabel = $Label.PadRight(24)
    Write-Host ("[run-local-mariadb-backend] " + $normalizedLabel + " : " + $Value)
}

Assert-NotBlank -Name "DbHost" -Value $DbHost
Assert-NotBlank -Name "DbName" -Value $DbName
Assert-NotBlank -Name "DbUsername" -Value $DbUsername
Assert-NotBlank -Name "DbPassword" -Value $DbPassword

if ($DbPort -lt 1 -or $DbPort -gt 65535) {
    Stop-Script "DbPort must be between 1 and 65535." 10
}

if ($ServerPort -lt 1 -or $ServerPort -gt 65535) {
    Stop-Script "ServerPort must be between 1 and 65535." 10
}

if (-not (Test-Path -LiteralPath $script:GradleWrapperJarPath -PathType Leaf)) {
    Stop-Script "Gradle wrapper jar not found: $script:GradleWrapperJarPath" 13
}

try {
    $script:JavaExePath = (Get-Command -Name "java.exe" -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
} catch {
    Stop-Script "Java 21 executable was not found in PATH." 13
}

$resolvedBackupRoot = Ensure-WritableDirectory -RequestedPath $(if ([string]::IsNullOrWhiteSpace($BackupRootPath)) { "local-backups" } else { $BackupRootPath }) -Label "BackupRootPath"
$resolvedExportTemp = Ensure-WritableDirectory -RequestedPath $(if ([string]::IsNullOrWhiteSpace($ExportTempPath)) { "tmp/exports" } else { $ExportTempPath }) -Label "ExportTempPath"
$resolvedDumpCommand = Resolve-DumpCommandArgument -RequestedCommand $DbDumpCommand -SkipCheck $SkipBackupCheck.IsPresent
$resolvedScale = Resolve-ScaleResourceArgument -RequestedPath $ScaleResourcePath

$jdbcUrl = ("jdbc:mariadb://{0}:{1}/{2}?useUnicode=true&characterEncoding=utf8" -f $DbHost, $DbPort, $DbName)
$healthUrl = "http://127.0.0.1:$ServerPort/api/v1/health"

$bootProperties = [ordered]@{
    "spring.profiles.active"            = "local"
    "server.port"                       = [string]$ServerPort
    "spring.datasource.url"             = $jdbcUrl
    "spring.datasource.username"        = $DbUsername
    "spring.datasource.password"        = $DbPassword
    "spring.datasource.driver-class-name" = "org.mariadb.jdbc.Driver"
    "app.backup.root-path"              = (Normalize-PathForArgument -PathValue $resolvedBackupRoot)
    "app.backup.db-dump-command"        = $resolvedDumpCommand
    "app.scale.resource-path"           = $resolvedScale.ArgumentValue
    "app.export.temp-path"              = (Normalize-PathForArgument -PathValue $resolvedExportTemp)
}

$bootArgs = Build-BootArgString -Properties $bootProperties -MaskPassword $false
$bootArgsPreview = Build-BootArgString -Properties $bootProperties -MaskPassword $true

Write-Host "[run-local-mariadb-backend] Final configuration"
Write-Setting -Label "profile" -Value "local"
Write-Setting -Label "datasource" -Value "MariaDB fixed via bootRun --args"
Write-Setting -Label "jdbc url" -Value $jdbcUrl
Write-Setting -Label "db username" -Value $DbUsername
Write-Setting -Label "db password" -Value "<hidden>"
Write-Setting -Label "server port" -Value ([string]$ServerPort)
Write-Setting -Label "backup root path" -Value (Normalize-PathForArgument -PathValue $resolvedBackupRoot)
Write-Setting -Label "db dump command" -Value $resolvedDumpCommand
Write-Setting -Label "backup check" -Value $(if ($SkipBackupCheck.IsPresent) { "SKIPPED" } else { "ENFORCED" })
Write-Setting -Label "scale resource path" -Value $resolvedScale.SummaryValue
Write-Setting -Label "export temp path" -Value (Normalize-PathForArgument -PathValue $resolvedExportTemp)
Write-Setting -Label "health check" -Value ("scripts\\health-check.bat ""http://127.0.0.1:$ServerPort/api/v1""")
Write-Host "[run-local-mariadb-backend] bootRun --args preview"
Write-Host ("[run-local-mariadb-backend]   " + $bootArgsPreview)

Push-Location $script:BackendDir
try {
    & $script:JavaExePath `
        "-Dorg.gradle.appname=gradlew" `
        "-classpath" `
        $script:GradleWrapperJarPath `
        "org.gradle.wrapper.GradleWrapperMain" `
        "--no-daemon" `
        "bootRun" `
        "--args=$bootArgs"

    exit $LASTEXITCODE
} finally {
    Pop-Location
}

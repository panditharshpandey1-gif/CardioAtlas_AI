[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$LauncherArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot

# Try virtual environment activation if execution policy permits, non-fatal if restricted
try {
    if (Test-Path -LiteralPath "$PSScriptRoot\.venv\Scripts\Activate.ps1") {
        . "$PSScriptRoot\.venv\Scripts\Activate.ps1"
    } elseif (Test-Path -LiteralPath "$PSScriptRoot\venv\Scripts\Activate.ps1") {
        . "$PSScriptRoot\venv\Scripts\Activate.ps1"
    }
} catch {
    # Non-fatal: if activation script cannot execute due to ExecutionPolicy, continue
}

# Resolve Python executable: prefer dedicated venv python if present
$pythonExe = $null
$localVenvPy = "$PSScriptRoot\.venv\Scripts\python.exe"
$altVenvPy = "$PSScriptRoot\venv\Scripts\python.exe"

if (Test-Path -LiteralPath $localVenvPy) {
    $pythonExe = $localVenvPy
} elseif (Test-Path -LiteralPath $altVenvPy) {
    $pythonExe = $altVenvPy
} elseif (Get-Command "python" -ErrorAction SilentlyContinue) {
    $pythonExe = "python"
} elseif (Get-Command "py" -ErrorAction SilentlyContinue) {
    $pythonExe = "py"
} else {
    Write-Error "Neither 'python' nor 'py' command was found in PATH. Please install Python 3.10+ from https://www.python.org/."
    exit 1
}

if ($pythonExe -eq "py") {
    if ($LauncherArgs) {
        py -3 run.py @LauncherArgs
    } else {
        py -3 run.py
    }
} else {
    if ($LauncherArgs) {
        & $pythonExe run.py @LauncherArgs
    } else {
        & $pythonExe run.py
    }
}

exit $LASTEXITCODE


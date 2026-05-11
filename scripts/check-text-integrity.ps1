param(
  [string[]]$Paths = @("index.html", "script.js", "style.css", "README.md", "doc/*.md"),
  [switch]$FailOnWarning
)

$ErrorActionPreference = "Stop"

function Expand-Targets {
  param([string[]]$InputPaths)
  $files = @()
  foreach ($p in $InputPaths) {
    $resolved = Get-ChildItem -Path $p -File -ErrorAction SilentlyContinue
    if ($resolved) { $files += $resolved.FullName }
  }
  $files | Select-Object -Unique
}

function Has-Utf8Bom {
  param([string]$FilePath)
  $bytes = [System.IO.File]::ReadAllBytes($FilePath)
  return ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
}

function Find-Mojibake {
  param([string]$Text)
  # Keep patterns mostly ASCII-safe to avoid parser issues.
  $patterns = @(
    ([string][char]0xFFFD), # replacement character
    "ï»¿",                  # BOM mojibake sequence
    "ﾃ・",
    "笳・"
  )
  foreach ($pat in $patterns) {
    if ($Text -like "*$pat*") { return $pat }
  }
  return $null
}

$targets = Expand-Targets -InputPaths $Paths
if (-not $targets -or $targets.Count -eq 0) {
  Write-Host "[WARN] no target files found"
  exit 0
}

$warnings = @()
foreach ($file in $targets) {
  $text = [System.IO.File]::ReadAllText($file)

  if (Has-Utf8Bom -FilePath $file) {
    $warnings += "[BOM] $file"
  }

  $m = Find-Mojibake -Text $text
  if ($m) {
    $warnings += "[MOJIBAKE:$m] $file"
  }

  if ($text -match "`r`n") {
    $warnings += "[CRLF] $file"
  }
}

if ($warnings.Count -eq 0) {
  Write-Host "[OK] text integrity checks passed"
  exit 0
}

Write-Host "[WARN] text integrity issues found:"
$warnings | ForEach-Object { Write-Host " - $_" }

if ($FailOnWarning) { exit 1 }
exit 0

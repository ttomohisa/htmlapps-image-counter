param(
  [switch]$ForceDownload
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$required = @(
  "AGENTS.md",
  "APP_SPEC.md",
  "app.config.json",
  "dependencies.json",
  "components\confirm-dialog.html",
  "components\toast.html",
  "components\popover-menu.html",
  "components\setting-field.html",
  "components\async-state.html",
  "components\mobile-bottom-bar.html",
  "docs\COMPONENTS.md",
  "docs\COMPONENTS.ja.md",
  "src\index.template.html",
  "build-standalone.ps1",
  "scripts\build-self-extract.ps1",
  "scripts\verify-standalone.ps1",
  "scripts\verify-self-extract.ps1",
  "README.md",
  "README.ja.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "schemas\app-config.schema.json",
  "schemas\dependencies.schema.json"
)

foreach ($relative in $required) {
  $path = Join-Path $Root $relative
  if (-not (Test-Path $path)) { throw "Required repository file is missing: $relative" }
}

$mobileBottomBarPath = Join-Path $Root "components\mobile-bottom-bar.html"
$mobileBottomBarText = Get-Content -Raw -Encoding UTF8 $mobileBottomBarPath
$mobileBottomBarRequiredTokens = @(
  'position: fixed',
  'env(safe-area-inset-bottom)',
  'data-mobile-target',
  'data-mobile-action',
  'disabled',
  'window.AppMobileBottomBar'
)
foreach ($token in $mobileBottomBarRequiredTokens) {
  if (-not $mobileBottomBarText.Contains($token)) {
    throw "components\mobile-bottom-bar.html is missing required behavior marker: $token"
  }
}


$componentContracts = @(
  @{ Path = "components\toast.html"; Tokens = @("window.AppToast", "actionLabel", "onAction", "env(safe-area-inset-bottom)") },
  @{ Path = "components\popover-menu.html"; Tokens = @("window.AppPopoverMenu", "data-popover-trigger", "aria-expanded", "Escape") },
  @{ Path = "components\setting-field.html"; Tokens = @("window.AppSettingField", "data-setting-custom", "data-setting-range", "settingchange") },
  @{ Path = "components\async-state.html"; Tokens = @("window.AppAsyncState", "invalidateSource", "captureGeneration", "isCurrent") }
)
foreach ($contract in $componentContracts) {
  $componentText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root $contract.Path)
  foreach ($token in @($contract.Tokens)) {
    if (-not $componentText.Contains([string]$token)) {
      throw "$($contract.Path) is missing required behavior marker: $token"
    }
  }
}

$sourceText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "src\index.template.html")
if (-not $sourceText.Contains("__EMBEDDED_ASSET_BUNDLE_JSON__")) { throw "src\index.template.html must embed the asset bundle JSON directly." }
if ($sourceText.Contains("__EMBEDDED_ASSET_BUNDLE_BASE64__")) { throw "Legacy double-Base64 asset bundle placeholder must not return." }
foreach ($token in @("bytesAsync", "blobUrlAsync", "outputFilename", "window.AppToast")) {
  if (-not $sourceText.Contains($token)) { throw "src\index.template.html is missing required template behavior marker: $token" }
}

$builderText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "build-standalone.ps1")
foreach ($token in @("compressionSetting", "Compress-GzipBytes", "build-size-report.json", "sizeBudget", "__EMBEDDED_ASSET_BUNDLE_JSON__")) {
  if (-not $builderText.Contains($token)) { throw "build-standalone.ps1 is missing required asset pipeline marker: $token" }
}
if ($builderText.Contains("__EMBEDDED_ASSET_BUNDLE_BASE64__")) { throw "build-standalone.ps1 must not wrap the full asset bundle in Base64." }

$selfExtractBuilderPath = Join-Path $Root "scripts\build-self-extract.ps1"
$selfExtractBuilderBytes = [System.IO.File]::ReadAllBytes($selfExtractBuilderPath)
$selfExtractBuilderStart = 0
if (
  $selfExtractBuilderBytes.Length -ge 3 -and
  $selfExtractBuilderBytes[0] -eq 0xef -and
  $selfExtractBuilderBytes[1] -eq 0xbb -and
  $selfExtractBuilderBytes[2] -eq 0xbf
) {
  $selfExtractBuilderStart = 3
}
for ($index = $selfExtractBuilderStart; $index -lt $selfExtractBuilderBytes.Length; $index += 1) {
  if ($selfExtractBuilderBytes[$index] -gt 0x7f) {
    throw "scripts\build-self-extract.ps1 must contain ASCII text only so Windows PowerShell 5.1 cannot corrupt loader text."
  }
}

$buildCompatibilityFiles = @(
  "build-standalone.ps1",
  "scripts\build-self-extract.ps1",
  "scripts\verify-standalone.ps1",
  "scripts\verify-self-extract.ps1"
)
foreach ($relative in $buildCompatibilityFiles) {
  $compatibilityPath = Join-Path $Root $relative
  $compatibilityText = Get-Content -Raw -Encoding UTF8 $compatibilityPath
  if ($compatibilityText -match '(?i)\bGet-FileHash\b') {
    throw "$relative must not depend on Get-FileHash; use the .NET SHA-256 helper for broader Windows PowerShell compatibility."
  }
  if ($compatibilityText -match '::new\s*\(') {
    throw "$relative must not use ::new(); use New-Object or older-compatible .NET construction syntax."
  }
}

# Regression check: runtime identifiers like __APP_INTERNAL_STATE__ are not build placeholders.
$verifyPath = Join-Path $Root "scripts\verify-standalone.ps1"
$tempVerifyPath = Join-Path ([System.IO.Path]::GetTempPath()) ("single-html-template-verify-" + [Guid]::NewGuid().ToString("N") + ".html")
$syntheticHtml = @'
<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'none'">
</head><body><script>const __APP_INTERNAL_STATE__ = 1;</script></body></html>
'@
try {
  [System.IO.File]::WriteAllText($tempVerifyPath, $syntheticHtml, (New-Object System.Text.UTF8Encoding($false)))
  & $verifyPath -Path $tempVerifyPath -RequireNetworkBlock $true
} finally {
  Remove-Item -Force -ErrorAction SilentlyContinue $tempVerifyPath
}

$app = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "app.config.json") | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace([string]$app.name)) { throw "app.config.json: name is required" }
if ([string]::IsNullOrWhiteSpace([string]$app.slug)) { throw "app.config.json: slug is required" }
if ([string]::IsNullOrWhiteSpace([string]$app.version)) { throw "app.config.json: version is required" }

$buildArguments = @{}
if ($ForceDownload) { $buildArguments.ForceDownload = $true }
& (Join-Path $Root "build-standalone.ps1") @buildArguments

Write-Host "[OK] Repository check passed." -ForegroundColor Green

<#
.SYNOPSIS
  Runs ON THE APP SERVER (invoked by Deploy-Remote.ps1, or by hand for a manual
  deploy). Deploys IN PLACE into an existing app directory: backs up the current
  build, overwrites the build outputs + dependency manifests, reinstalls prod
  deps, restarts the NSSM service, health-checks, and rolls back on failure.

.WHAT IT TOUCHES  (under <AppRoot>)
  Overwrites:  server\dist, client\dist, package.json, package-lock.json,
               server\package.json, client\package.json, and node_modules
               (rebuilt via `npm ci --omit=dev`)
  Never touches: server\.env, server\uploads, or anything else -> your secrets
                 and uploaded files are preserved across deploys.

.LAYOUT
  <AppRoot>\                         e.g. F:\Vishu\vegam-revenuemanagement\VegamRevenueManagement
    server\ (dist, .env, uploads, package.json, ...)
    client\ (dist, ...)
    package.json, package-lock.json
  <AppRoot>\..\vegam-backups\<stamp>\  <- pre-deploy backup of the overwritten paths

.NOTES
  Requires Node/npm and nssm on PATH. Keeps the last N backups.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string] $ArtifactZip,
  [Parameter(Mandatory)] [string] $AppRoot,
  [Parameter(Mandatory)] [string] $ServerService,
  [string] $ClientService = '',
  [string] $HealthUrl = 'http://localhost:5000/api/health',
  [int]    $KeepBackups = 5
)

$ErrorActionPreference = 'Stop'

# Paths that a deploy replaces (relative to $AppRoot). Everything else is left
# alone -- crucially server\.env and server\uploads.
$replaceable = @(
  'server\dist',
  'client\dist',
  'package.json',
  'package-lock.json',
  'server\package.json',
  'client\package.json'
)

function Stop-Svc([string]$name) {
  if ([string]::IsNullOrWhiteSpace($name)) { return }
  Write-Host "Stopping service '$name' ..."
  & nssm stop $name confirm | Out-Null
  Start-Sleep -Seconds 2
}

function Start-Svc([string]$name) {
  if ([string]::IsNullOrWhiteSpace($name)) { return }
  Write-Host "Starting service '$name' ..."
  & nssm start $name | Out-Null
}

# ---- Paths ----
$stamp      = Get-Date -Format 'yyyyMMdd-HHmmss'
$staging    = Join-Path $env:TEMP "vegam-stage-$stamp"
$backupRoot = Join-Path (Split-Path $AppRoot -Parent) 'vegam-backups'
$backupDir  = Join-Path $backupRoot $stamp

if (-not (Test-Path $AppRoot)) { throw "AppRoot not found: $AppRoot" }

# ---- 1. Unpack the new build to staging ----
Write-Host "==> Unpacking artifact to $staging"
New-Item -ItemType Directory -Path $staging -Force | Out-Null
Expand-Archive -Path $ArtifactZip -DestinationPath $staging -Force

# ---- 2. Back up what we're about to overwrite ----
Write-Host "==> Backing up current build to $backupDir"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
foreach ($rel in $replaceable) {
  $src = Join-Path $AppRoot $rel
  if (Test-Path $src) {
    $dst = Join-Path $backupDir $rel
    New-Item -ItemType Directory -Path (Split-Path $dst -Parent) -Force | Out-Null
    Copy-Item $src $dst -Recurse -Force
  }
}

# Snapshot which paths we replaced this run, so rollback can be exact.
$replacedThisRun = @()

try {
  # ---- 3. Stop, overwrite, reinstall ----
  Stop-Svc $ServerService
  Stop-Svc $ClientService

  Write-Host "==> Overwriting build outputs"
  foreach ($rel in $replaceable) {
    $src = Join-Path $staging $rel
    if (-not (Test-Path $src)) { continue }          # artifact didn't ship this path
    $dst = Join-Path $AppRoot $rel
    if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
    New-Item -ItemType Directory -Path (Split-Path $dst -Parent) -Force | Out-Null
    Copy-Item $src $dst -Recurse -Force
    $replacedThisRun += $rel
  }

  Write-Host "==> Installing production dependencies (npm ci --omit=dev)"
  Push-Location $AppRoot
  try {
    & npm ci --omit=dev
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE" }
  }
  finally { Pop-Location }

  # ---- 4. Start + health check ----
  Start-Svc $ServerService
  Start-Svc $ClientService

  Write-Host "==> Health check: $HealthUrl"
  $ok = $false
  for ($i = 1; $i -le 10; $i++) {
    Start-Sleep -Seconds 3
    try {
      $resp = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 5
      if ($resp.StatusCode -eq 200) { $ok = $true; break }
    } catch {
      Write-Host "  attempt $i not ready yet..."
    }
  }
  if (-not $ok) { throw "Health check failed after restart." }

  Write-Host "==> Healthy. Build is live from $AppRoot"
}
catch {
  Write-Warning "Deploy failed: $($_.Exception.Message)"
  Write-Warning "Rolling back from backup $backupDir"
  Stop-Svc $ServerService
  Stop-Svc $ClientService
  foreach ($rel in $replacedThisRun) {
    $bak = Join-Path $backupDir $rel
    $dst = Join-Path $AppRoot $rel
    if (Test-Path $bak) {
      if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
      New-Item -ItemType Directory -Path (Split-Path $dst -Parent) -Force | Out-Null
      Copy-Item $bak $dst -Recurse -Force
    }
  }
  # Restore deps to the rolled-back manifests too.
  Push-Location $AppRoot
  try { & npm ci --omit=dev | Out-Null } catch {} finally { Pop-Location }
  Start-Svc $ServerService
  Start-Svc $ClientService
  throw "Deploy rolled back to previous build ($stamp backup retained)."
}
finally {
  if (Test-Path $staging) { Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue }
}

# ---- 5. Prune old backups ----
if (Test-Path $backupRoot) {
  Get-ChildItem $backupRoot -Directory |
    Sort-Object Name -Descending |
    Select-Object -Skip $KeepBackups |
    ForEach-Object {
      Write-Host "Pruning old backup $($_.Name)"
      Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
}

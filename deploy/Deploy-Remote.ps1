<#
.SYNOPSIS
  Runs on the Jenkins (Windows) agent. Pushes the build artifact to the app
  server over PowerShell Remoting (WinRM) and runs Deploy-Local.ps1 there.

.DESCRIPTION
  Single transport for everything: one PSSession is used both to copy the zip
  (Copy-Item -ToSession) and to run the remote deploy (Invoke-Command). No SMB
  share or SSH needed.

  Prereqs on the APP SERVER (one-time, see the setup guide):
    - WinRM enabled:  Enable-PSRemoting -Force
    - Node.js + npm installed and on PATH (already true if the app runs there)
    - NSSM on PATH
  Prereqs on the JENKINS agent:
    - If app server is NOT in the same AD domain, add it to TrustedHosts:
        Set-Item WSMan:\localhost\Client\TrustedHosts -Value "APP_SERVER" -Force
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string] $AppServer,
  [Parameter(Mandatory)] [string] $DeployUser,
  [Parameter(Mandatory)] [string] $DeployPass,
  [Parameter(Mandatory)] [string] $ArtifactZip,
  [Parameter(Mandatory)] [string] $AppRoot,
  [Parameter(Mandatory)] [string] $ServerService,
  [string] $ClientService = '',
  [string] $HealthUrl = 'http://localhost:5000/api/health'
)

$ErrorActionPreference = 'Stop'

$secure = ConvertTo-SecureString $DeployPass -AsPlainText -Force
$cred   = New-Object System.Management.Automation.PSCredential($DeployUser, $secure)

Write-Host "Opening WinRM session to $AppServer ..."
$session = New-PSSession -ComputerName $AppServer -Credential $cred -Authentication Negotiate

try {
  # Remote staging directory for the incoming artifact + deploy script.
  $remoteStage = Invoke-Command -Session $session -ScriptBlock {
    $p = Join-Path $env:TEMP ("vegam-deploy-" + (Get-Date -Format 'yyyyMMddHHmmss'))
    New-Item -ItemType Directory -Path $p -Force | Out-Null
    $p
  }
  Write-Host "Remote staging: $remoteStage"

  $localDeployScript = Join-Path $PSScriptRoot 'Deploy-Local.ps1'

  Write-Host "Copying artifact and deploy script to app server ..."
  Copy-Item -Path $ArtifactZip       -Destination (Join-Path $remoteStage 'vegam-app.zip')  -ToSession $session
  Copy-Item -Path $localDeployScript -Destination (Join-Path $remoteStage 'Deploy-Local.ps1') -ToSession $session

  Write-Host "Running remote deploy ..."
  Invoke-Command -Session $session -ScriptBlock {
    param($stage, $root, $svrSvc, $cliSvc, $health)
    & (Join-Path $stage 'Deploy-Local.ps1') `
        -ArtifactZip    (Join-Path $stage 'vegam-app.zip') `
        -AppRoot        $root `
        -ServerService  $svrSvc `
        -ClientService  $cliSvc `
        -HealthUrl      $health
  } -ArgumentList $remoteStage, $AppRoot, $ServerService, $ClientService, $HealthUrl

  Write-Host "Remote deploy completed successfully."
}
finally {
  if ($session) { Remove-PSSession $session }
}

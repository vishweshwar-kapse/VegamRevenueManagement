// Jenkins declarative pipeline for Vegam Revenue Management.
//
// What it does, on every merge to `main`:
//   1. Checks out main
//   2. Installs deps with `npm ci` (clean, lockfile-exact)
//   3. Builds server (tsc -> server/dist) and client (vite -> client/dist)
//      -- a broken build FAILS HERE and never reaches the app server
//   4. Packages the runnable tree into a zip artifact
//   5. Deploys to the app server over PowerShell Remoting (WinRM):
//      stop NSSM services -> swap release -> npm ci --omit=dev -> start -> health check
//      (auto-rollback to the previous release if the health check fails)
//
// Triggering is by SCM polling (see `triggers` below) because Jenkins is on the
// office network with no inbound path from GitHub. A merged PR to main becomes a
// push to main, which polling detects within the poll interval.
//
// Fill in the environment values marked  <<< SET ME >>>  or, better, move the
// sensitive ones into Jenkins credentials (see the setup guide).

pipeline {
  // Must run on a Windows node (PowerShell + npm + WinRM client).
  agent any

  // Node.js provided by the "NodeJS" plugin. Create a tool named exactly this
  // under Manage Jenkins > Tools > NodeJS installations (version 22.x).
  tools {
    nodejs 'Node22'
  }

  options {
    timestamps()
    disableConcurrentBuilds()          // never deploy two builds at once
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  // Poll GitHub every 5 minutes for new commits on main.
  // 'H/5' spreads the load; change to a webhook trigger if Jenkins ever gets a
  // public URL (see the guide).
  triggers {
    pollSCM('H/5 * * * *')
  }

  environment {
    // ---- App-server target ----
    APP_SERVER      = '192.168.1.11'
    APP_ROOT        = 'F:\\Vishu\\vegam-revenuemanagement\\VegamRevenueManagement'  // in-place deploy root
    SERVER_SERVICE  = 'VegamRevenue'                            // NSSM service name (from `nssm dump`)
    CLIENT_SERVICE  = ''                                        // '' -> the server serves client/dist (single service)
    HEALTH_URL      = 'http://localhost:5000/api/health'        // checked ON the app server after restart

    // App-server login used for WinRM. Store as a Jenkins "Username with password"
    // credential (ID below) instead of hard-coding.
    DEPLOY_CRED_ID  = 'appserver-winrm'                        // Jenkins credentials ID
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        powershell 'git --no-pager log -1 --pretty=format:"Building %h - %s (%an)"'
      }
    }

    stage('Install') {
      steps {
        // `npm ci` installs ALL workspace deps (root + client + server) from the
        // committed package-lock.json. Required for the build below.
        powershell 'npm ci'
      }
    }

    stage('Build') {
      steps {
        // Root script: builds server (tsc) then client (vite). Fails the pipeline
        // on any TypeScript/build error -- prod is never touched on a bad build.
        powershell 'npm run build'
      }
    }

    stage('Package') {
      steps {
        powershell '''
          $ErrorActionPreference = "Stop"
          $stage = "artifact"
          if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
          New-Item -ItemType Directory -Path $stage | Out-Null

          # Ship the built output + the manifests needed to install prod deps on
          # the app server, plus the deploy script it will run.
          New-Item -ItemType Directory -Path "$stage\\server" | Out-Null
          New-Item -ItemType Directory -Path "$stage\\client" | Out-Null

          Copy-Item "server\\dist"          "$stage\\server\\dist"        -Recurse
          Copy-Item "server\\package.json"  "$stage\\server\\"
          Copy-Item "client\\dist"          "$stage\\client\\dist"        -Recurse
          Copy-Item "client\\package.json"  "$stage\\client\\"
          Copy-Item "package.json"          "$stage\\"
          Copy-Item "package-lock.json"     "$stage\\"
          Copy-Item "deploy\\Deploy-Local.ps1" "$stage\\"

          if (Test-Path "vegam-app.zip") { Remove-Item "vegam-app.zip" -Force }
          Compress-Archive -Path "$stage\\*" -DestinationPath "vegam-app.zip"
          Write-Host "Packaged vegam-app.zip"
        '''
        archiveArtifacts artifacts: 'vegam-app.zip', fingerprint: true
      }
    }

    stage('Deploy') {
      steps {
        withCredentials([usernamePassword(
            credentialsId: env.DEPLOY_CRED_ID,
            usernameVariable: 'DEPLOY_USER',
            passwordVariable: 'DEPLOY_PASS')]) {
          powershell '''
            $ErrorActionPreference = "Stop"
            .\\deploy\\Deploy-Remote.ps1 `
              -AppServer     $env:APP_SERVER `
              -DeployUser    $env:DEPLOY_USER `
              -DeployPass    $env:DEPLOY_PASS `
              -ArtifactZip   (Resolve-Path ".\\vegam-app.zip").Path `
              -AppRoot       $env:APP_ROOT `
              -ServerService $env:SERVER_SERVICE `
              -ClientService $env:CLIENT_SERVICE `
              -HealthUrl     $env:HEALTH_URL
          '''
        }
      }
    }
  }

  post {
    success { echo "Deploy OK: build ${env.BUILD_NUMBER} is live on ${env.APP_SERVER}" }
    failure { echo "Build/deploy FAILED for build ${env.BUILD_NUMBER} - app server left on the previous release." }
  }
}

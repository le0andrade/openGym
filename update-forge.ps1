param(
  [string]$PublicHost = '',
  [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
$Branch = 'forge-commercial'
$ApiPort = 3000
$FrontendPort = 5173
$RepoRoot = $PSScriptRoot
$ExerciseMediaRevision = '7455efae41b330c265e7cd4b78dfa848e7ce5ebd'
$ExerciseImgBase = "https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@$ExerciseMediaRevision/images/"
$ExerciseGifBase = "https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@$ExerciseMediaRevision/videos/"

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Comando '$Name' nao encontrado no PATH."
  }
}

function Run-Git([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args) {
  $output = & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Args -join ' ') falhou."
  }
  return $output
}

function Stop-ForgeListener([int]$Port) {
  $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  foreach ($listener in $listeners) {
    $pidToStop = $listener.OwningProcess
    if (-not $pidToStop) { continue }

    $proc = Get-Process -Id $pidToStop -ErrorAction SilentlyContinue
    if (-not $proc) { continue }

    if ($proc.ProcessName -notin @('node', 'node.exe')) {
      throw "A porta $Port esta ocupada pelo processo '$($proc.ProcessName)' (PID $pidToStop). Feche-o manualmente antes de continuar."
    }

    Write-Host "Parando processo Node na porta $Port (PID $pidToStop)..."
    Stop-Process -Id $pidToStop -Force
  }
}

function Wait-ForPort([int]$Port, [int]$TimeoutSeconds = 20) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $client = [System.Net.Sockets.TcpClient]::new()
      $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
      if ($async.AsyncWaitHandle.WaitOne(500) -and $client.Connected) {
        $client.EndConnect($async)
        $client.Dispose()
        return $true
      }
      $client.Dispose()
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Start-ForgeWindow([string]$Title, [string]$Command) {
  $escapedRoot = $RepoRoot.Replace("'", "''")
  $wrapped = @"
`$Host.UI.RawUI.WindowTitle = '$Title'
Set-Location -LiteralPath '$escapedRoot'
$Command
"@
  Start-Process powershell.exe -WorkingDirectory $RepoRoot -ArgumentList @('-NoExit', '-NoLogo', '-Command', $wrapped) | Out-Null
}

Set-Location -LiteralPath $RepoRoot

Write-Step 'Validando ferramentas'
Require-Command git
Require-Command node
Require-Command npm
Require-Command tailscale

if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
  throw 'Este script precisa ser executado na raiz do repositorio Forge.'
}

Write-Step 'Sincronizando exatamente com o GitHub'
$oldHead = (Run-Git rev-parse HEAD | Select-Object -First 1).Trim()

# Este computador e ambiente de teste. O GitHub e a fonte da verdade.
# reset --hard descarta alteracoes em arquivos rastreados.
# clean -fd remove arquivos/pastas nao rastreados, mas preserva tudo que esta no .gitignore
# (incluindo data/, node_modules e .env).
Run-Git reset --hard HEAD | Out-Host
Run-Git clean -fd | Out-Host
Run-Git fetch origin $Branch | Out-Host

$currentBranch = (Run-Git rev-parse --abbrev-ref HEAD | Select-Object -First 1).Trim()
if ($currentBranch -ne $Branch) {
  Run-Git switch -C $Branch "origin/$Branch" | Out-Host
}

Run-Git reset --hard "origin/$Branch" | Out-Host
Run-Git clean -fd | Out-Host
$newHead = (Run-Git rev-parse HEAD | Select-Object -First 1).Trim()

$changedFiles = @()
if ($oldHead -ne $newHead) {
  $changedFiles = @(Run-Git diff --name-only "$oldHead..$newHead")
  Write-Host "Atualizado: $($oldHead.Substring(0,7)) -> $($newHead.Substring(0,7))" -ForegroundColor Green
} else {
  Write-Host 'Nenhum commit novo. Sua copia ja esta atualizada.' -ForegroundColor Green
}

$apiNeedsInstall = -not (Test-Path (Join-Path $RepoRoot 'api/node_modules')) -or
  ($changedFiles | Where-Object { $_ -in @('api/package.json', 'api/package-lock.json') })

$frontendNeedsInstall = -not (Test-Path (Join-Path $RepoRoot 'frontend/node_modules')) -or
  ($changedFiles | Where-Object { $_ -in @('frontend/package.json', 'frontend/package-lock.json') })

if ($apiNeedsInstall) {
  Write-Step 'Atualizando dependencias da API'
  Push-Location (Join-Path $RepoRoot 'api')
  try {
    & npm ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci da API falhou.' }
  } finally {
    Pop-Location
  }
}

if ($frontendNeedsInstall) {
  Write-Step 'Atualizando dependencias do frontend'
  Push-Location (Join-Path $RepoRoot 'frontend')
  try {
    & npm ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci do frontend falhou.' }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path (Join-Path $RepoRoot 'data'))) {
  New-Item -ItemType Directory -Path (Join-Path $RepoRoot 'data') | Out-Null
}

if (-not $PublicHost) {
  Write-Step 'Descobrindo hostname do Tailscale'
  $tailscaleJson = (& tailscale status --json) -join "`n"
  if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel consultar o Tailscale.' }
  $tailscaleStatus = $tailscaleJson | ConvertFrom-Json
  $PublicHost = [string]$tailscaleStatus.Self.DNSName
  $PublicHost = $PublicHost.Trim().TrimEnd('.')
}

if (-not $PublicHost) {
  throw 'Nao foi possivel descobrir o hostname do Tailscale. Use: .\update-forge.ps1 -PublicHost seu-host.ts.net'
}

$PublicUrl = "https://$PublicHost"
Write-Host "Host publico: $PublicUrl" -ForegroundColor Green

Write-Step 'Reiniciando API e frontend'
Stop-ForgeListener $ApiPort
Stop-ForgeListener $FrontendPort

$escapedRootForEnv = $RepoRoot.Replace("'", "''")
$apiCommand = @"
`$env:DATA_DIR = '$escapedRootForEnv\data'
`$env:RP_ID = '$PublicHost'
`$env:ORIGIN = '$PublicUrl'
`$env:RP_NAME = 'Forge'
node api/server.js
"@

$frontendCommand = @"
`$env:API_TARGET = 'http://127.0.0.1:$ApiPort'
`$env:API_ORIGIN = '$PublicUrl'
`$env:__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS = '$PublicHost'
`$env:VITE_IMG_BASE = '$ExerciseImgBase'
`$env:VITE_GIF_BASE = '$ExerciseGifBase'
npm --prefix frontend run dev -- --host 127.0.0.1 --port $FrontendPort
"@

Start-ForgeWindow 'Forge API' $apiCommand
if (-not (Wait-ForPort $ApiPort)) {
  throw "A API nao abriu a porta $ApiPort em tempo. Veja a janela 'Forge API'."
}

Start-ForgeWindow 'Forge Frontend' $frontendCommand
if (-not (Wait-ForPort $FrontendPort)) {
  throw "O frontend nao abriu a porta $FrontendPort em tempo. Veja a janela 'Forge Frontend'."
}

Write-Step 'Garantindo Tailscale Funnel em background'
& tailscale funnel --bg --yes "http://127.0.0.1:$FrontendPort"
if ($LASTEXITCODE -ne 0) {
  throw 'Nao foi possivel iniciar/atualizar o Tailscale Funnel.'
}

Write-Host "`nForge atualizado e rodando." -ForegroundColor Green
Write-Host "Local:   http://127.0.0.1:$FrontendPort"
Write-Host "Publico: $PublicUrl"
Write-Host "Midia:   upstream openGym via jsDelivr (teste)"
Write-Host "Commit:  $newHead"

if (-not $NoOpen) {
  Start-Process $PublicUrl
}

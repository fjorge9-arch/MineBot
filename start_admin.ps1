# IMPORTANTE: Execute este script como ADMINISTRADOR
# Clique com botão direito no PowerShell e selecione "Executar como Administrador"

Write-Host "=== MineBot - Inicialização Completa ===" -ForegroundColor Cyan
Write-Host ""

# Verificar se está rodando como admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERRO: Este script precisa ser executado como ADMINISTRADOR!" -ForegroundColor Red
    Write-Host "Clique com botão direito no PowerShell e selecione 'Executar como Administrador'" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "[OK] Executando como Administrador" -ForegroundColor Green
Write-Host ""

# 1. Configurar UWP Loopback
Write-Host "[1/3] Configurando UWP Loopback..." -ForegroundColor Yellow
try {
    CheckNetIsolation LoopbackExempt -a -n="Microsoft.MinecraftUWP_8wekyb3d8bbwe"
    Write-Host "[OK] Loopback configurado" -ForegroundColor Green
}
catch {
    Write-Host "[ERRO] Falha ao configurar loopback" -ForegroundColor Red
}
Write-Host ""

# 2. Iniciar Bedrock Server
Write-Host "[2/3] Iniciando Bedrock Server..." -ForegroundColor Yellow
$serverPath = ".\bedrock-server-1.26.0.2\bedrock_server.exe"
if (Test-Path $serverPath) {
    Start-Process -FilePath $serverPath -WorkingDirectory ".\bedrock-server-1.26.0.2"
    Write-Host "[OK] Servidor iniciado em nova janela" -ForegroundColor Green
}
else {
    Write-Host "[ERRO] Servidor não encontrado em $serverPath" -ForegroundColor Red
}
Write-Host ""

# 3. Iniciar Proxy
Write-Host "[3/3] Iniciando Proxy..." -ForegroundColor Yellow
if (Test-Path ".\gateway.js") {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "node gateway.js"
    Write-Host "[OK] Proxy iniciado em nova janela" -ForegroundColor Green
}
else {
    Write-Host "[ERRO] proxy.js não encontrado" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== Inicialização Completa ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Conecte-se ao servidor em: 127.0.0.1:19134 (PROXY)" -ForegroundColor White
Write-Host "2. Faça as ações que deseja gravar" -ForegroundColor White
Write-Host "3. Para testar o bot andando, execute: node test_walk_bot.js" -ForegroundColor White
Write-Host ""
pause

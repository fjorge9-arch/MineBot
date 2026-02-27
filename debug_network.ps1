
Write-Host "=== MineBot Network Diagnostics ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check UWP Loopback
Write-Host "[1/4] Checking UWP Loopback..." -ForegroundColor Yellow
$loopback = CheckNetIsolation LoopbackExempt -s
if ($loopback -match "Microsoft.MinecraftUWP_8wekyb3d8bbwe") {
    Write-Host "Check: OK - Minecraft Loopback Enabled" -ForegroundColor Green
}
else {
    Write-Host "Check: FAIL - Minecraft Loopback DISABLED" -ForegroundColor Red
    Write-Host "Action: Run this command as Admin:" -ForegroundColor Yellow
    Write-Host "CheckNetIsolation LoopbackExempt -a -n=Microsoft.MinecraftUWP_8wekyb3d8bbwe" -ForegroundColor White
}

# 2. Check Server Port (19132)
Write-Host ""
Write-Host "[2/4] Checking Bedrock Server (Port 19132)..." -ForegroundColor Yellow
$serverPort = Get-NetUDPEndpoint -LocalPort 19132 -ErrorAction SilentlyContinue
if ($serverPort) {
    Write-Host "Check: OK - Server is LISTENING on 19132" -ForegroundColor Green
}
else {
    Write-Host "Check: FAIL - Port 19132 is FREE (Server not running?)" -ForegroundColor Red
}

# 3. Check Gateway Port (19134)
Write-Host ""
Write-Host "[3/4] Checking Gateway Proxy (Port 19134)..." -ForegroundColor Yellow
$gatewayPort = Get-NetUDPEndpoint -LocalPort 19134 -ErrorAction SilentlyContinue
if ($gatewayPort) {
    Write-Host "Check: OK - Gateway is LISTENING on 19134" -ForegroundColor Green
}
else {
    Write-Host "Check: FAIL - Port 19134 is FREE (Gateway not running?)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Diagnosis Complete ===" -ForegroundColor Cyan

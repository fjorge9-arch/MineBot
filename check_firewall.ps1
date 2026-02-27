
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isAdmin) {
    Write-Host "✅ Running as Admin. Attempting to fix Firewall..." -ForegroundColor Green
    
    try {
        New-NetFirewallRule -DisplayName "MineBot Gateway (UDP)" -Direction Inbound -LocalPort 19134 -Protocol UDP -Action Allow -ErrorAction Stop
        Write-Host "✅ Firewall Rule Added: Port 19134 (Gateway)" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️ Failed to add rule for 19134: $_" -ForegroundColor Yellow
    }

    try {
        New-NetFirewallRule -DisplayName "MineBot Server (UDP)" -Direction Inbound -LocalPort 19132 -Protocol UDP -Action Allow -ErrorAction Stop
        Write-Host "✅ Firewall Rule Added: Port 19132 (Server)" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️ Failed to add rule for 19132: $_" -ForegroundColor Yellow
    }

    # Verify Process on 19134
    try {
        $procId = (Get-NetUDPEndpoint -LocalPort 19134 -ErrorAction Stop).OwningProcess
        $procName = (Get-Process -Id $procId).ProcessName
        Write-Host "ℹ️ Port 19134 is owned by: $procName (PID: $procId)" -ForegroundColor Cyan
    }
    catch {
        Write-Host "❌ Port 19134 is NOT LISTENING!" -ForegroundColor Red
    }

}
else {
    Write-Host "❌ NOT running as Admin." -ForegroundColor Red
    Write-Host "👉 Please restart VS Code / Terminal as Administrator to fix Firewall rules automatically." -ForegroundColor Yellow
    Write-Host "ℹ️ Or check Windows Firewall manually for 'node.exe' and 'bedrock_server.exe'." -ForegroundColor White
}

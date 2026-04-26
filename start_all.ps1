Write-Host "Starting Minecraft Bedrock Server and Gateway..." -ForegroundColor Green

# Start Bedrock Server in a new window
$ServerPath = ".\bedrock-server-1.26.14.1\bedrock_server.exe"
$ServerDir = ".\bedrock-server-1.26.14.1"

if (Test-Path $ServerPath) {
    Write-Host "Launching Bedrock Server..."
    Start-Process -FilePath $ServerPath -WorkingDirectory $ServerDir
}
else {
    Write-Host "Error: bedrock_server.exe not found at $ServerPath" -ForegroundColor Red
    Exit
}

# Wait a bit for server to initialize
Write-Host "Waiting 5 seconds for server to load..."
Start-Sleep -Seconds 5

# Start Gateway (refactored version)
Write-Host "Starting Gateway Proxy on port 19134..." -ForegroundColor Cyan
Write-Host "Connect YOUR client to 127.0.0.1:19134" -ForegroundColor Yellow
Write-Host "Bot connects directly to 127.0.0.1:19132" -ForegroundColor Yellow
node tools/gateway.js

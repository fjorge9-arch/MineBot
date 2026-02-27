$ServerPath = ".\bedrock-server-1.26.0.2"
$PropsFile = "$ServerPath\server.properties"
$LevelName = "Bedrock level"

# Try to read level-name from server.properties
if (Test-Path $PropsFile) {
    $Lines = Get-Content $PropsFile
    foreach ($Line in $Lines) {
        if ($Line -match "^level-name=(.*)") {
            $LevelName = $Matches[1]
            break
        }
    }
}

$WorldPath = "$ServerPath\worlds\$LevelName"

Write-Host "World Location: $WorldPath" -ForegroundColor Cyan

if (Test-Path $WorldPath) {
    $Confirmation = Read-Host "Are you sure you want to DELETE this world? (y/n)"
    if ($Confirmation -eq 'y') {
        Write-Host "Deleting world..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force $WorldPath
        Write-Host "World deleted. A new one will be generated on next start." -ForegroundColor Green
    }
    else {
        Write-Host "Cancelled." -ForegroundColor Gray
    }
}
else {
    Write-Host "World folder not found. It may have already been reset." -ForegroundColor Yellow
}

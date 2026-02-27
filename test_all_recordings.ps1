# Script para testar todas as gravacoes sequencialmente (automatico)

Write-Host "=== TESTANDO TODAS AS GRAVACOES (90s POR TESTE) ===" -ForegroundColor Green
Write-Host ""

$recordings = Get-ChildItem recordings\*.jsonl | Sort-Object LastWriteTime

if ($recordings.Count -eq 0) {
    Write-Host "Nenhuma gravacao encontrada!" -ForegroundColor Red
    exit
}

Write-Host "Encontradas $($recordings.Count) gravacoes:" -ForegroundColor Yellow
foreach ($r in $recordings) {
    Write-Host "  - $($r.Name)"
}
Write-Host ""
Write-Host "Cada teste rodara por 90 segundos para garantir que chegue ao movimento" -ForegroundColor Cyan
Write-Host ""

$testNumber = 1
foreach ($recording in $recordings) {
    $recName = $recording.Name
    Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
    Write-Host "  TESTE $testNumber/$($recordings.Count): $recName" -ForegroundColor Cyan
    Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
    
    $lines = (Get-Content $recording.FullName | Measure-Object -Line).Lines
    Write-Host "Linhas: $lines" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "Iniciando replay bot..." -ForegroundColor Green
    Write-Host "Observe o bot por pelo menos 1 minuto!" -ForegroundColor Yellow
    
    # Inicia o processo node
    $process = Start-Process -FilePath "node" -ArgumentList "src/replay_bot.js", "`"$($recording.FullName)`"" -PassThru -NoNewWindow
    
    # Aguarda 90 segundos ou o processo terminar
    $count = 0
    while (-not $process.HasExited -and $count -lt 90) {
        if ($count -eq 60) {
            Write-Host ">>> Bot deve estar comecando a andar agora! <<<" -ForegroundColor Green
        }
        Start-Sleep -Seconds 1
        $count++
    }
    
    if (-not $process.HasExited) {
        Write-Host "Tempo limite (90s) atingido, parando o bot..." -ForegroundColor Gray
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host ""
    Write-Host "Fim do teste $testNumber. Proximo em 3 segundos..." -ForegroundColor Gray
    Write-Host ""
    Start-Sleep -Seconds 3
    
    $testNumber++
}

Write-Host "=== TODOS OS TESTES CONCLUIDOS ===" -ForegroundColor Green

# Script de despliegue para Windows PowerShell

Write-Host "Iniciando ChromaDB y el microservicio..." -ForegroundColor Green

# Crear la red si no existe
docker network create chroma_network 2>$null

# Construir y levantar los servicios
Write-Host "Construyendo y levantando servicios..." -ForegroundColor Yellow
docker-compose up --build -d

# Esperar a que los servicios estén listos
Write-Host "Esperando a que los servicios estén listos..." -ForegroundColor Yellow
Start-Sleep 15

# Verificar el estado de los servicios
Write-Host "Estado de los servicios:" -ForegroundColor Cyan
docker-compose ps

# Verificar que ChromaDB esté funcionando
Write-Host "Verificando ChromaDB..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/heartbeat" -Method Get -TimeoutSec 5
    Write-Host "ChromaDB está funcionando" -ForegroundColor Green
} catch {
    Write-Host "ChromaDB no responde" -ForegroundColor Red
}

# Verificar que el microservicio esté funcionando
Write-Host "Verificando microservicio..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:9000/health" -Method Get -TimeoutSec 5
    Write-Host "Microservicio está funcionando" -ForegroundColor Green
} catch {
    Write-Host "Microservicio no responde" -ForegroundColor Red
}

Write-Host "¡Despliegue completado!" -ForegroundColor Green
Write-Host "URLs disponibles:" -ForegroundColor White
Write-Host "- ChromaDB: http://localhost:8000" -ForegroundColor White
Write-Host "- Microservicio: http://localhost:9000" -ForegroundColor White
Write-Host "- Documentación API: http://localhost:9000/docs" -ForegroundColor White

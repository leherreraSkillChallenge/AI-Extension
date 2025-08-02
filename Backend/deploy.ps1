# PowerShell script para desplegar el Asistente Web API en Docker

Write-Host "Desplegando Asistente Web API en Docker..." -ForegroundColor Green

# Parar y remover contenedor existente si existe
Write-Host "Limpiando contenedor existente..." -ForegroundColor Yellow
docker stop asistente-webapi 2>$null
docker rm asistente-webapi 2>$null

# Construir la imagen
Write-Host "Construyendo imagen Docker..." -ForegroundColor Yellow
Set-Location backend
docker build -t asistente-webapi .
Set-Location ..

if ($LASTEXITCODE -eq 0) {
    Write-Host "Imagen construida exitosamente" -ForegroundColor Green
    
    # Desplegar en la red chroma-net
    Write-Host "Desplegando en la red chroma-net..." -ForegroundColor Yellow
    docker run -d --name asistente-webapi --network chroma-net -p 5000:5000 asistente-webapi
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Despliegue exitoso!" -ForegroundColor Green
        Write-Host "API disponible en: http://localhost:5000" -ForegroundColor Cyan
        Write-Host "Swagger UI disponible en: http://localhost:5000/swagger" -ForegroundColor Cyan
        
        # Mostrar logs iniciales
        Write-Host "Logs iniciales:" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        docker logs asistente-webapi --tail 10
    } else {
        Write-Host "Error al desplegar el contenedor" -ForegroundColor Red
    }
} else {
    Write-Host "Error al construir la imagen Docker" -ForegroundColor Red
}

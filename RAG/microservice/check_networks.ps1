# Script para verificar redes de contenedores
Write-Host "=== VERIFICANDO REDES DE CONTENEDORES ===" -ForegroundColor Green

# Lista de contenedores a verificar
$containers = @(
    "chromadb",
    "chroma-service", 
    "kokoro_tts_streaming-tts-proxy-1",
    "practical_cartwright"
)

Write-Host "`Redes de cada contenedor:" -ForegroundColor Cyan

foreach ($container in $containers) {
    try {
        Write-Host "`n$container :" -ForegroundColor Yellow -NoNewline
        $networkInfo = docker inspect $container --format='{{range $net, $config := .NetworkSettings.Networks}}{{$net}} {{end}}' 2>$null
        if ($networkInfo) {
            Write-Host " $networkInfo" -ForegroundColor White
        } else {
            Write-Host "No encontrado o sin redes" -ForegroundColor Red
        }
    } catch {
        Write-Host "Error al inspeccionar" -ForegroundColor Red
    }
}

Write-Host "`Todas las redes disponibles:" -ForegroundColor Cyan
docker network ls

Write-Host "`Para conectar contenedores a la misma red:" -ForegroundColor Green
Write-Host "docker network connect chroma-net <nombre_contenedor>" -ForegroundColor White

Write-Host "`Comando para verificar contenedores en red específica:" -ForegroundColor Green  
Write-Host "docker network inspect chroma-net" -ForegroundColor White

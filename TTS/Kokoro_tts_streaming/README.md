# Kokoro TTS Streaming Proxy

Este proyecto implementa un servidor Flask proxy para convertir texto a voz usando Kokoro TTS.

## Requisitos
- Docker (opcional, recomendado para despliegue)
- Python 3.10 (si ejecutas localmente)
- Servidor Kokoro TTS ejecutándose

## Configuración

### Variables de Entorno
- `KOKORO_HOST`: Host del servidor Kokoro TTS (default: localhost)
- `KOKORO_PORT`: Puerto del servidor Kokoro TTS (default: 8880)

## Instalación local
1. Crea y activa un entorno virtual:
   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   ```
2. Instala las dependencias:
   ```powershell
   pip install -r requirements.txt
   ```

## Ejecución local
1. Asegúrate de que el servidor Kokoro TTS esté ejecutándose en `localhost:8880`
2. Ejecuta el servidor:
   ```powershell
   & .venv\Scripts\python.exe server.py
   ```
3. El servidor estará disponible en:
   - http://127.0.0.1:5100
   - http://<tu-ip-local>:5100

## Health Check
Verificar el estado del servicio:
```powershell
curl http://localhost:5100/health
```

## Uso de la API
### Endpoint `/tts`
- Método: POST
- Content-Type: application/json
- Body ejemplo:
  ```json
  {
    "text": "Hola, esto es una prueba",
    "emotion": "feliz"
  }
  ```
- Respuesta: archivo de audio WAV

### Probar con curl
```powershell
curl -X POST http://127.0.0.1:5100/tts -H "Content-Type: application/json" -d "{\"text\": \"Hola, esto es una prueba\", \"emotion\": \"feliz\"}" --output respuesta.mp3
```

### Probar con script de Python
```powershell
& .venv\Scripts\python.exe test_service.py
```

## Ejecución con Docker

### Opción 1: Solo el proxy (Kokoro TTS ejecutándose externamente)
1. Construye la imagen:
   ```powershell
   docker build -t kokoro-tts-proxy .
   ```
2. Ejecuta el contenedor:
   ```powershell
   docker run -p 5100:5100 -e KOKORO_HOST=host.docker.internal -e KOKORO_PORT=8880 kokoro-tts-proxy
   ```

### Opción 2: Con docker-compose (incluye Kokoro TTS)
1. Configura la imagen de Kokoro TTS en `docker-compose.yml`
2. Ejecuta:
   ```powershell
   docker-compose up --build
   ```

## Solución de Problemas

### Error de conexión al servidor Kokoro TTS
1. Verifica que Kokoro TTS esté ejecutándose:
   ```powershell
   curl http://localhost:8880/v1/audio/voices
   ```
2. Si usas Docker, asegúrate de usar la IP correcta:
   - Para Windows/Mac: `host.docker.internal`
   - Para Linux: IP del host

### El servicio no responde
1. Verifica el health check:
   ```powershell
   curl http://localhost:5100/health
   ```
2. Revisa los logs del contenedor:
   ```powershell
   docker logs <container-name>
   ```

## Emociones Disponibles
- `neutral`: Sin modificación
- `feliz`: Agrega exclamaciones
- `triste`: Agrega puntos suspensivos
- `emocionado`: Texto en mayúsculas con exclamaciones
- `calmado`: Agrega comas
- `sorprendido`: Agrega signos de interrogación y exclamación
- `inseguro`: Agrega "creo" al final
- `formal`: Agrega instrucciones formales
   ```
2. Ejecuta el contenedor:
   ```powershell
   docker run -p 5000:5000 silero-tts
   ```

## Notas
- El modelo descargará archivos la primera vez que se ejecute.
- Para producción, usa un servidor WSGI como gunicorn.
- Los speakers válidos para español son: `es_0`, `es_1`, `es_2`, `random`.


docker-compose down
docker-compose up -d --build
Start-Sleep -Seconds 5
docker-compose ps
Invoke-WebRequest -Uri "http://localhost:5100/health" -TimeoutSec 10
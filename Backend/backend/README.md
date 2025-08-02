docker build -t asistente-backend .
```

2. Ejecutar el contenedor:
```powershell
docker run -d -p 5000:5000 --network chroma-net --name asistente-IA-backend asistente-backend# Backend .NET (ASP.NET Core Web API)

Este backend debe implementar:
- Endpoint POST `/api/analyze-image` para recibir una imagen y devolver el análisis.
- Endpoint POST `/api/analyze-voice` para recibir texto y devolver la respuesta del asistente.
- Endpoint GET `/api/speak` para síntesis de voz (opcional, si se requiere desde el backend).

Puedes usar los módulos y lógica del asistente Python como referencia para la integración de IA.


docker network create chroma-net

docker run --gpus all -p 8880:8880  --network chroma-net  ghcr.io/remsky/kokoro-fastapi-gpu:latest 




docker build -t kokoro-tts .
docker run -d -p 8000:5100 --network chroma-net  --name microservicio-kokoro-tts kokoro-tts
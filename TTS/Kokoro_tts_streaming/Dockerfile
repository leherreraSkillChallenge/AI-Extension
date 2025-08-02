FROM python:3.10-slim

WORKDIR /app

# Instalar dependencias del sistema y curl para healthcheck
RUN apt-get update && apt-get install -y \
    libsndfile1 ffmpeg curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copiar requirements primero para aprovechar cache de Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código de la aplicación
COPY server.py .

# Crear usuario no-root para seguridad
RUN useradd --create-home --shell /bin/bash tts && \
    chown -R tts:tts /app
USER tts

EXPOSE 5100

# Usar gunicorn para producción en lugar del servidor de desarrollo de Flask
RUN pip install --no-cache-dir gunicorn

# Comando optimizado para producción
CMD ["gunicorn", "--bind", "0.0.0.0:5100", "--workers", "2", "--timeout", "60", "server:app"]
#!/bin/bash

echo "Iniciando ChromaDB y el microservicio..."

# Crear la red si no existe
docker network create chroma_network 2>/dev/null || true

# Construir y levantar los servicios
docker-compose up --build -d

# Esperar a que los servicios estén listos
echo "Esperando a que los servicios estén listos..."
sleep 10

# Verificar el estado de los servicios
echo "Estado de los servicios:"
docker-compose ps

# Verificar que ChromaDB esté funcionando
echo "Verificando ChromaDB..."
curl -f http://localhost:8000/api/v1/heartbeat && echo "✅ ChromaDB está funcionando" || echo "❌ ChromaDB no responde"

# Verificar que el microservicio esté funcionando
echo "Verificando microservicio..."
curl -f http://localhost:9000/health && echo "✅ Microservicio está funcionando" || echo "❌ Microservicio no responde"

echo "¡Despliegue completado!"
echo "URLs disponibles:"
echo "- ChromaDB: http://localhost:8000"
echo "- Microservicio: http://localhost:9000"
echo "- Documentación API: http://localhost:9000/docs"

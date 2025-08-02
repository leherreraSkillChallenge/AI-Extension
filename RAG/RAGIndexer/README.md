# RAGIndexer

Este proyecto de consola en C# extrae texto e imágenes de un manual .docx, aplica OCR a las imágenes y envía los fragmentos enriquecidos a ChromaDB vía API HTTP para su uso en RAG.

## Pasos principales
1. Extraer texto y recorrer los elementos del documento.
2. Extraer imágenes y aplicar OCR.
3. Generar fragmentos enriquecidos (texto + imágenes + texto OCR).
4. Enviar los embeddings y metadatos a ChromaDB.

## Requisitos sugeridos
- DocX Community para manipular .docx
- Tesseract OCR para C#
- Cliente HTTP para comunicación con ChromaDB

## Uso
1. Coloca el manual .docx en la carpeta del proyecto.
2. Ejecuta el indexador para poblar ChromaDB.
3. El backend de tu asistente podrá consultar la base vectorial ya indexada.


Crea un archivo Dockerfile en la misma carpeta que tu chroma_service.py:
FROM python:3.10-slim

WORKDIR /app

COPY chroma_service.py . 
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 9000

CMD ["uvicorn", "chroma_service:app", "--host", "0.0.0.0", "--port", "9000"]

Crea un archivo requirements.txt con:
fastapi
uvicorn
chromadb
pydantic

Construye la imagen:

docker build -t chroma-microservice .

Ejecuta el contenedor:

docker run -d --name chroma-microservice -p 9001:9001 chroma-microservice


docker rm -f chroma

docker volume rm chroma_data

docker run -d --name chroma --network chroma-net -p 8000:8000 -v chroma_data:/chroma/chroma chromadb/chroma


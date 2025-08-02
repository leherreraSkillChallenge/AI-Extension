import requests
import os
from flask import Flask, request, Response
from flask_cors import CORS


DEFAULT_VOICE = "pf_dora"  # /v1/audio/voices para más opciones
KOKORO_HOST = os.getenv('KOKORO_HOST', 'localhost')  # Configurable via environment variable
KOKORO_PORT = os.getenv('KOKORO_PORT', '8880')
app = Flask(__name__)
CORS(app)

def aplicar_emocion(texto, emocion):
    mapa = {
        'neutral': texto,
        'feliz': f"¡{texto}!",
        'triste': f"{texto}...",
        'emocionado': f"¡¡{texto.upper()}!!",
        'calmado': f"{texto}, ",
        'sorprendido': f"¿¡{texto}!?",
        'inseguro': f"{texto}... creo.",
        'formal': f"{texto}. Por favor, siga las instrucciones cuidadosamente."
    }
    return mapa.get(emocion.lower(), texto)

@app.route('/test', methods=['GET'])
def test_kokoro():
    """Endpoint simple para probar la conexión con Kokoro TTS"""
    try:
        # Prueba básica con texto simple
        kokoro_url = f"http://{KOKORO_HOST}:{KOKORO_PORT}/v1/audio/speech"
        payload = {
            "model": "kokoro",
            "input": "Test",
            "voice": "af_bella",
            "response_format": "mp3",
            "speed": 1.0,
            "lang_code": "e"  # idioma
        }
        
        response = requests.post(kokoro_url, json=payload, timeout=10)
        
        if response.status_code == 200:
            return {
                "status": "success",
                "message": "Conexión con Kokoro TTS exitosa",
                "audio_size": len(response.content),
                "content_type": response.headers.get('content-type', 'unknown')
            }
        else:
            return {
                "status": "error",
                "message": f"Kokoro TTS respondió con código {response.status_code}",
                "response": response.text
            }, response.status_code
            
    except requests.exceptions.ConnectionError:
        return {
            "status": "error",
            "message": "No se puede conectar al servidor Kokoro TTS",
            "url": f"http://{KOKORO_HOST}:{KOKORO_PORT}",
            "suggestion": "Verifique que Kokoro TTS esté ejecutándose en el puerto 8880"
        }, 503
    except Exception as e:
        return {
            "status": "error", 
            "message": f"Error inesperado: {str(e)}"
        }, 500

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint para verificar el estado del servicio"""
    try:
        # Verificar conexión con Kokoro TTS
        kokoro_url = f"http://{KOKORO_HOST}:{KOKORO_PORT}/v1/audio/voices"
        response = requests.get(kokoro_url, timeout=5)
        kokoro_status = "OK" if response.status_code == 200 else f"Error {response.status_code}"
    except Exception as e:
        kokoro_status = f"Error: {str(e)}"
    
    return {
        "status": "OK",
        "kokoro_tts": kokoro_status,
        "kokoro_url": f"http://{KOKORO_HOST}:{KOKORO_PORT}",
        "service": "TTS Proxy Service"
    }

@app.route('/tts', methods=['POST'])
def tts():
    data = request.json
    texto = data.get('text', '')
    emocion = data.get('emotion', 'neutral')
    voice = data.get('voice', DEFAULT_VOICE)
    response_format = data.get('response_format', 'mp3')  # mp3 por defecto, más ligero y compatible
    speed = data.get('speed', 0.8)
    texto_emocional = aplicar_emocion(texto, emocion)
    kokoro_url = f"http://{KOKORO_HOST}:{KOKORO_PORT}/v1/audio/speech"
    
    print(f"Conectando a Kokoro TTS en: {kokoro_url}")  # Log para debugging
    payload = {
        "model": "kokoro",
        "input": texto_emocional,
        "voice": voice,
        "response_format": response_format,
        "speed": speed,
        "lang_code": "e"
    }
    headers = {"Content-Type": "application/json"}
    try:
        print(f"Enviando request a: {kokoro_url}")
        print(f"Payload: {payload}")
        kokoro_response = requests.post(kokoro_url, json=payload, stream=True, headers=headers, timeout=30)
        print(f"Respuesta del servidor: {kokoro_response.status_code}")
        kokoro_response.raise_for_status()
        mimetypes = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'opus': 'audio/ogg',
            'flac': 'audio/flac',
            'aac': 'audio/aac',
            'pcm': 'audio/L16'
        }
        mimetype = mimetypes.get(response_format, 'audio/mpeg')
        def generate():
            for chunk in kokoro_response.iter_content(chunk_size=4096):
                if chunk:
                    yield chunk
        return Response(generate(), mimetype=mimetype)
    except requests.exceptions.ConnectionError as e:
        print(f"Error de conexión a Kokoro TTS: {str(e)}")
        return Response(f"Error: No se puede conectar al servidor Kokoro TTS en {kokoro_url}. Verifique que el servidor esté ejecutándose.", status=503)
    except requests.exceptions.Timeout as e:
        print(f"Timeout conectando a Kokoro TTS: {str(e)}")
        return Response("Error: Timeout conectando al servidor Kokoro TTS", status=504)
    except requests.exceptions.HTTPError as e:
        print(f"Error HTTP de Kokoro TTS: {str(e)}")
        return Response(f"Error HTTP del servidor Kokoro TTS: {str(e)}", status=kokoro_response.status_code)
    except Exception as e:
        print(f"Error inesperado: {str(e)}")
        return Response(f"Error inesperado en Kokoro TTS local: {str(e)}", status=500)


# El endpoint /tts-stream no es necesario con Kokoro, pero puedes duplicar la lógica si lo deseas

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5100)
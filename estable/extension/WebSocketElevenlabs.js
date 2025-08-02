// Conectar al WebSocket de streaming
const apiKey = "sk_b1f79fd76fc020e5721f94494f741e0df21a629bfb30646e";

const ws = new WebSocket(`wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`);

ws.onopen = function() {
    console.log("Conexión WebSocket establecida");
    
    // Enviar configuración inicial
    const config = {
        text: "Hola, este es un ejemplo de streaming de texto a voz, vamos a validar si es mejor asi, jejejejejeje",
        voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
        },
        xi_api_key: apiKey
    };
    
    ws.send(JSON.stringify(config));
};

ws.onmessage = function(event) {
    // Recibir chunks de audio en tiempo real
    const audioChunk = event.data;
    // Procesar el chunk de audio (reproducir, guardar, etc.)
    console.log("Chunk de audio recibido:", audioChunk);
};

ws.onclose = function() {
    console.log("Conexión WebSocket cerrada");
};

ws.onerror = function(error) {
    console.error("Error en WebSocket:", error);
};
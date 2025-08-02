/*
 * ================================================================
 * Asistente Web Flotante - Content Script
 * ================================================================
 * 
 * Descripción: Script de contenido que se inyecta en todas las 
 *              páginas web para mostrar el widget flotante del
 *              asistente y gestionar la interacción del usuario.
 * 
 * Autores: Equipo de Desarrollo
 * Fecha de creación: 01/08/2025
 * Última modificación: 02/08/2025
 * Versión: 1.0.0
 * 
 * Copyright (c) 2025 Indra Colombia.
 * Todos los derechos reservados.
 * ================================================================
 */

let assistantWidget = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let assistantActive = false;
let recognition = null;
let recognitionActive = false;
let isProcessing = false;
let isAudioPlaying = false;
let isFirstInteraction = true;
let isRestarting = false; // Nueva variable para prevenir reinicios múltiples
let isRequestInProgress = false; // Nueva variable para rastrear peticiones completas en progreso

// URL del webhook de n8n (usado solo para referencia, las peticiones van por background)
const N8N_WEBHOOK_URL = 'https://randomly-exciting-termite.ngrok-free.app/webhook/asistente-agent';

// Variables para calidad de conexión
let lastResponseTime = 0;
let averageResponseTime = 5000; // Empezar con 5s promedio
let connectionQuality = 'unknown'; // 'fast', 'medium', 'slow', 'unknown'

// Detectar calidad de conexión basada en tiempos de respuesta
function updateConnectionQuality(responseTime) {
  lastResponseTime = responseTime;
  
  // Calcular promedio móvil simple (últimas 3 respuestas)
  averageResponseTime = (averageResponseTime * 0.7) + (responseTime * 0.3);
  
  if (averageResponseTime < 3000) {
    connectionQuality = 'fast';
  } else if (averageResponseTime < 8000) {
    connectionQuality = 'medium';
  } else {
    connectionQuality = 'slow';
  }
}

// Obtener timeout dinámico basado en calidad de conexión
function getDynamicTimeout() {
  switch (connectionQuality) {
    case 'fast': return 20000;   // 20 segundos
    case 'medium': return 35000; // 35 segundos  
    case 'slow': return 60000;   // 60 segundos
    default: return 45000;       // 45 segundos por defecto
  }
}

// Mostrar estadísticas de conexión
function logConnectionStats() {
  // Función removida para optimización de velocidad
}

// Función para obtener o generar un token único por máquina
async function getUserToken() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['userToken'], (result) => {
        if (chrome.runtime.lastError) {
          // Si hay error, generar token sin guardarlo
          resolve(crypto.randomUUID());
          return;
        }
        
        if (result.userToken) {
          resolve(result.userToken);
        } else {
          // Generar nuevo token único usando crypto.randomUUID
          const newToken = crypto.randomUUID();
          chrome.storage.local.set({ userToken: newToken }, () => {
            if (chrome.runtime.lastError) {
              // Error silencioso al guardar token
            }
            resolve(newToken);
          });
        }
      });
    } catch (error) {
      // Si falla completamente, generar token temporal
      resolve(crypto.randomUUID());
    }
  });
}

// Crear el widget flotante
function createFloatingWidget() {
  if (assistantWidget) return; // Ya existe

  assistantWidget = document.createElement('div');
  assistantWidget.id = 'asistente-flotante';
  assistantWidget.innerHTML = `
    <div class="cabecera-widget">
      <h3 class="titulo-widget"><img src="${chrome.runtime.getURL('icon16.png')}" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;"> Asistente IA</h3>
      <div class="controles-widget">
        <button class="btn-control" id="minimizar-widget" title="Minimizar">−</button>
        <button class="btn-control" id="cerrar-widget" title="Cerrar">×</button>
      </div>
    </div>
    <div class="contenido-widget">
      <div class="estado-asistente">
        <button class="btn-principal" id="toggle-asistente">Activar Asistente</button>
        <div class="indicador-estado">
          <span class="icono-estado inactivo" id="icono-estado"></span>
          <span id="texto-estado">Inactivo</span>
        </div>
        <div class="ondas-audio" id="ondas-audio" style="display: none;">
          <div class="onda"></div>
          <div class="onda"></div>
          <div class="onda"></div>
          <div class="onda"></div>
          <div class="onda"></div>
        </div>
      </div>
    </div>
    <div class="icono-minimizado" id="icono-minimizado">
      <img src="${chrome.runtime.getURL('icon16.png')}" style="width: 16px; height: 16px;">
    </div>
  `;

  document.body.appendChild(assistantWidget);
  setupWidgetEvents();
}

// Configurar eventos del widget
function setupWidgetEvents() {
  // Botón principal de activar/desactivar
  const toggleBtn = document.getElementById('toggle-asistente');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleAssistant);
  }

  // Botón minimizar
  const minimizeBtn = document.getElementById('minimizar-widget');
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', toggleMinimize);
  }

  // Botón cerrar
  const closeBtn = document.getElementById('cerrar-widget');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeWidget);
  }

  // Icono minimizado (para expandir)
  const iconoMinimizado = document.getElementById('icono-minimizado');
  if (iconoMinimizado) {
    iconoMinimizado.addEventListener('click', toggleMinimize);
  }

  // Hacer el widget arrastrable
  setupDragging();

  // Restaurar estado del widget
  restoreWidgetState();
}

// Configurar funcionalidad de arrastrar
function setupDragging() {
  const cabecera = assistantWidget.querySelector('.cabecera-widget');
  const iconoMinimizado = document.getElementById('icono-minimizado');

  [cabecera, iconoMinimizado].forEach(element => {
    if (element) {
      element.addEventListener('mousedown', startDragging);
    }
  });

  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDragging);
}

function startDragging(e) {
  isDragging = true;
  const rect = assistantWidget.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;
  assistantWidget.style.cursor = 'grabbing';
  e.preventDefault();
}

function drag(e) {
  if (!isDragging) return;

  const x = e.clientX - dragOffset.x;
  const y = e.clientY - dragOffset.y;

  // Mantener el widget dentro de la ventana
  const maxX = window.innerWidth - assistantWidget.offsetWidth;
  const maxY = window.innerHeight - assistantWidget.offsetHeight;

  const clampedX = Math.max(0, Math.min(x, maxX));
  const clampedY = Math.max(0, Math.min(y, maxY));

  assistantWidget.style.left = clampedX + 'px';
  assistantWidget.style.top = clampedY + 'px';
  assistantWidget.style.right = 'auto';
}

function stopDragging() {
  if (isDragging) {
    isDragging = false;
    assistantWidget.style.cursor = 'move';
    saveWidgetPosition();
  }
}

// Guardar posición del widget
function saveWidgetPosition() {
  if (!assistantWidget) return;
  
  try {
    const rect = assistantWidget.getBoundingClientRect();
    chrome.storage.local.set({
      widgetPosition: {
        x: rect.left,
        y: rect.top
      }
    }, () => {
      if (chrome.runtime.lastError) {
        // Error silencioso al guardar posición
      }
    });
  } catch (error) {
    // Error silencioso
  }
}

// Restaurar estado del widget
function restoreWidgetState() {
  try {
    chrome.storage.local.get(['widgetPosition', 'widgetMinimized'], (result) => {
      if (chrome.runtime.lastError) {
        // Error silencioso al restaurar estado
        return;
      }
      
      if (!assistantWidget) return;
      
      // Restaurar posición
      if (result.widgetPosition) {
        assistantWidget.style.left = result.widgetPosition.x + 'px';
        assistantWidget.style.top = result.widgetPosition.y + 'px';
        assistantWidget.style.right = 'auto';
      }

      // Restaurar estado minimizado
      if (result.widgetMinimized) {
        assistantWidget.classList.add('minimizado');
      }
    });
  } catch (error) {
    // Error silencioso al acceder al storage
  }
}

// Minimizar/expandir widget
function toggleMinimize() {
  if (!assistantWidget) return;
  
  try {
    const isMinimized = assistantWidget.classList.toggle('minimizado');
    chrome.storage.local.set({ widgetMinimized: isMinimized }, () => {
      if (chrome.runtime.lastError) {
        // Error silencioso al guardar estado minimizado
      }
    });
  } catch (error) {
    // Error silencioso
  }
}

// Cerrar widget
function closeWidget() {
  // console.log('Cerrando widget completamente');
  
  if (assistantActive) {
    // console.log('Desactivando asistente desde closeWidget');
    deactivateAssistant();
  }
  
  if (assistantWidget) {
    assistantWidget.remove();
    assistantWidget = null;
    // console.log('Widget removido del DOM');
  }
}

// Toggle del asistente
function toggleAssistant() {
  // console.log('Toggle asistente - estado actual:', assistantActive);
  
  if (assistantActive) {
    // console.log('Desactivando asistente desde toggle');
    deactivateAssistant();
  } else {
    // console.log('Activando asistente desde toggle');
    activateAssistant();
  }
}

// Activar asistente
function activateAssistant() {
  assistantActive = true;
  streamingCompletelyFinished = true; // Inicializar como terminado para casos sin streaming
  updateWidgetState('activo', 'Escuchando...');
  startContinuousAssistant();
  
  const toggleBtn = document.getElementById('toggle-asistente');
  if (toggleBtn) {
    toggleBtn.textContent = 'Desactivar Asistente';
    toggleBtn.classList.add('activo');
  }
}

// Desactivar asistente
function deactivateAssistant() {
  // console.log('Desactivando asistente - deteniendo todo');
  
  assistantActive = false;
  isProcessing = false;
  isRequestInProgress = false; // Resetear petición en progreso
  streamingCompletelyFinished = false; // Reset streaming state
  
  // Limpiar timeout de detección de pausa
  clearTimeout(window.speechTimeout);
  
  // Limpiar flags de solicitud activa
  isRequestActive = false;
  
  // DETENER AUDIO INMEDIATAMENTE si está reproduciéndose
  forceStopAudio();
  
  stopContinuousAssistant();
  updateWidgetState('inactivo', 'Inactivo');

  const toggleBtn = document.getElementById('toggle-asistente');
  if (toggleBtn) {
    toggleBtn.textContent = 'Activar Asistente';
    toggleBtn.classList.remove('activo');
  }
}

// Actualizar estado visual del widget
function updateWidgetState(estado, texto) {
  const iconoEstado = document.getElementById('icono-estado');
  const textoEstado = document.getElementById('texto-estado');
  const ondasAudio = document.getElementById('ondas-audio');

  if (iconoEstado) {
    iconoEstado.className = `icono-estado ${estado}`;
  }
  
  if (textoEstado) {
    textoEstado.textContent = texto;
  }

  if (ondasAudio) {
    ondasAudio.style.display = estado === 'hablando' ? 'flex' : 'none';
  }
}

// Inicializar reconocimiento de voz
function startContinuousAssistant() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    updateWidgetState('inactivo', 'Sin soporte de voz');
    return;
  }

  // Solicitar permisos de micrófono con configuración optimizada
  navigator.mediaDevices.getUserMedia({ 
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 44100
    } 
  })
    .then(function(stream) {
      // Detener el stream inmediatamente (solo lo necesitábamos para permisos)
      stream.getTracks().forEach(track => track.stop());
      
      // Inicializar el reconocimiento inmediatamente
      setupSpeechRecognition();
    })
    .catch(function(err) {
      updateWidgetState('inactivo', 'Micrófono denegado');
      showMicrophonePermissionHelper();
    });
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1; // Volver a 1 para respuesta más rápida
  recognition.continuous = true;
  
  // Configuraciones adicionales para mejorar sensibilidad y velocidad
  if ('webkitSpeechRecognition' in window) {
    recognition.grammars = new webkitSpeechGrammarList();
  }
  
  recognitionActive = false;

  recognition.onstart = () => {
    recognitionActive = true;
    updateWidgetState('activo', 'Escuchando...');
  };

  recognition.onresult = async (event) => {
    if (isProcessing) {
      return;
    }

    const lastResult = event.results[event.results.length - 1];
    const text = lastResult[0].transcript.trim();
    const confidence = lastResult[0].confidence || 1;
    
    // Mostrar texto interim para feedback visual
    if (!lastResult.isFinal) {
      if (text.length > 0) {
        updateWidgetState('activo', `Escuchando: "${text}"`);
        
        // Detectar pausa natural: si el texto es suficientemente largo y no ha cambiado
        if (text.length > 2) { // Reducido de 3 a 2 caracteres para mayor sensibilidad
          // Usar setTimeout para detectar pausa en el habla
          clearTimeout(window.speechTimeout);
          window.speechTimeout = setTimeout(() => {
            // Si después de 800ms el texto no ha cambiado, procesarlo
            if (!isProcessing && text.length > 2 && assistantActive) {
              isProcessing = true;
              
              // Detener reconocimiento
              try {
                if (recognition && recognitionActive) {
                  recognition.stop();
                  recognitionActive = false;
                }
              } catch (e) {
                // Error silencioso
              }
              
              updateWidgetState('procesando', `Procesando: "${text}"`);
              
              processVoiceCommand(text).then(() => {
                isProcessing = false;
                setTimeout(() => {
                  safeRestartRecognition('después de procesar por pausa');
                }, 100); // Reducido de 200ms a 100ms para reinicio ultra-rápido
              }).catch(() => {
                isProcessing = false;
                updateWidgetState('activo', 'Error en procesamiento');
                setTimeout(() => {
                  safeRestartRecognition('después de error');
                }, 500);
              });
            }
          }, 800); // Reducido de 1500ms a 800ms para respuesta ultra-rápida
        }
      }
      return;
    }

    // Limpiar timeout si hay resultado final
    clearTimeout(window.speechTimeout);

    // Procesar resultado final inmediatamente
    if (lastResult.isFinal && text.length > 0 && confidence > 0.5) {
      isProcessing = true;

      // DETENER reconocimiento ANTES de procesar
      try {
        if (recognition && recognitionActive) {
          recognition.stop();
          recognitionActive = false;
        }
      } catch (e) {
        // Error silencioso
      }

      updateWidgetState('procesando', `Procesando: "${text}"`);

      try {
        await processVoiceCommand(text);
      } catch (error) {
        updateWidgetState('activo', 'Error en procesamiento');
      } finally {
        isProcessing = false;
        setTimeout(() => {
          safeRestartRecognition('después de procesar texto final');
        }, 100); // Reducido de 200ms a 100ms
      }
    }
  };

  recognition.onerror = (event) => {
    recognitionActive = false; // Marcar como inactivo inmediatamente
    handleRecognitionError(event.error);
  };

  recognition.onend = () => {
    recognitionActive = false;
    
    // IMPORTANTE: NO reiniciar si hay una petición completa en progreso
    if (isRequestInProgress) {
      // console.log('Reconocimiento terminó pero hay petición en progreso - esperando...');
      return;
    }
    
    // Reiniciar inmediatamente si no hay procesamiento ni audio
    if (assistantActive && !isProcessing && !isAudioPlaying && !isRestarting) {
      setTimeout(() => {
        if (assistantActive && !recognitionActive && !isProcessing && !isAudioPlaying && !isRestarting && !isRequestInProgress) {
          safeRestartRecognition('reconocimiento termino naturalmente');
        }
      }, 50); // Reducido de 100ms a 50ms para reinicio instantáneo
    }
  };

  try {
    recognitionActive = true; // Marcar como activo antes de iniciar
    recognition.start();
  } catch (error) {
    recognitionActive = false; // Resetear si falló
    if (error.message && error.message.includes('already started')) {
      // Si ya está iniciado, marcar como activo
      recognitionActive = true;
    } else {
      updateWidgetState('inactivo', 'Error al iniciar');
    }
  }
}

// Función centralizada para reiniciar reconocimiento de forma segura
function safeRestartRecognition(reason = '') {
  // console.log('safeRestartRecognition llamado:', reason, {
  //   assistantActive: assistantActive,
  //   recognition: !!recognition,
  //   recognitionActive: recognitionActive,
  //   isProcessing: isProcessing,
  //   isAudioPlaying: isAudioPlaying,
  //   isRestarting: isRestarting,
  //   isRequestInProgress: isRequestInProgress,
  //   isStreamingAudio: isStreamingAudio,
  //   streamingCompletelyFinished: streamingCompletelyFinished,
  //   queueLength: audioStreamingQueue.length
  // });

  // Verificar condiciones básicas + petición en progreso
  // Si el streaming ya terminó (isStreamingAudio = false), permitir que se maneje normalmente
  if (!assistantActive || !recognition || recognitionActive || isProcessing || isRestarting || isRequestInProgress) {
    if (isRequestInProgress) {
      // console.log('safeRestartRecognition bloqueado - petición en progreso:', reason);
    } else if (isProcessing) {
      // console.log('safeRestartRecognition bloqueado - procesando:', reason);
    } else if (recognitionActive) {
      // console.log('safeRestartRecognition bloqueado - reconocimiento activo:', reason);
    }
    return;
  }

  // Si hay streaming activo, bloquear completamente
  if (isStreamingAudio) {
    // console.log('safeRestartRecognition bloqueado - streaming activo:', reason);
    return;
  }

  // Si hay audio reproduciéndose normal (no de streaming), bloquear
  if (isAudioPlaying) {
    // Solo bloquear si NO es el final del streaming
    if (!streamingCompletelyFinished) {
      // console.log('safeRestartRecognition bloqueado - audio reproduciéndose (no streaming final):', reason);
      return;
    } else {
      // console.log('Audio reproduciéndose pero streaming terminado - permitiendo reinicio:', reason);
    }
  }

  // Verificación adicional: revisar si realmente hay audio reproduciéndose
  const audioPlayer = document.getElementById('assistant-audio-player');
  if (audioPlayer && !audioPlayer.paused && !audioPlayer.ended) {
    // console.log('safeRestartRecognition bloqueado - audio element activo:', reason);
    return;
  }

  // console.log('Reiniciando reconocimiento:', reason);
  
  // Reset streaming flags si es necesario
  if (streamingCompletelyFinished) {
    streamingCompletelyFinished = false;
    // console.log('Reset streamingCompletelyFinished flag');
  }
  
  isRestarting = true; // Bloquear otros reinicios
  
  try {
    recognitionActive = true;
    recognition.start();
    isRestarting = false;
  } catch (error) {
    recognitionActive = false;
    
    if (error.message && error.message.includes('already started')) {
      recognitionActive = true;
      isRestarting = false;
      return;
    }
    
    // Solo un reintento ultra-rápido
    setTimeout(() => {
      if (assistantActive && !recognitionActive && !isProcessing && !isAudioPlaying && !isRestarting) {
        isRestarting = true;
        try {
          recognitionActive = true;
          recognition.start();
          isRestarting = false;
        } catch (e) {
          recognitionActive = false;
          isRestarting = false;
        }
      } else {
        isRestarting = false;
      }
    }, 500); // Reducido de 1000ms a 500ms
  }
}

// Manejar errores de reconocimiento
function handleRecognitionError(error) {
  // Solo mostrar error si es grave
  if (error === 'not-allowed' || error === 'denied') {
    mostrarErrorReconocimiento(error);
  }
  
  // Marcar como inactivo inmediatamente
  recognitionActive = false;
  
  switch (error) {
    case 'no-speech':
      updateWidgetState('activo', 'Escuchando...');
      // Reiniciar casi inmediatamente para mejor respuesta
      if (assistantActive && !isProcessing && !isRestarting) {
        isRestarting = true;
        setTimeout(() => {
          if (assistantActive && !recognitionActive && !isProcessing && !isAudioPlaying) {
            safeRestartRecognition('no se detectó voz');
          } else {
            isRestarting = false;
          }
        }, 25); // Reducido de 50ms a 25ms para respuesta instantánea
      }
      break;
    case 'not-allowed':
    case 'denied':
      updateWidgetState('inactivo', 'Micrófono denegado');
      showMicrophonePermissionHelper();
      break;
    case 'network':
      updateWidgetState('activo', 'Reconectando...');
      if (assistantActive && !isRestarting) {
        isRestarting = true;
        setTimeout(() => {
          if (assistantActive && !recognitionActive && !isProcessing && !isAudioPlaying) {
            safeRestartRecognition('después de error de red');
          } else {
            isRestarting = false;
          }
        }, 500); // Reinicio más rápido para errores de red
      }
      break;
    case 'aborted':
      updateWidgetState('activo', 'Escuchando...');
      // Reinicio más rápido después de abort
      if (assistantActive && !isProcessing && !isRestarting) {
        isRestarting = true;
        setTimeout(() => {
          if (assistantActive && !recognitionActive && !isProcessing && !isAudioPlaying) {
            safeRestartRecognition('después de abort');
          } else {
            isRestarting = false;
          }
        }, 200);
      }
      break;
    default:
      updateWidgetState('activo', 'Escuchando...');
      if (assistantActive && !isRestarting) {
        isRestarting = true;
        setTimeout(() => {
          if (assistantActive && !recognitionActive && !isProcessing && !isAudioPlaying) {
            safeRestartRecognition('después de error desconocido');
          } else {
            isRestarting = false;
          }
        }, 300);
      }
      break;
  }
}

// Mostrar el último error de reconocimiento en el widget
function mostrarErrorReconocimiento(error) {
  if (assistantWidget) {
    const contenido = assistantWidget.querySelector('.contenido-widget');
    if (!contenido) return;
    // Eliminar mensaje anterior si existe
    let errorDiv = document.getElementById('asistente-error-reconocimiento');
    if (errorDiv) {
      errorDiv.remove();
    }
    errorDiv = document.createElement('div');
    errorDiv.id = 'asistente-error-reconocimiento';
    errorDiv.style.marginTop = '10px';
    errorDiv.style.padding = '8px';
    errorDiv.style.background = 'rgba(231, 76, 60, 0.2)';
    errorDiv.style.borderRadius = '6px';
    errorDiv.style.fontSize = '13px';
    errorDiv.style.color = '#c0392b';
    errorDiv.style.fontWeight = 'bold';
    errorDiv.textContent = 'Error de reconocimiento: ' + error;
    contenido.appendChild(errorDiv);
    // Hacer scroll para que el mensaje sea visible
    errorDiv.scrollIntoView({behavior: 'smooth', block: 'center'});
    // Ocultar el mensaje después de 8 segundos
    setTimeout(() => {
      if (errorDiv && errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 8000);
  }
}

// Mostrar ayuda para permisos de micrófono
function showMicrophonePermissionHelper() {
  if (assistantWidget) {
    const contenido = assistantWidget.querySelector('.contenido-widget');
    if (contenido) {
      contenido.innerHTML += `
        <div class="help-message" style="margin-top: 10px; padding: 8px; background: rgba(231, 76, 60, 0.2); border-radius: 6px; font-size: 11px;">
          Para usar el micrófono:<br>
          1. Click en el 🔒 junto a la URL<br>
          2. Permitir "Micrófono"<br>
          3. Recargar la página
        </div>
      `;
    }
  }
}

// Detener asistente
function stopContinuousAssistant() {
  // console.log('stopContinuousAssistant - deteniendo servicios');
  
  assistantActive = false;
  isProcessing = false;
  isRequestInProgress = false; // Resetear petición en progreso
  
  // Limpiar timeout de detección de pausa
  clearTimeout(window.speechTimeout);

  // Detener reconocimiento de voz
  if (recognition) {
    try {
      // console.log('Deteniendo reconocimiento de voz');
      recognition.stop();
      recognition = null;
      recognitionActive = false;
    } catch (error) {
      // console.log('Error deteniendo reconocimiento:', error);
    }
  }

  // Cancelar síntesis de voz si está activa
  if ('speechSynthesis' in window) {
    // console.log('Cancelando síntesis de voz');
    window.speechSynthesis.cancel();
  }

  // DETENER TODOS LOS AUDIOS usando la función centralizada
  stopAllAudioPlayback();
}

// Función auxiliar para forzar la detención de audio
function forceStopAudio() {
  // console.log('Forzando detención completa de audio y streaming');
  
  // Usar la función centralizada de limpieza de audio
  stopAllAudioPlayback();
  
  // Limpiar variables específicas de streaming
  isStreamingAudio = false;
  audioStreamingQueue = []; // Limpiar cola de streaming
  streamingCompletelyFinished = false; // Reset flag
  
  // Actualizar estado visual
  updateWidgetState('inactivo', 'Inactivo');
  
  // console.log('Audio y streaming forzosamente detenidos');
  
  // También detener síntesis de voz si está activa
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    // console.log('Síntesis de voz cancelada');
  }
}

let isRequestActive = false; // Variable más simple para manejar solicitudes concurrentes

// Procesar comando de voz (herramientas locales vs IA)
async function processVoiceCommand(userText) {
  // Verificar si es un comando de herramientas locales
  if (isLocalToolCommand(userText)) {
    executeLocalTool(userText);
    return; // No enviar a N8N
  }
  
  // Si no es comando local, enviar a IA
  await sendToAskAi(userText);
}

// Detectar si es comando de herramientas locales
function isLocalToolCommand(text) {
  const lowerText = text.toLowerCase().trim();
  
  // PRIORIDAD 1: Verificar comandos especiales ANTES que cualquier otra cosa
  if (isSubmitCommand(text)) return true;
  if (isSpaceRemovalCommand(text)) return true;
  if (isSelectionCommand(text)) return true;
  if (isNavigationCommand(text)) return true;
  if (isModificationCommand(text)) return true;
  
  // Comandos de escritura básicos
  const writeCommands = [
    'escribe', 'escribir', 'escriba',
    'agrega', 'agregar', 'agregue', 'añade', 'añadir',
    'pon', 'poner', 'ponga', 'ponme',
    'completa', 'completar', 'complete',
    'llena', 'llenar', 'llene'
  ];
  
  const hasWriteCommand = writeCommands.some(cmd => lowerText.includes(cmd));
  if (hasWriteCommand) {
    const cleanedText = cleanCommand(text);
    return cleanedText.length > 2; // Solo si hay contenido sustancial
  }
  
  return false;
}

// Ejecutar herramienta local
function executeLocalTool(command) {
  updateWidgetState('procesando', 'Ejecutando herramienta...');
  
  try {
    // Mostrar feedback visual
    setTimeout(() => {
      updateWidgetState('activo', 'Herramienta ejecutada');
    }, 500);
    
    // Detectar tipo de comando y ejecutar
    if (isSubmitCommand(command)) {
      handleSubmitCommand();
    } else if (isSpaceRemovalCommand(command)) {
      handleSpaceRemovalCommand();
    } else if (isSelectionCommand(command)) {
      handleSelectionCommand(command);
    } else if (isNavigationCommand(command)) {
      handleNavigationCommand(command);
    } else if (isModificationCommand(command)) {
      handleModificationCommand(command);
    } else {
      // Comando de escritura normal
      handleWriteCommand(command);
    }
    
    // Volver a escuchar rápidamente
    setTimeout(() => {
      updateWidgetState('activo', 'Escuchando...');
    }, 1000);
    
  } catch (error) {
    updateWidgetState('activo', 'Error en herramienta');
    
    setTimeout(() => {
      updateWidgetState('activo', 'Escuchando...');
    }, 2000);
  }
}

// Funciones de detección de comandos (adaptadas de content-simple.js)
function isSubmitCommand(command) {
  const lowerText = command.toLowerCase();
  const submitKeywords = [
    'enviar formulario', 'envía formulario', 'envío formulario',
    'submit', 'enviar', 'mandar formulario', 'completar formulario'
  ];
  return submitKeywords.some(keyword => lowerText.includes(keyword));
}

function isSpaceRemovalCommand(command) {
  const lowerText = command.toLowerCase();
  const spaceKeywords = [
    'elimina espacios', 'quita espacios', 'sin espacios', 'limpia espacios'
  ];
  return spaceKeywords.some(keyword => lowerText.includes(keyword));
}

function isSelectionCommand(command) {
  const lowerText = command.toLowerCase();
  const selectKeywords = [
    'selecciona', 'seleccionar', 'elige', 'elegir', 'escoge', 'escoger'
  ];
  return selectKeywords.some(keyword => lowerText.includes(keyword));
}

function isNavigationCommand(command) {
  const lowerText = command.toLowerCase();
  const navKeywords = [
    'siguiente', 'anterior', 'siguiente campo', 'anterior campo',
    'atrás', 'adelante', 'next', 'previous'
  ];
  return navKeywords.some(keyword => lowerText.includes(keyword));
}

function isModificationCommand(command) {
  const lowerText = command.toLowerCase();
  const modKeywords = [
    'modifica', 'modificar', 'cambia', 'cambiar', 'reemplaza', 'reemplazar'
  ];
  return modKeywords.some(keyword => lowerText.includes(keyword));
}

// Funciones de ejecución de herramientas (simplificadas)
function handleWriteCommand(command) {
  const cleanValue = cleanCommand(command);
  const activeElement = document.activeElement;
  
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    fillFieldFast(activeElement, cleanValue);
  } else {
    findAndFillField(cleanValue);
  }
}

function handleModificationCommand(command) {
  const cleanValue = cleanCommand(command);
  const activeElement = document.activeElement;
  
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    // Mostrar feedback visual
    const originalBg = activeElement.style.background;
    activeElement.style.background = '#fff3cd';
    
    fillFieldFast(activeElement, cleanValue);
    
    setTimeout(() => {
      activeElement.style.background = originalBg;
    }, 1000);
  }
}

function handleNavigationCommand(command) {
  const lowerText = command.toLowerCase();
  
  if (lowerText.includes('siguiente') || lowerText.includes('next')) {
    moveToNextField();
  } else if (lowerText.includes('anterior') || lowerText.includes('previous') || lowerText.includes('atrás')) {
    moveToPreviousField();
  }
}

function handleSelectionCommand(command) {
  const activeElement = document.activeElement;
  
  if (activeElement && activeElement.tagName === 'SELECT') {
    selectInDropdown(activeElement, command);
  } else {
    const selects = document.querySelectorAll('select');
    const visibleSelect = Array.from(selects).find(select => 
      select.offsetParent !== null && !select.disabled
    );
    if (visibleSelect) {
      visibleSelect.focus();
      selectInDropdown(visibleSelect, command);
    }
  }
}

function handleSubmitCommand() {
  // Buscar botón de envío
  const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"]');
  if (submitButtons.length > 0) {
    submitButtons[0].click();
    return;
  }
  
  // Buscar formulario y enviarlo
  const forms = document.querySelectorAll('form');
  if (forms.length > 0) {
    forms[0].submit();
  }
}

function handleSpaceRemovalCommand() {
  const activeElement = document.activeElement;
  
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    const newValue = activeElement.value.replace(/\s+/g, '');
    activeElement.value = newValue;
    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    activeElement.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// Funciones auxiliares
function cleanCommand(text) {
  if (!text) return '';
  
  let cleaned = text.toLowerCase().trim();
  const commandWords = [
    'escribe', 'escribir', 'agrega', 'agregar', 'pon', 'poner',
    'completa', 'completar', 'llena', 'llenar', 'modifica', 'modificar',
    'cambia', 'cambiar', 'reemplaza', 'reemplazar'
  ];
  
  commandWords.forEach(word => {
    cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'g'), '').trim();
  });
  
  return cleaned;
}

function cleanSelectionCommand(command) {
  return command
    .replace(/^(selecciona|seleccionar|elige|elegir|escoge|escoger|busca|buscar|encuentra|encontrar)\s*/i, '')
    .replace(/^(en el desplegable|en el dropdown|en el select|en el combo|del desplegable|del dropdown|del select|del combo)\s*/i, '')
    .replace(/^(la opción|opción|el valor|valor|la|el|un|una)\s*/i, '')
    .trim();
}

function moveToNextField() {
  const inputs = document.querySelectorAll('input, select, textarea');
  const inputArray = Array.from(inputs).filter(input => {
    const style = window.getComputedStyle(input);
    return style.display !== 'none' && style.visibility !== 'hidden' && !input.disabled && !input.readOnly;
  });
  
  const activeElement = document.activeElement;
  const currentIndex = inputArray.indexOf(activeElement);
  
  if (currentIndex >= 0 && currentIndex < inputArray.length - 1) {
    const nextInput = inputArray[currentIndex + 1];
    nextInput.focus();
    nextInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function fillFieldFast(field, value) {
  field.value = value;
  field.focus();
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}

function findAndFillField(value) {
  // Buscar campo visible más probable
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea');
  const visibleInput = Array.from(inputs).find(input => 
    input.offsetParent !== null && !input.disabled && !input.readOnly
  );
  
  if (visibleInput) {
    fillFieldFast(visibleInput, value);
  }
}

function moveToNextField() {
  const focusableElements = document.querySelectorAll(
    'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
  );
  const currentElement = document.activeElement;
  const currentIndex = Array.from(focusableElements).indexOf(currentElement);
  
  if (currentIndex >= 0 && currentIndex < focusableElements.length - 1) {
    focusableElements[currentIndex + 1].focus();
  }
}

function moveToPreviousField() {
  const focusableElements = document.querySelectorAll(
    'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
  );
  const currentElement = document.activeElement;
  const currentIndex = Array.from(focusableElements).indexOf(currentElement);
  
  if (currentIndex > 0) {
    focusableElements[currentIndex - 1].focus();
  }
}

function selectInDropdown(selectElement, command) {
  const cleanValue = cleanSelectionCommand(command);
  
  // Mostrar feedback visual
  const originalBg = selectElement.style.background;
  selectElement.style.background = '#e7f3ff'; // Azul suave
  
  // Buscar la opción más similar
  const options = Array.from(selectElement.options);
  let bestMatch = null;
  let bestScore = 0;
  
  options.forEach(option => {
    if (option.value === '' && option.text.trim() === '') return; // Skip empty options
    
    const optionText = option.text.toLowerCase();
    const cleanLower = cleanValue.toLowerCase();
    
    // Coincidencia exacta
    if (optionText === cleanLower) {
      bestMatch = option;
      bestScore = 100;
      return;
    }
    
    // Coincidencia parcial (contiene)
    if (optionText.includes(cleanLower) || cleanLower.includes(optionText)) {
      const score = Math.max(
        cleanLower.length / optionText.length,
        optionText.length / cleanLower.length
      ) * 80;
      if (score > bestScore) {
        bestMatch = option;
        bestScore = score;
      }
    }
    
    // Coincidencia por palabras
    const words = cleanLower.split(/\s+/);
    const optionWords = optionText.split(/\s+/);
    const commonWords = words.filter(word => optionWords.some(ow => ow.includes(word)));
    if (commonWords.length > 0) {
      const score = (commonWords.length / Math.max(words.length, optionWords.length)) * 60;
      if (score > bestScore) {
        bestMatch = option;
        bestScore = score;
      }
    }
  });
  
  if (bestMatch && bestScore > 30) {
    selectElement.value = bestMatch.value;
    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Auto-navegar al siguiente campo después de un momento
    setTimeout(() => {
      moveToNextField();
    }, 500);
  }
  
  // Restaurar color
  setTimeout(() => {
    selectElement.style.background = originalBg;
  }, 1000);
}

// Enviar al asistente IA
async function sendToAskAi(userText) {
  try {
    // Prevenir solicitudes concurrentes
    if (isRequestActive) {
      return;
    }
    
    isRequestActive = true;
    // Captura de pantalla SIEMPRE - con información mejorada de la pestaña actual
    const base64Image = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => resolve(''), 1500);
      
      // Enviar información adicional sobre la pestaña actual
      chrome.runtime.sendMessage({
        action: 'captureTab',
        currentUrl: window.location.href,
        currentTitle: document.title,
        timestamp: Date.now() // Para debug
      }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          resolve('');
        } else if (!response || response.error) {
          resolve('');
        } else if (!response.image) {
          resolve('');
        } else {
          // Mejor manejo de la conversión Base64
          let imageBase64 = response.image;
          if (imageBase64.startsWith('data:image/png;base64,')) {
            imageBase64 = imageBase64.replace('data:image/png;base64,', '');
          } else if (imageBase64.startsWith('data:image/jpeg;base64,')) {
            imageBase64 = imageBase64.replace('data:image/jpeg;base64,', '');
          }
          // Validar que la imagen Base64 sea válida
          if (imageBase64 && imageBase64.length > 100) {
            resolve(imageBase64);
          } else {
            resolve('');
          }
        }
      });
    });

    // Obtener token único del usuario
    const userToken = await getUserToken();

    updateWidgetState('procesando', 'Enviando a IA...');

    // Preparar payload para N8N con validación
    const payload = {
      UserText: userText.trim(),
      imageBase64: base64Image || '', // Asegurar que no sea undefined
      emotion: "calmado",
      ApiKey: userToken
    };
    
    // Enviar al flujo N8N a través del background script (evita problemas CORS)
    updateWidgetState('procesando', 'Enviando a IA...');
    
    // Mostrar progreso dinámico basado en calidad de conexión
    const dynamicTimeout = getDynamicTimeout();
    const progressInterval = Math.max(3000, dynamicTimeout / 8); // Mostrar progreso cada 1/8 del timeout
    
    const progressTimeout = setTimeout(() => {
      if (isRequestActive) {
        const qualityMessage = connectionQuality === 'slow' ? ' (conexión lenta)' : '';
        updateWidgetState('procesando', `IA procesando...${qualityMessage}`);
      }
    }, progressInterval);
    
    // Medir tiempo de inicio para estadísticas
    const startTime = Date.now();
    
    try {
      // Usar background script para evitar CORS y mantener streaming
      const result = await sendToBackgroundWithStreaming(payload, startTime);
      
      clearTimeout(progressTimeout);
      
      if (!result.success) {
        throw new Error(result.error || 'Error desconocido del background script');
      }
      
    } catch (error) {
      clearTimeout(progressTimeout);
      
      // Manejo específico de errores
      let errorMessage = 'Error de procesamiento';
      if (error.message && error.message.includes('Timeout después de')) {
        errorMessage = 'IA muy lenta - Reintentar';
      } else if (error.message && error.message.includes('Failed to fetch')) {
        errorMessage = 'Sin conexión';
      } else if (error.message && error.message.includes('HTTP')) {
        errorMessage = 'Error del servidor';
      } else if (error.name === 'TypeError') {
        errorMessage = 'Error de red';
      }
      
      updateWidgetState('activo', errorMessage);
      throw error; // Re-throw para que el caller maneje el finally
    }
    
  } catch (error) {
    updateWidgetState('activo', 'Error de conexión');
  } finally {
    isRequestActive = false; // Siempre liberar el flag
    isRequestInProgress = false; // Siempre limpiar petición en progreso
    // console.log('Limpieza final - petición terminada');
  }
}

// Variable para acumular chunks de audio durante el streaming
let accumulatedAudioChunks = [];
let audioStreamingQueue = []; // Cola para chunks en streaming
let currentAudioPlayer = null; // Reproductor actual
let isStreamingAudio = false; // Flag para streaming en tiempo real
let streamingCompletelyFinished = false; // Flag para saber si el streaming Y todos los chunks terminaron
let allAudioPlayers = new Set(); // Seguimiento de todos los reproductores activos

// Función para detener TODOS los audios activos
function stopAllAudioPlayback() {
  // Detener el reproductor principal si existe
  const mainPlayer = document.getElementById('assistant-audio-player');
  if (mainPlayer && !mainPlayer.paused) {
    mainPlayer.pause();
    mainPlayer.currentTime = 0;
    if (mainPlayer.src) {
      URL.revokeObjectURL(mainPlayer.src);
      mainPlayer.src = '';
    }
  }
  
  // Detener todos los reproductores temporales
  allAudioPlayers.forEach(player => {
    if (player && !player.paused) {
      player.pause();
      player.currentTime = 0;
      if (player.src) {
        URL.revokeObjectURL(player.src);
        player.src = '';
      }
    }
  });
  
  // Limpiar el set de reproductores
  allAudioPlayers.clear();
  
  // Resetear variables de estado
  currentAudioPlayer = null;
  isAudioPlaying = false;
  audioStreamingQueue = [];
  isStreamingAudio = false;
}

// Función para enviar al background script con soporte de streaming
async function sendToBackgroundWithStreaming(payload, startTime) {
  return new Promise((resolve, reject) => {
    let streamingStarted = false;
    
    // Reiniciar acumulador de audio para nueva petición
    accumulatedAudioChunks = [];
    audioStreamingQueue = [];
    isStreamingAudio = true;
    streamingCompletelyFinished = false;
    
    // Marcar que hay una petición completa en progreso
    isRequestInProgress = true;
    // console.log('Iniciando petición completa N8N -> ElevenLabs con streaming en tiempo real');
    
    // Configurar listener para mensajes de streaming del background
    const streamingListener = (message, sender, sendResponse) => {
      if (message.type === 'streaming_progress') {
        updateWidgetState('procesando', message.message || 'Procesando...');
      } else if (message.type === 'audio_chunk') {
        // REPRODUCIR chunks inmediatamente para streaming en tiempo real
        if (message.chunk && message.chunk.length > 0) {
          // console.log('Chunk de audio recibido para streaming inmediato, tamaño:', message.chunk.length);
          
          // También acumular para backup (por si falla el streaming)
          accumulatedAudioChunks.push(...message.chunk);
          
          // Agregar a cola de streaming y procesar inmediatamente
          audioStreamingQueue.push(new Uint8Array(message.chunk));
          processAudioStreamingQueue();
          
          updateWidgetState('hablando', `Hablando... (${Math.floor(accumulatedAudioChunks.length / 1024)}KB recibidos)`);
        }
      } else if (message.type === 'streaming_complete') {
        // Remover listener
        chrome.runtime.onMessage.removeListener(streamingListener);
        
        // console.log('WebSocket ElevenLabs terminó completamente');
        // console.log('Total de chunks acumulados:', accumulatedAudioChunks.length, 'bytes');
        
        // Medir tiempo total
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        updateConnectionQuality(totalTime);
        
        // Marcar que el streaming terminó
        isStreamingAudio = false;
        
        // Si por alguna razón no se reprodujo nada en streaming, usar el método de backup
        if (!currentAudioPlayer && accumulatedAudioChunks.length > 0) {
          // console.log('Fallback: No hubo streaming, reproduciendo audio acumulado');
          const audioArray = new Uint8Array(accumulatedAudioChunks);
          playAudioFromArrayBuffer(audioArray.buffer, true);
          
          // Limpiar acumulador después de usar
          accumulatedAudioChunks = [];
        } else {
          // El streaming funcionó, solo esperar a que termine y reiniciar reconocimiento
          // console.log('Streaming completado exitosamente');
          
          // No intentar reiniciar aquí, dejar que processAudioStreamingQueue lo maneje
          // console.log('Dejando que la cola de streaming maneje el reinicio del reconocimiento');
        }
        
        resolve({ success: true });
      } else if (message.type === 'streaming_error') {
        // Remover listener
        chrome.runtime.onMessage.removeListener(streamingListener);
        
        // Limpiar acumulador en caso de error
        accumulatedAudioChunks = [];
        
        // Marcar petición completa terminada
        isRequestInProgress = false;
        
        reject(new Error(message.error));
      }
    };
    
    // Agregar listener para streaming
    chrome.runtime.onMessage.addListener(streamingListener);
    
    // Enviar petición al background script
    chrome.runtime.sendMessage({
      action: 'sendToN8N',
      payload: payload
    }, (response) => {
      if (chrome.runtime.lastError) {
        chrome.runtime.onMessage.removeListener(streamingListener);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (!response) {
        chrome.runtime.onMessage.removeListener(streamingListener);
        reject(new Error('No hay respuesta del background script'));
        return;
      }
      
      if (!response.success) {
        chrome.runtime.onMessage.removeListener(streamingListener);
        reject(new Error(response.error || 'Error desconocido'));
        return;
      }
      
      // Solo manejamos streaming start (WebSocket flow)
      if (response.type === 'streaming_start') {
        streamingStarted = true;
        return;
      }
    });
    
    // Timeout de seguridad
    setTimeout(() => {
      if (!streamingStarted) {
        chrome.runtime.onMessage.removeListener(streamingListener);
        reject(new Error('Timeout esperando respuesta del background script'));
      }
    }, getDynamicTimeout());
  });
}

// Función para procesar la cola de streaming de audio en tiempo real
async function processAudioStreamingQueue() {
  // Solo procesar si hay chunks en cola y no hay audio reproduciéndose actualmente
  if (audioStreamingQueue.length === 0 || (currentAudioPlayer && !currentAudioPlayer.ended && !currentAudioPlayer.paused)) {
    return;
  }
  
  // Tomar el primer chunk de la cola
  const audioChunk = audioStreamingQueue.shift();
  
  // console.log('Procesando chunk de streaming, tamaño:', audioChunk.length, 'bytes');
  
  try {
    // Crear un reproductor temporal para este chunk
    await playAudioChunkStreaming(audioChunk.buffer);
    
    // Después de que termine este chunk, procesar el siguiente si hay más
    setTimeout(() => {
      if (audioStreamingQueue.length > 0) {
        // console.log('Continuando procesamiento de cola, chunks restantes:', audioStreamingQueue.length);
        processAudioStreamingQueue();
      } else {
        // console.log('Cola de streaming completamente procesada');
      }
    }, 50); // Pequeña pausa entre chunks
    
  } catch (error) {
    // console.error('Error reproduciendo chunk de streaming:', error);
    
    // En caso de error, continuar con el siguiente chunk si hay más
    setTimeout(() => {
      if (audioStreamingQueue.length > 0) {
        // console.log('Continuando tras error, chunks restantes:', audioStreamingQueue.length);
        processAudioStreamingQueue();
      } else {
        // console.log('Cola terminada tras error');
      }
    }, 100);
  }
}

// Función especializada para reproducir chunks de audio en streaming
async function playAudioChunkStreaming(arrayBuffer) {
  return new Promise((resolve, reject) => {
    try {
      // DETENER CUALQUIER AUDIO ANTERIOR ANTES DE EMPEZAR UNO NUEVO
      if (currentAudioPlayer && !currentAudioPlayer.ended) {
        currentAudioPlayer.pause();
        if (currentAudioPlayer.src) {
          URL.revokeObjectURL(currentAudioPlayer.src);
          currentAudioPlayer.src = '';
        }
      }
      
      // console.log('Reproduciendo chunk streaming, tamaño:', arrayBuffer.byteLength);
      
      // Detectar formato de audio
      const uint8Array = new Uint8Array(arrayBuffer);
      const mimeType = detectAudioFormat(uint8Array);
      
      // Crear blob y URL para este chunk
      const audioBlob = new Blob([arrayBuffer], { type: mimeType });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Crear elemento de audio temporal para este chunk
      const chunkPlayer = new Audio();
      chunkPlayer.src = audioUrl;
      chunkPlayer.volume = 1.0;
      chunkPlayer.preload = 'auto';
      
      // Registrar en el set de reproductores activos
      allAudioPlayers.add(chunkPlayer);
      
      // Marcar como reproductor actual
      currentAudioPlayer = chunkPlayer;
      isAudioPlaying = true;
      
      chunkPlayer.onloadeddata = () => {
        // console.log('Chunk cargado, iniciando reproducción');
        chunkPlayer.play()
          .then(() => {
            // console.log('Chunk reproduciéndose');
          })
          .catch(error => {
            // console.error('Error iniciando chunk:', error);
            reject(error);
          });
      };
      
      chunkPlayer.onended = () => {
        // console.log('Chunk terminado');
        URL.revokeObjectURL(audioUrl);
        
        // Remover del set de reproductores activos
        allAudioPlayers.delete(chunkPlayer);
        
        // Solo marcar como no reproduciéndose si este es el reproductor actual
        if (currentAudioPlayer === chunkPlayer) {
          isAudioPlaying = false;
          currentAudioPlayer = null;
          // console.log('Reproductor actual terminado, marcado como no reproduciéndose');
          
          // Debug: mostrar estado actual
          // console.log('Estado al terminar chunk:', {
          //   audioStreamingQueue: audioStreamingQueue.length,
          //   isStreamingAudio: isStreamingAudio,
          //   assistantActive: assistantActive,
          //   isRequestInProgress: isRequestInProgress,
          //   currentAudioPlayer: !!currentAudioPlayer,
          //   chunkPlayer: chunkPlayer === currentAudioPlayer
          // });
          
          // Verificar si ya no hay más chunks en cola (independiente del estado de streaming)
          if (audioStreamingQueue.length === 0) {
            // console.log('ÚLTIMO CHUNK TERMINADO - cola vacía, streaming completamente finalizado');
            streamingCompletelyFinished = true;
            
            // Intentar reiniciar reconocimiento ahora que todo terminó
            setTimeout(() => {
              if (assistantActive && !isRequestInProgress) {
                // console.log('Streaming completamente terminado - reiniciando reconocimiento');
                isRequestInProgress = false;
                safeRestartRecognition('después de que último chunk terminó completamente');
              } else {
                // console.log('No se pudo reiniciar reconocimiento:', {
                //   assistantActive: assistantActive,
                //   isRequestInProgress: isRequestInProgress
                // });
              }
            }, 50);
          } else {
            // console.log('No es el último chunk, quedan en cola:', {
            //   queueLength: audioStreamingQueue.length,
            //   streaming: isStreamingAudio,
            //   queueContents: audioStreamingQueue.map(chunk => chunk.length)
            // });
          }
        }
        
        resolve();
      };
      
      chunkPlayer.onerror = (error) => {
        // console.error('Error en chunk:', error);
        URL.revokeObjectURL(audioUrl);
        
        // Remover del set de reproductores activos
        allAudioPlayers.delete(chunkPlayer);
        
        if (currentAudioPlayer === chunkPlayer) {
          isAudioPlaying = false;
          currentAudioPlayer = null;
        }
        
        reject(error);
      };
      
      // Timeout de seguridad
      setTimeout(() => {
        if (chunkPlayer.readyState === 0) {
          // console.log('Timeout cargando chunk, continuando...');
          chunkPlayer.src = '';
          URL.revokeObjectURL(audioUrl);
          
          if (currentAudioPlayer === chunkPlayer) {
            isAudioPlaying = false;
            currentAudioPlayer = null;
          }
          
          resolve(); // No rechazar, solo continuar
        }
      }, 2000);
      
    } catch (error) {
      // console.error('Error creando chunk player:', error);
      reject(error);
    }
  });
}

// Reproducir audio con detección automática de formato
async function playAudioFromArrayBuffer(arrayBuffer, restartRecognition = false) {
  try {
    // DETENER TODOS LOS AUDIOS PREVIOS ANTES DE EMPEZAR UNO NUEVO
    stopAllAudioPlayback();
    
    // console.log('=== INICIANDO REPRODUCCIÓN DE AUDIO ===');
    // console.log('Tamaño del arrayBuffer:', arrayBuffer.byteLength, 'bytes');
    // console.log('Reiniciar reconocimiento después:', restartRecognition);
    // console.log('Estado actual - isAudioPlaying:', isAudioPlaying, 'assistantActive:', assistantActive);
    
    if (arrayBuffer.byteLength === 0) {
      // console.log('ArrayBuffer vacío, cancelando reproducción');
      return;
    }
    
    // Detectar formato de audio por las primeras bytes (magic numbers)
    const uint8Array = new Uint8Array(arrayBuffer);
    let mimeType = detectAudioFormat(uint8Array);
    
    // console.log('Formato detectado:', mimeType, 'para', arrayBuffer.byteLength, 'bytes');
    
    // Crear blob con el formato detectado
    const audioBlob = new Blob([arrayBuffer], { type: mimeType });

    let audioPlayer = document.getElementById('assistant-audio-player');
    if (!audioPlayer) {
      audioPlayer = document.createElement('audio');
      audioPlayer.id = 'assistant-audio-player';
      audioPlayer.style.display = 'none';
      // Configurar para máxima compatibilidad y volumen
      audioPlayer.preload = 'auto';
      audioPlayer.volume = 1.0; // Volumen máximo
      audioPlayer.muted = false; // Asegurar que no esté mudo
      audioPlayer.controls = false;
      
      // Atributos adicionales para mejor compatibilidad
      audioPlayer.setAttribute('playsinline', 'true');
      audioPlayer.setAttribute('webkit-playsinline', 'true');
      audioPlayer.setAttribute('autoplay', 'true');
      
      document.body.appendChild(audioPlayer);
      // console.log('Nuevo elemento audio creado con volumen máximo');
    } else {
      // console.log('Reutilizando elemento audio existente');
      
      // Asegurar configuración de volumen en elemento existente
      audioPlayer.volume = 1.0;
      audioPlayer.muted = false;
      // console.log('Volumen restablecido a máximo en elemento existente');
    }

    // Detener cualquier reproducción anterior y limpiar
    if (!audioPlayer.paused) {
      audioPlayer.pause();
      // console.log('Audio anterior pausado');
    }

    // Limpiar audio anterior
    if (audioPlayer.src) {
      URL.revokeObjectURL(audioPlayer.src);
      // console.log('URL anterior liberada');
    }

    // Configurar nuevo audio con verificaciones adicionales
    audioPlayer.volume = 1.0;        // Volumen máximo del elemento
    audioPlayer.preload = 'auto';
    audioPlayer.autoplay = true;
    audioPlayer.muted = false;        // Asegurar que no esté mudo
    audioPlayer.controls = false;
    audioPlayer.loop = false;
    
    // VERIFICACIONES ADICIONALES DE VOLUMEN
    // console.log('=== VERIFICACIÓN DE CONFIGURACIÓN DE AUDIO ===');
    // console.log('Volume configurado:', audioPlayer.volume);
    // console.log('Muted configurado:', audioPlayer.muted);
    // console.log('Autoplay configurado:', audioPlayer.autoplay);
    // console.log('Preload configurado:', audioPlayer.preload);
    
    // Verificar si hay otros elementos de audio que puedan interferir
    const allAudioElements = document.querySelectorAll('audio, video');
    // console.log('Total elementos audio/video en página:', allAudioElements.length);
    
    allAudioElements.forEach((element, index) => {
      if (element !== audioPlayer && !element.paused) {
        // console.log(`Pausando elemento audio/video ${index} que estaba reproduciéndose`);
        element.pause();
        element.volume = 0.1; // Reducir volumen de otros elementos
      }
    });

    const audioUrl = URL.createObjectURL(audioBlob);
    audioPlayer.src = audioUrl;
    isAudioPlaying = true;
    
    // IMPORTANTE: Detener reconocimiento temporalmente para evitar conflictos
    let wasRecognitionActive = false;
    if (recognitionActive && recognition) {
      wasRecognitionActive = true;
      // console.log('Pausando reconocimiento temporalmente para reproducir audio');
      try {
        recognition.stop();
        recognitionActive = false; // Marcar inmediatamente como inactivo
        
        // Esperar un momento para que se libere el micrófono
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        // console.log('Error pausando reconocimiento:', e);
      }
    }
    
    updateWidgetState('hablando', 'Hablando...');

    // Pre-cargar el audio antes de reproducir
    await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout cargando audio'));
      }, 10000); // 10 segundos timeout
      
      audioPlayer.oncanplaythrough = () => {
        clearTimeout(timeoutId);
        resolve();
      };
      
      audioPlayer.onerror = (e) => {
        clearTimeout(timeoutId);
        // console.error('Error cargando audio:', e, audioPlayer.error);
        reject(new Error(`Error de audio: ${audioPlayer.error?.message || 'Desconocido'}`));
      };
      
      audioPlayer.load(); // Forzar carga
    });

    audioPlayer.onended = () => {
      // console.log('=== EVENTO ONENDED DISPARADO ===');
      // console.log('Tiempo de finalización:', new Date().toLocaleTimeString());
      
      const finalState = {
        paused: audioPlayer.paused,
        ended: audioPlayer.ended,
        currentTime: audioPlayer.currentTime,
        duration: audioPlayer.duration,
        percentCompleted: audioPlayer.duration > 0 ? (audioPlayer.currentTime / audioPlayer.duration * 100).toFixed(1) + '%' : 'sin duración',
        readyState: audioPlayer.readyState,
        networkState: audioPlayer.networkState,
        buffered: audioPlayer.buffered.length > 0 ? `${audioPlayer.buffered.start(0).toFixed(2)}-${audioPlayer.buffered.end(0).toFixed(2)}s` : 'sin buffer',
        actualPlayTime: audioPlayer.currentTime.toFixed(3) + 's'
      };
      // console.log('Estado final del audio:', finalState);
      
      // ANÁLISIS DETALLADO DE LA FINALIZACIÓN
      const actualDuration = audioPlayer.currentTime;
      const reportedDuration = audioPlayer.duration;
      
      // console.log('=== ANÁLISIS DE DURACIÓN ===');
      // console.log('Duración reportada:', reportedDuration.toFixed(3), 'segundos');
      // console.log('Tiempo real reproducido:', actualDuration.toFixed(3), 'segundos');
      // console.log('Diferencia:', Math.abs(reportedDuration - actualDuration).toFixed(3), 'segundos');
      
      if (actualDuration < 0.2) {
        // console.log('PROBLEMA CRÍTICO: Audio duró menos de 0.2 segundos');
        // console.log('Esto indica contenido de audio inválido o corrupto');
      } else if (actualDuration < 1.0) {
        // console.log('ADVERTENCIA: Audio muy corto (< 1 segundo)');
        // console.log('La respuesta de IA puede ser muy breve o estar truncada');
      } else {
        // console.log('Duración de audio normal:', actualDuration.toFixed(2), 'segundos');
      }
      
      // Verificar si se completó razonablemente
      const completionPercentage = audioPlayer.duration > 0 ? (audioPlayer.currentTime / audioPlayer.duration * 100) : 0;
      if (completionPercentage < 50 && audioPlayer.duration > 0) {
        // console.log(`ADVERTENCIA: Audio terminó muy prematuro al ${completionPercentage.toFixed(1)}%`);
      } else {
        // console.log(`Audio completado satisfactoriamente al ${completionPercentage.toFixed(1)}%`);
      }
      
      // console.log('Audio terminó naturalmente');
      URL.revokeObjectURL(audioUrl);
      isAudioPlaying = false;
      updateWidgetState('activo', 'Escuchando...');
      
      // Solo reiniciar reconocimiento si se especifica explícitamente (cuando streaming_complete termina)
      if (restartRecognition && assistantActive) {
        // Marcar petición completa terminada
        isRequestInProgress = false;
        // console.log('Petición completa terminada exitosamente');
        
        // console.log('WebSocket completo - reiniciando reconocimiento de voz');
        setTimeout(() => {
          safeRestartRecognition('después de completar todo el streaming de WebSocket');
        }, 100);
      } else {
        // console.log('Audio chunk terminado - NO reiniciando reconocimiento aún');
      }
    };

    audioPlayer.onerror = (e) => {
      // console.error('Error durante reproducción:', e, audioPlayer.error);
      URL.revokeObjectURL(audioUrl);
      isAudioPlaying = false;
      updateWidgetState('activo', 'Error de audio: ' + (audioPlayer.error?.message || 'formato'));
      
      // En caso de error, también respetar la bandera restartRecognition
      if (restartRecognition && assistantActive) {
        // Marcar petición completa terminada
        isRequestInProgress = false;
        // console.log('Petición completa terminada con error de audio');
        
        setTimeout(() => {
          safeRestartRecognition('después de error de audio en WebSocket completo');
        }, 100);
      }
    };

    audioPlayer.onpause = (e) => {
      // console.log('=== AUDIO PAUSADO ===');
      // console.log('Tiempo de pausa:', new Date().toLocaleTimeString());
      // console.log('Tiempo reproducido antes de pausa:', audioPlayer.currentTime.toFixed(3), 'segundos');
      
      const audioState = {
        paused: audioPlayer.paused,
        ended: audioPlayer.ended,
        currentTime: audioPlayer.currentTime,
        duration: audioPlayer.duration,
        readyState: audioPlayer.readyState,
        networkState: audioPlayer.networkState,
        buffered: audioPlayer.buffered.length > 0 ? `${audioPlayer.buffered.start(0)}-${audioPlayer.buffered.end(0)}` : 'ninguno',
        error: audioPlayer.error ? audioPlayer.error.code + ': ' + audioPlayer.error.message : 'ninguno'
      };
      // console.log('Estado del audio al pausar:', audioState);
      
      // ANÁLISIS DETALLADO DE LA PAUSA
      const playbackTime = audioPlayer.currentTime;
      const totalDuration = audioPlayer.duration;
      
      if (playbackTime < 0.1) {
        // console.log('PROBLEMA: Audio se pausó INMEDIATAMENTE (< 0.1s)');
      } else if (playbackTime < 0.5) {
        // console.log('ADVERTENCIA: Audio se pausó muy rápido (< 0.5s)');
      } else if (playbackTime < totalDuration * 0.9) {
        // console.log('Audio se pausó antes de completarse:', 
        //   `${((playbackTime / totalDuration) * 100).toFixed(1)}% completado`);
      }
      
      // Solo intentar reanudar si NO ha terminado y hay duración válida
      if (!audioPlayer.ended && audioPlayer.duration > 0 && audioPlayer.currentTime < audioPlayer.duration - 0.1) {
        // console.log('Pausa inesperada detectada, intentando reanudar...');
        
        // Un solo intento de reanudación simple
        setTimeout(() => {
          if (!audioPlayer.ended && audioPlayer.paused) {
            // console.log('Ejecutando intento de reanudación...');
            audioPlayer.play()
              .then(() => {
                // console.log('Audio reanudado exitosamente');
              })
              .catch(error => {
                // console.log('No se pudo reanudar, dejando que termine naturalmente:', error.message);
              });
          }
        }, 100);
      } else {
        // console.log('Pausa natural o audio completado, no se requiere reanudación');
        // console.log('Detalles de la pausa:', {
        //   ended: audioPlayer.ended,
        //   duration: audioPlayer.duration,
        //   currentTime: audioPlayer.currentTime,
        //   almostCompleted: audioPlayer.duration > 0 ? audioPlayer.currentTime >= audioPlayer.duration - 0.1 : false,
        //   readyState: audioPlayer.readyState,
        //   networkState: audioPlayer.networkState
        // });
      }
    };

    audioPlayer.onloadedmetadata = () => {
      // console.log('=== METADATOS DEL AUDIO CARGADOS ===');
      // console.log('Duración:', audioPlayer.duration, 'segundos');
      // console.log('¿Duración válida?', isFinite(audioPlayer.duration) && audioPlayer.duration > 0);
      // console.log('Volume:', audioPlayer.volume);
      // console.log('Muted:', audioPlayer.muted);
      // console.log('Ready State:', audioPlayer.readyState);
      
      // ANÁLISIS DE DURACIÓN
      if (audioPlayer.duration < 0.5) {
        // console.log('ADVERTENCIA: Audio muy corto (< 0.5s) - posible problema de contenido');
      } else if (audioPlayer.duration < 1.0) {
        // console.log('Audio corto (< 1s) - respuesta muy breve');
      } else {
        // console.log('Duración de audio normal:', audioPlayer.duration.toFixed(2), 'segundos');
      }
      
      // FORZAR VOLUMEN ALTO para asegurar que se escuche
      audioPlayer.volume = 1.0;
      audioPlayer.muted = false;
      // console.log('Volumen forzado a máximo y unmuted');
    };

    audioPlayer.oncanplaythrough = () => {
      // console.log('Audio completamente cargado y listo para reproducir sin interrupciones');
      
      // TEST: Verificar si el audio tiene volumen audible
      // console.log('=== TEST DE VOLUMEN ===');
      // console.log('Volume actual:', audioPlayer.volume);
      // console.log('Muted actual:', audioPlayer.muted);
      // console.log('Source válida:', !!audioPlayer.src);
      // console.log('Ready State:', audioPlayer.readyState);
      
      // REMOVIDO: test de tono que causaba el "bip"
    };

    audioPlayer.onplay = () => {
      // console.log('=== AUDIO INICIADO ===');
      // console.log('Tiempo de inicio:', new Date().toLocaleTimeString());
      // console.log('Estado al iniciar:', {
      //   paused: audioPlayer.paused,
      //   ended: audioPlayer.ended,
      //   currentTime: audioPlayer.currentTime,
      //   duration: audioPlayer.duration,
      //   volume: audioPlayer.volume,
      //   muted: audioPlayer.muted,
      //   readyState: audioPlayer.readyState,
      //   networkState: audioPlayer.networkState
      // });
      
      // TRACKING EN TIEMPO REAL - verificar cada 100ms
      const trackingInterval = setInterval(() => {
        if (audioPlayer.ended || audioPlayer.paused) {
          clearInterval(trackingInterval);
          // console.log('Tracking terminado. Estado final:', {
          //   ended: audioPlayer.ended,
          //   paused: audioPlayer.paused,
          //   currentTime: audioPlayer.currentTime,
          //   duration: audioPlayer.duration
          // });
          return;
        }
        
        // console.log('Reproduciendo...', 
        //   `${audioPlayer.currentTime.toFixed(2)}s / ${audioPlayer.duration.toFixed(2)}s`,
        //   `(${((audioPlayer.currentTime / audioPlayer.duration) * 100).toFixed(1)}%)`
        // );
      }, 100); // Cada 100ms
      
      // Limpiar tracking después de un tiempo máximo
      setTimeout(() => {
        clearInterval(trackingInterval);
      }, 10000); // Máximo 10 segundos de tracking
    };

    audioPlayer.oncanplay = () => {
      // console.log('Audio listo para reproducir');
    };

    audioPlayer.onloadstart = () => {
      // console.log('Iniciando carga de audio');
    };

    // Reproducir con manejo de errores
    try {
      // console.log('Iniciando reproducción...');
      
      // Verificar si el contexto de audio está permitido
      if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        try {
          const AudioCtx = AudioContext || webkitAudioContext;
          const audioContext = new AudioCtx();
          // console.log('Estado del AudioContext:', audioContext.state);
          
          if (audioContext.state === 'suspended') {
            // console.log('AudioContext suspendido, intentando reanudar...');
            await audioContext.resume();
            // console.log('AudioContext reanudado. Nuevo estado:', audioContext.state);
          }
          audioContext.close(); // Liberar recursos
        } catch (contextError) {
          // console.log('Error con AudioContext (puede ser normal):', contextError.message);
        }
      }
      
      // Verificar configuración del sistema de audio del navegador
      // console.log('=== VERIFICACIÓN DEL SISTEMA DE AUDIO ===');
      // console.log('Navigator userAgent:', navigator.userAgent.slice(0, 100));
      // console.log('Audio constructor disponible:', typeof Audio !== 'undefined');
      // console.log('HTML5 Audio support:', !!document.createElement('audio').canPlayType);
      
      // Verificar formatos soportados
      const audio = document.createElement('audio');
      // console.log('Soporte MP3:', audio.canPlayType('audio/mpeg'));
      // console.log('Soporte WAV:', audio.canPlayType('audio/wav'));
      // console.log('Soporte OGG:', audio.canPlayType('audio/ogg'));
      
      // Asegurar que el audio no será interrumpido
      audioPlayer.setAttribute('playsinline', 'true');
      audioPlayer.setAttribute('webkit-playsinline', 'true');
      
      const playPromise = audioPlayer.play();
      await playPromise;
      // console.log('Audio reproduciendo correctamente');
      
      // Verificar inmediatamente si se pausó (solo una vez)
      setTimeout(() => {
        if (audioPlayer.paused && !audioPlayer.ended && audioPlayer.duration > 0) {
          // console.log('Audio se pausó inmediatamente, forzando reanudación...');
          audioPlayer.play().catch(e => {/* console.log('Error forzando play:', e) */});
        }
      }, 50);
      
    } catch (playError) {
      // console.error('Error al reproducir audio:', playError);
      // console.log('Detalles del error:', {
      //   name: playError.name,
      //   message: playError.message,
      //   code: playError.code
      // });
      
      // Verificar si es un problema de autoplay policy
      if (playError.name === 'NotAllowedError') {
        // console.log('Error de política de autoplay - requiere interacción del usuario');
        updateWidgetState('hablando', 'Clic para escuchar respuesta');
        
        // Crear botón temporal para que el usuario haga clic
        showManualPlayButton(audioPlayer, audioUrl, restartRecognition);
        return; // No intentar formato alternativo en este caso
      }
      
      // Intentar con formato alternativo si no es problema de autoplay
      if (mimeType !== 'audio/mpeg') {
        // console.log('Reintentando con audio/mpeg...');
        const altBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        const altUrl = URL.createObjectURL(altBlob);
        audioPlayer.src = altUrl;
        await audioPlayer.play();
      } else {
        throw playError;
      }
    }
    
  } catch (error) {
    // console.error('Error reproduciendo audio:', error);
    isAudioPlaying = false;
    updateWidgetState('activo', 'Error formato audio');
    
    // Mostrar información de debug
    // console.log('ArrayBuffer info:', {
    //   byteLength: arrayBuffer.byteLength,
    //   firstBytes: Array.from(new Uint8Array(arrayBuffer.slice(0, 16))).map(b => b.toString(16).padStart(2, '0')).join(' ')
    // });
  }
}

// Función auxiliar para mostrar botón de reproducción manual
function showManualPlayButton(audioPlayer, audioUrl, restartRecognition) {
  const playButton = document.createElement('button');
  playButton.textContent = 'Reproducir respuesta';
  playButton.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 999999;
    padding: 10px 20px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  `;
  
  playButton.onclick = () => {
    audioPlayer.play()
      .then(() => {
        // console.log('Audio iniciado por interacción del usuario');
        document.body.removeChild(playButton);
        updateWidgetState('hablando', 'Hablando...');
      })
      .catch(e => {
        // console.error('Error aún con interacción:', e);
        document.body.removeChild(playButton);
        updateWidgetState('activo', 'Error de audio');
        
        // En caso de error, manejar restart recognition
        if (restartRecognition && assistantActive) {
          isRequestInProgress = false;
          setTimeout(() => {
            safeRestartRecognition('después de error de audio manual');
          }, 500);
        }
      });
  };
  
  document.body.appendChild(playButton);
  
  // Remover automáticamente después de 10 segundos
  setTimeout(() => {
    if (document.body.contains(playButton)) {
      document.body.removeChild(playButton);
      updateWidgetState('activo', 'Tiempo agotado');
      
      // Si el botón expira, manejar restart recognition
      if (restartRecognition && assistantActive) {
        isRequestInProgress = false;
        setTimeout(() => {
          safeRestartRecognition('después de timeout de botón manual');
        }, 100);
      }
    }
  }, 10000);
}

// Función para detectar formato de audio por magic numbers
function detectAudioFormat(uint8Array) {
  if (uint8Array.length < 12) {
    // console.log('Array muy pequeño, usando audio/mpeg por defecto');
    return 'audio/mpeg';
  }
  
  // Convertir primeros bytes a hex para debugging
  const header = Array.from(uint8Array.slice(0, 12))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // console.log('Audio header (hex):', header);
  // console.log('Primeros 4 bytes:', uint8Array.slice(0, 4));
  
  // MP3 - Frame sync (0xFF seguido de bits específicos) o ID3 tag
  if ((uint8Array[0] === 0xFF && (uint8Array[1] & 0xE0) === 0xE0) || 
      (uint8Array[0] === 0x49 && uint8Array[1] === 0x44 && uint8Array[2] === 0x33)) { // "ID3"
    // console.log('Formato detectado: MP3');
    return 'audio/mpeg';
  }
  
  // WAV - "RIFF" + "WAVE"
  if (uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && 
      uint8Array[2] === 0x46 && uint8Array[3] === 0x46) {
    // console.log('Formato detectado: WAV');
    return 'audio/wav';
  }
  
  // OGG - "OggS"
  if (uint8Array[0] === 0x4F && uint8Array[1] === 0x67 && 
      uint8Array[2] === 0x67 && uint8Array[3] === 0x53) {
    // console.log('Formato detectado: OGG');
    return 'audio/ogg';
  }
  
  // WebM - EBML header
  if (uint8Array[0] === 0x1A && uint8Array[1] === 0x45 && 
      uint8Array[2] === 0xDF && uint8Array[3] === 0xA3) {
    // console.log('Formato detectado: WebM');
    return 'audio/webm';
  }
  
  // M4A/AAC - "ftyp" en posición 4-7
  if (uint8Array.length > 8 &&
      uint8Array[4] === 0x66 && uint8Array[5] === 0x74 && 
      uint8Array[6] === 0x79 && uint8Array[7] === 0x70) {
    // console.log('Formato detectado: MP4/M4A');
    return 'audio/mp4';
  }
  
  // FLAC - "fLaC"
  if (uint8Array[0] === 0x66 && uint8Array[1] === 0x4C && 
      uint8Array[2] === 0x61 && uint8Array[3] === 0x43) {
    // console.log('Formato detectado: FLAC');
    return 'audio/flac';
  }
  
  // console.log('Formato no reconocido, usando audio/mpeg por defecto');
  // console.log('Bytes no reconocidos:', Array.from(uint8Array.slice(0, 16)));
  return 'audio/mpeg'; // Default para ElevenLabs
}

// Verificar si el widget debe mostrarse en esta página
function shouldShowWidget() {
  // No mostrar en páginas de extensiones de Chrome
  if (window.location.href.startsWith('chrome-extension://')) {
    return false;
  }
  
  // No mostrar en páginas de configuración de Chrome
  if (window.location.href.startsWith('chrome://')) {
    return false;
  }

  return true;
}

// Inicializar el widget cuando la página esté lista
function initializeWidget() {
  if (!shouldShowWidget()) {
    return;
  }

  // Esperar un poco para asegurar que la página esté completamente cargada
  setTimeout(() => {
    createFloatingWidget();
    
    // Agregar listener para tecla Escape (detener audio)
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && assistantActive && isAudioPlaying) {
        // console.log('Tecla Escape presionada - deteniendo audio');
        forceStopAudio();
        
        // Opcional: mostrar mensaje temporal
        updateWidgetState('inactivo', 'Audio detenido (Esc)');
        setTimeout(() => {
          if (assistantActive) {
            updateWidgetState('activo', 'Escuchando...');
          }
        }, 1000);
      }
    });
    
  }, 1000);
}

// Ejecutar cuando el contenido esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeWidget);
} else {
  initializeWidget();
}

// Limpiar cuando la página se descarga
window.addEventListener('beforeunload', () => {
  if (assistantActive) {
    deactivateAssistant();
  }
});

// Escuchar mensajes del popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleAssistant') {
    toggleAssistant();
    sendResponse({success: true});
  } else if (request.action === 'getStatus') {
    let state = 'inactive';
    let statusText = 'Inactivo';
    
    if (assistantActive) {
      if (isProcessing) {
        state = 'processing';
        statusText = 'Procesando...';
      } else if (isAudioPlaying) {
        state = 'speaking';
        statusText = 'Hablando...';
      } else {
        state = 'active';
        statusText = 'Escuchando...';
      }
    }
    
    sendResponse({
      active: assistantActive,
      state: state,
      statusText: statusText
    });
  }
  
  return true; 
});

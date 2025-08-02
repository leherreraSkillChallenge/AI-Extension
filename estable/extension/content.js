// Content Script para el Asistente Web Flotante
// ================================================
// Este script se inyecta en todas las páginas web
// para mostrar el widget flotante del asistente

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
  if (assistantActive) {
    deactivateAssistant();
  }
  if (assistantWidget) {
    assistantWidget.remove();
    assistantWidget = null;
  }
}

// Toggle del asistente
function toggleAssistant() {
  if (assistantActive) {
    deactivateAssistant();
  } else {
    activateAssistant();
  }
}

// Activar asistente
function activateAssistant() {
  assistantActive = true;
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
  assistantActive = false;
  isProcessing = false;
  
  // Limpiar timeout de detección de pausa
  clearTimeout(window.speechTimeout);
  
  // Limpiar flags de solicitud activa
  isRequestActive = false;
  
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
    
    // Reiniciar inmediatamente si no hay procesamiento ni audio
    if (assistantActive && !isProcessing && !isAudioPlaying && !isRestarting) {
      setTimeout(() => {
        if (assistantActive && !recognitionActive && !isProcessing && !isAudioPlaying && !isRestarting) {
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
  // Verificar condiciones básicas
  if (!assistantActive || !recognition || recognitionActive || isProcessing || isAudioPlaying || isRestarting) {
    return;
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
          💡 Para usar el micrófono:<br>
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
  assistantActive = false;
  isProcessing = false;
  
  // Limpiar timeout de detección de pausa
  clearTimeout(window.speechTimeout);

  if (recognition) {
    try {
      recognition.stop();
      recognition = null;
      recognitionActive = false;
    } catch (error) {
      // Error silencioso
    }
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  const audioPlayer = document.getElementById('assistant-audio-player');
  if (audioPlayer) {
    audioPlayer.onended = null;
    audioPlayer.onerror = null;
    try {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
    } catch (e) {
      // Error silencioso
    }
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
  }
}

// Función para enviar al background script con soporte de streaming
async function sendToBackgroundWithStreaming(payload, startTime) {
  return new Promise((resolve, reject) => {
    let streamingStarted = false;
    
    // Configurar listener para mensajes de streaming del background
    const streamingListener = (message, sender, sendResponse) => {
      if (message.type === 'streaming_progress') {
        updateWidgetState('procesando', message.message || 'Procesando...');
      } else if (message.type === 'streaming_complete') {
        // Remover listener
        chrome.runtime.onMessage.removeListener(streamingListener);
        
        // Medir tiempo total
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        updateConnectionQuality(totalTime);
        
        // Reproducir audio recibido
        if (message.audio && message.audio.length > 0) {
          const audioArray = new Uint8Array(message.audio);
          playAudioFromArrayBuffer(audioArray.buffer, true);
        }
        
        resolve({ success: true });
      } else if (message.type === 'streaming_error') {
        // Remover listener
        chrome.runtime.onMessage.removeListener(streamingListener);
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
      
      // Si es streaming, ya configuramos el listener
      if (response.type === 'streaming_start') {
        streamingStarted = true;
        return;
      }
      
      // Si es respuesta directa (no streaming)
      if (response.type === 'complete') {
        chrome.runtime.onMessage.removeListener(streamingListener);
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        updateConnectionQuality(totalTime);
        
        if (response.audio && response.audio.length > 0) {
          const audioArray = new Uint8Array(response.audio);
          playAudioFromArrayBuffer(audioArray.buffer, true);
        }
        
        resolve({ success: true });
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

// Reproducir audio
async function playAudioFromArrayBuffer(arrayBuffer, restartRecognition = false) {
  try {
    const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });

    let audioPlayer = document.getElementById('assistant-audio-player');
    if (!audioPlayer) {
      audioPlayer = document.createElement('audio');
      audioPlayer.id = 'assistant-audio-player';
      audioPlayer.style.display = 'none';
      // Configurar para mejor reproducción
      audioPlayer.preload = 'auto';
      audioPlayer.volume = 0.9; // Volumen alto por defecto
      document.body.appendChild(audioPlayer);
    }

    // Asegurar volumen alto
    audioPlayer.volume = 0.9;
    audioPlayer.preload = 'auto';

    const audioUrl = URL.createObjectURL(audioBlob);
    audioPlayer.src = audioUrl;
    isAudioPlaying = true;
    
    updateWidgetState('hablando', 'Hablando...');

    // Pre-cargar el audio antes de reproducir
    await new Promise((resolve, reject) => {
      audioPlayer.oncanplaythrough = resolve;
      audioPlayer.onerror = reject;
      audioPlayer.load(); // Forzar carga
    });

    audioPlayer.onended = () => {
      URL.revokeObjectURL(audioUrl);
      isAudioPlaying = false;
      updateWidgetState('activo', 'Escuchando...');
      
      // Reinicio ultra-rápido después del audio
      if (assistantActive) {
        setTimeout(() => {
          safeRestartRecognition('después de terminar audio');
        }, 100); // Reducido de 200ms a 100ms
      }
    };

    audioPlayer.onerror = (e) => {
      URL.revokeObjectURL(audioUrl);
      isAudioPlaying = false;
      updateWidgetState('activo', 'Error de audio');
    };

    // Reproducir con volumen garantizado
    await audioPlayer.play();
    
  } catch (error) {
    isAudioPlaying = false;
    updateWidgetState('activo', 'Error reproducción');
  }
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
  
  return true; // Indica que la respuesta será asíncrona
});

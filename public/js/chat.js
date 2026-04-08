"use strict";

// CONEXION A WEBSOCKET

const socket = io();
let conectado = false;

// Elementos del DOM
const inputMensaje = document.getElementById('inputMensaje');
const btnEnviar = document.getElementById('btnEnviar');
const contenedorMensajes = document.getElementById('mensajes');
const estadoElemento = document.getElementById('estado');
const btnCargarMas = document.getElementById('btnCargarMas');
const cargarMasContainer = document.getElementById('cargarMasContainer');

// Observador para detectar cuando el destinatario lee el último mensaje recibido
let observadorLectura = null;

console.log("Iniciando chat...");
console.log(`Usuario actual: ${usuarioActualNombre} (${usuarioActualId})`);
console.log(`Hablando con: ${usuarioDestinoNombre} (${usuarioDestinoId})`);

// ─── EVENTOS SOCKET ───────────────────────────────────────────────────────────

// EVENTO CONEXIÓN EXITOSA
socket.on('connect', () => {
    console.log('Conectado al servidor. Socket ID:', socket.id);
    conectado = true;
    actualizarEstado('Desconectado', false);
    habilitarInputs();

    // Notificar al servidor que entramos a esta sala de chat
    socket.emit('unirse_chat', {
        usuario_id: usuarioActualId,
        usuario_nombre: usuarioActualNombre,
        usuario_destino_id: usuarioDestinoId,
        anuncio_id: anuncioId,
        chat_id: chatId  // id de BD necesario para guardar mensajes
    });

    console.log('Se notifica al servidor que nos unimos al chat');
});

// EVENTO DESCONEXIÓN
socket.on('disconnect', () => {
    console.log('Desconectado del servidor');
    conectado = false;
    actualizarEstado('Desconectado', false);
    deshabilitarInputs();
});

// EVENTO OTRO USUARIO EN LÍNEA
socket.on('usuario_en_linea', () => {
    actualizarEstado('En línea', true);
});

// EVENTO OTRO USUARIO DESCONECTADO
socket.on('usuario_desconectado', () => {
    actualizarEstado('Desconectado', false);
});

// EVENTO RECIBIR MENSAJE (del otro usuario en tiempo real)
socket.on('mensaje_recibido', (datos) => {
    console.log('Mensaje recibido:', datos);
    const div = crearDivMensaje(datos.mensaje, false, datos.id_mensaje);
    limpiarMensajesInicio();
    contenedorMensajes.appendChild(div);
    contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;

    // Reemplazar el observador de lectura para apuntar al mensaje más nuevo
    observarMensajeAjeno(div, datos.id_mensaje);
});

// EVENTO CONFIRMACIÓN DE ENVÍO
// El servidor nos devuelve el id_mensaje real de BD.
// Actualizamos el div que estaba en estado "pendiente" para asignarle data-id.
socket.on('mensaje_enviado_confirmado', (datos) => {
    console.log('Mensaje confirmado por servidor, id_mensaje:', datos.id_mensaje);
    const pendiente = contenedorMensajes.querySelector('.mensaje.propio.pendiente');
    if (pendiente) {
        pendiente.dataset.id = datos.id_mensaje;
        pendiente.classList.remove('pendiente');
    }
});

// EVENTO MENSAJE VISTO
// El destinatario abrió/vio nuestro mensaje → actualizar el indicador ✓ → ✓✓ Leído
socket.on('mensaje_visto', (datos) => {
    console.log('Mensaje visto por el destinatario, id_mensaje:', datos.id_mensaje);
    const div = contenedorMensajes.querySelector(`.mensaje.propio[data-id="${datos.id_mensaje}"]`);
    if (div) {
        const indicador = div.querySelector('.leido-indicador');
        if (indicador) {
            indicador.textContent = '✓✓ Leído';
            indicador.classList.add('visto');
        }
    }
});

// ─── ENVIAR MENSAJE ──────────────────────────────────────────────────────────

inputMensaje.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && inputMensaje.value.trim() && conectado) {
        e.preventDefault();
        enviarMensaje();
    }
});

btnEnviar.addEventListener('click', () => {
    if (inputMensaje.value.trim() && conectado) enviarMensaje();
});

function enviarMensaje() {
    const mensaje = inputMensaje.value.trim();
    if (!mensaje || !conectado) return;

    console.log('Enviando mensaje:', mensaje);

    // Mostrar el mensaje en pantalla inmediatamente (actualización optimista).
    // La clase 'pendiente' indica que aún no tiene id_mensaje de BD.
    // Se elimina cuando llegue 'mensaje_enviado_confirmado' con el id real.
    const div = crearDivMensaje(mensaje, true, null);
    div.classList.add('pendiente');
    limpiarMensajesInicio();
    contenedorMensajes.appendChild(div);
    contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;

    // Emitir al servidor para que lo guarde en BD y lo reenvíe al destinatario
    socket.emit('enviar_mensaje', {
        usuario_id: usuarioActualId,
        usuario_nombre: usuarioActualNombre,
        usuario_destino_id: usuarioDestinoId,
        anuncio_id: anuncioId,
        chat_id: chatId,
        mensaje
    });

    inputMensaje.value = '';
    inputMensaje.focus();
}

// ─── HISTORIAL (cargar mensajes anteriores) ───────────────────────────────────

if (btnCargarMas) {
    btnCargarMas.addEventListener('click', cargarHistorial);
}

function cargarHistorial() {
    if (!primerIdMensaje || !hayMasAnteriores) return;

    console.log(`Cargando mensajes anteriores a id_mensaje=${primerIdMensaje}...`);
    btnCargarMas.disabled = true;
    btnCargarMas.textContent = 'Cargando...';

    // Guardar la altura actual para restaurar la posición de scroll después de insertar
    const alturaAntes = contenedorMensajes.scrollHeight;

    fetch(`/services/chat/historial?chat_id=${chatId}&antes_de=${primerIdMensaje}`)
        .then(r => r.json())
        .then(data => {
            if (!data.mensajes || data.mensajes.length === 0) {
                hayMasAnteriores = false;
                cargarMasContainer.style.display = 'none';
                return;
            }

            console.log(`Historial: ${data.mensajes.length} mensajes recibidos, hayMas=${data.hayMas}`);

            // Insertar los mensajes antes del primer .mensaje existente en el DOM
            // (así quedan por encima del historial ya visible)
            const referencia = contenedorMensajes.querySelector('.mensaje');
            data.mensajes.forEach(m => {
                const div = crearDivMensaje(m.contenido, m.id_usuario === usuarioActualId, m.id_mensaje, m.leido);
                if (referencia) {
                    contenedorMensajes.insertBefore(div, referencia);
                } else {
                    contenedorMensajes.appendChild(div);
                }
            });

            // Actualizar el cursor: el mensaje más antiguo ahora visible
            primerIdMensaje = data.mensajes[0].id_mensaje;

            // Restaurar posición de scroll para que el usuario no pierda el contexto
            const alturaDespues = contenedorMensajes.scrollHeight;
            contenedorMensajes.scrollTop = alturaDespues - alturaAntes;

            hayMasAnteriores = data.hayMas;
            if (!hayMasAnteriores) {
                cargarMasContainer.style.display = 'none';
            } else {
                btnCargarMas.disabled = false;
                btnCargarMas.textContent = '↑ Cargar mensajes anteriores';
            }
        })
        .catch(err => {
            console.error('Error al cargar historial:', err);
            btnCargarMas.disabled = false;
            btnCargarMas.textContent = '↑ Cargar mensajes anteriores';
        });
}

// ─── INDICADOR DE LEÍDO (IntersectionObserver) ───────────────────────────────

/*
 * Observa con IntersectionObserver si el último mensaje recibido (ajeno) es visible.
 * Cuando el 50% del div es visible en pantalla, emite 'mensaje_leido' al servidor.
 * Solo se observa un mensaje a la vez (el más reciente).
 */
function observarMensajeAjeno(divMensaje, idMensaje) {
    // Desconectar el observador anterior si lo había
    if (observadorLectura) observadorLectura.disconnect();

    observadorLectura = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                console.log(`Mensaje ${idMensaje} visible en pantalla → emitir mensaje_leido`);
                socket.emit('mensaje_leido', {
                    id_mensaje: idMensaje,
                    chat_id: chatId,
                    anuncio_id: anuncioId,
                    usuario_emisor_id: usuarioDestinoId // es el emisor original del mensaje ajeno
                });
                observadorLectura.disconnect(); // solo notificar una vez
            }
        });
    }, { threshold: 0.5 }); // se dispara cuando el 50% del elemento es visible

    observadorLectura.observe(divMensaje);
}

// Al abrir el chat, observar el último mensaje ajeno ya cargado en el historial inicial
(function iniciarObservadorInicial() {
    const ajentos = contenedorMensajes.querySelectorAll('.mensaje.ajeno[data-id]');
    if (ajentos.length === 0) return;
    const ultimo = ajentos[ajentos.length - 1];
    const idMensaje = parseInt(ultimo.dataset.id);
    console.log(`Observando mensaje inicial ajeno: id_mensaje=${idMensaje}`);
    observarMensajeAjeno(ultimo, idMensaje);
})();

// Scroll hasta el fondo al cargar la página
contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;

// ─── FUNCIONES AUXILIARES ─────────────────────────────────────────────────────

/*
 * Crea el elemento DOM para un mensaje.
 * - esPropio: true si es del usuario actual (se alinea a la derecha y lleva indicador ✓)
 * - idMensaje: id_mensaje de BD (puede ser null si el mensaje aún es 'pendiente')
 * - leido: si ya fue leído por el destinatario (para mostrar ✓✓ en el historial inicial)
 */
function crearDivMensaje(texto, esPropio, idMensaje = null, leido = false) {
    const div = document.createElement('div');
    div.className = 'mensaje' + (esPropio ? ' propio' : ' ajeno');
    if (idMensaje) div.dataset.id = idMensaje;

    // Contenedor del texto del mensaje
    const contenido = document.createElement('div');
    contenido.className = 'mensaje-contenido';
    contenido.textContent = texto;
    div.appendChild(contenido);

    // Indicador de leído (solo en mensajes propios)
    if (esPropio) {
        const indicador = document.createElement('span');
        indicador.className = 'leido-indicador' + (leido ? ' visto' : '');
        indicador.textContent = leido ? '✓✓ Leído' : '✓';
        div.appendChild(indicador);
    }

    return div;
}

// Elimina el mensaje de bienvenida "Comienza una conversación" cuando llega el primer mensaje
function limpiarMensajesInicio() {
    const inicio = contenedorMensajes.querySelector('.mensaje-inicio');
    if (inicio) inicio.remove();
}

// Actualiza el texto e indicador visual del estado de conexión del otro usuario
function actualizarEstado(texto, estoyConectado = true) {
    estadoElemento.textContent = texto;
    estadoElemento.classList.toggle('conectado', estoyConectado);
}

function deshabilitarInputs() {
    inputMensaje.disabled = true;
    btnEnviar.disabled = true;
}

function habilitarInputs() {
    inputMensaje.disabled = false;
    btnEnviar.disabled = false;
    inputMensaje.focus();
}

// ─── TOGGLE DISPONIBILIDAD ────────────────────────────────────────────────────

const btnToggleDisp = document.getElementById('btnToggleDisp');
const dispPanel = document.getElementById('chatDispPanel');
if (btnToggleDisp && dispPanel) {
    btnToggleDisp.addEventListener('click', () => {
        const abierto = dispPanel.classList.toggle('abierto');
        btnToggleDisp.classList.toggle('abierto', abierto);
    });
}
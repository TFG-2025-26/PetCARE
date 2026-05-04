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
    const div = crearDivMensaje(datos.mensaje, false, datos.id_mensaje, false, datos.tipo_mensaje);
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
    // Actualizar todos los mensajes propios con id <= al leído (todos anteriores también leídos)
    const divs = contenedorMensajes.querySelectorAll('.mensaje.propio[data-id]');
    divs.forEach(div => {
        if (parseInt(div.dataset.id) <= datos.id_mensaje) {
            const indicador = div.querySelector('.leido-indicador');
            if (indicador && !indicador.classList.contains('visto')) {
                indicador.textContent = '✓✓ Leído';
                indicador.classList.add('visto');
            }
        }
    });
});

// ─── ENVIAR MENSAJE ──────────────────────────────────────────────────────────

inputMensaje && inputMensaje.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && inputMensaje.value.trim() && conectado) {
        e.preventDefault();
        enviarMensaje();
    }
});

btnEnviar && btnEnviar.addEventListener('click', () => {
    if (inputMensaje.value.trim() && conectado) enviarMensaje();
});

function enviarMensaje() {
    const mensaje = inputMensaje.value.trim();
    if (!mensaje || !conectado) return;

    console.log('Enviando mensaje:', mensaje);

    // Mostrar el mensaje en pantalla inmediatamente (actualización optimista).
    // La clase 'pendiente' indica que aún no tiene id_mensaje de BD.
    // Se elimina cuando llegue 'mensaje_enviado_confirmado' con el id real.
    const div = crearDivMensaje(mensaje, true, null, false, 'texto');
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
                const div = crearDivMensaje(m.contenido, m.id_usuario === usuarioActualId, m.id_mensaje, m.leido, m.tipo_mensaje);
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

// Renderizar mensajes del historial inicial
mensajesInicialesData.forEach(m => {
    const div = crearDivMensaje(m.contenido, m.id_usuario === usuarioActualId, m.id_mensaje, m.leido, m.tipo_mensaje);
    contenedorMensajes.appendChild(div);
});

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
 * - tipoMensaje: el tipo de mensaje ('texto', 'cita')

 */
function crearDivMensaje(texto, esPropio, idMensaje = null, leido = false, tipoMensaje = 'texto') {
    const div = document.createElement('div');
    div.className = 'mensaje' + (esPropio ? ' propio' : ' ajeno');
    if (idMensaje) div.dataset.id = idMensaje;

    // Contenedor del texto del mensaje
    const contenido = document.createElement('div');
    contenido.className = 'mensaje-contenido';

    // Si es un mensaje de cita, renderizarlo de forma especial
    if (tipoMensaje === 'cita') {
        try {
            const datosCita = JSON.parse(texto);
            let botonesHTML = '';

            // Solo mostrar los botones si es un mensaje ajeno, estado pendiente, y el chat está activo
            if (!esPropio && datosCita.estado === 'pendiente' && (typeof chatActivo === 'undefined' || chatActivo)) {
                botonesHTML = `
                    <div class="cita-acciones">
                        <button class="btn-rechazar-cita" data-id-mensaje="${idMensaje}">Rechazar</button>
                        <button class="btn-aceptar-cita" data-id-mensaje="${idMensaje}">Aceptar</button>
                    </div>
                `;
            }

            contenido.innerHTML = `
                <div class="mensaje-cita">
                    <div class="cita-titulo">📅 Solicitud de cita</div>
                    <div class="cita-detalles">
                        <p><strong>Fecha:</strong> ${new Date(datosCita.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p><strong>Hora:</strong> ${datosCita.hora_inicio} - ${datosCita.hora_fin}</p>
                        <p><strong>Precio/hora:</strong> ${datosCita.precio_hora} €</p>
                    </div>
                    <div class="cita-estado">${datosCita.estado}</div>
                    ${botonesHTML}
                </div>
            `;
        } catch (e) {
            contenido.textContent = 'Error al procesar la solicitud de cita';
        }
    } else {
        // Mensaje de texto normal
        contenido.textContent = texto;
    }

    
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
    if (!inputMensaje || !btnEnviar) return;
    inputMensaje.disabled = true;
    btnEnviar.disabled = true;
}

function habilitarInputs() {
    if (!inputMensaje || !btnEnviar) return;
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

// ─── SOLICITAR CITA ────────────────────────────────────────────────────

const btnSolicitarCita = document.getElementById('btnSolicitarCita');

if (btnSolicitarCita) {

//Elementos del modal
const modalSolicitarCita = document.getElementById('modalSolicitarCita');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnCancelarModal = document.getElementById('btnCancelarModal');
const formSolicitarCita = document.getElementById('formSolicitarCita');

// Elementos del formulario
const citaFechaInput = document.getElementById('citaFecha');
const citaHoraInicioInput = document.getElementById('citaHoraInicio');
const citaHoraFinInput = document.getElementById('citaHoraFin');
const citaPrecioHoraInput = document.getElementById('citaPrecioHora');

//Elementos de error
const errorCitaFecha = document.getElementById('error-citaFecha');
const errorCitaHoraInicio = document.getElementById('error-citaHoraInicio');
const errorCitaHoraFin = document.getElementById('error-citaHoraFin');
const errorCitaPrecioHora = document.getElementById('error-citaPrecioHora');

// Abrir modal al hacer click en "Solicitar Cita"
btnSolicitarCita.addEventListener('click', () => {
    modalSolicitarCita.classList.add('modal--abierto');
});

// Cerrar modal
const cerrarModal = () => {
    modalSolicitarCita.classList.remove('modal--abierto');
    formSolicitarCita.reset();
    limpiarErrores();
};

btnCerrarModal.addEventListener('click', cerrarModal);
btnCancelarModal.addEventListener('click', cerrarModal);

// Cerrar modal si haces click fuera del content
modalSolicitarCita.addEventListener('click', (e) => {
    if (e.target === modalSolicitarCita) {
        cerrarModal();
    }
});

// Funciones de validación
function validarFecha() {
    const fecha = citaFechaInput.value;

    if(!fecha) {
        errorCitaFecha.textContent = 'La fecha es obligatoria';
        return false;
    }

    const fechaObj = new Date(fecha);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fechaObj < hoy) {
        errorCitaFecha.textContent = 'La fecha no puede ser anterior a hoy';
        return false;
    }

    errorCitaFecha.textContent = '';
    return true;
}

function validarHoraInicio() {
    const horaInicio = citaHoraInicioInput.value;

    if (!horaInicio) {
        errorCitaHoraInicio.textContent = 'La hora de inicio es obligatoria';
        return false;
    }

    errorCitaHoraInicio.textContent = '';
    return true;
}

function validarHoraFin() {
    const horaFin = citaHoraFinInput.value;
    const horaInicio = citaHoraInicioInput.value;

    if (!horaFin) {
        errorCitaHoraFin.textContent = 'La hora de fin es obligatoria';
        return false;
    }

    if (horaFin <= horaInicio) {
        errorCitaHoraFin.textContent = 'La hora de fin debe ser posterior a la hora de inicio';
        return false;
    }

    errorCitaHoraFin.textContent = '';
    return true;
}

function validarPrecioHora() {
    const precio = citaPrecioHoraInput.value;

    if (!precio && precio !== '0') {
        errorCitaPrecioHora.textContent = 'El precio por hora es obligatorio';
        return false;
    }

    const precioNum = parseFloat(precio);
    if (precioNum < 0) {
        errorCitaPrecioHora.textContent = 'El precio no puede ser negativo';
        return false;
    }

    if (precioNum > 999) {
        errorCitaPrecioHora.textContent = 'El precio no puede superar los 999 €';
        return false;
    }

    errorCitaPrecioHora.textContent = '';
    return true;
}

function limpiarErrores() {
    errorCitaFecha.textContent = '';
    errorCitaHoraInicio.textContent = '';
    errorCitaHoraFin.textContent = '';
    errorCitaPrecioHora.textContent = '';
}

// Validación en tiempo real
citaFechaInput.addEventListener('change', validarFecha);
citaHoraInicioInput.addEventListener('change', () => {
    validarHoraInicio();
    validarHoraFin(); // Revalidar hora fin porque depende de hora inicio
});
citaHoraFinInput.addEventListener('change', validarHoraFin);
citaPrecioHoraInput.addEventListener('input', validarPrecioHora);

// Enviar solicitud de cita
formSolicitarCita.addEventListener('submit', (e) => {
    e.preventDefault();

    // Validar todos los campos
    const esFechaValida = validarFecha();
    const esHoraInicioValida = validarHoraInicio();
    const esHoraFinValida = validarHoraFin();
    const esPrecioValido = validarPrecioHora();

    if (!esFechaValida || !esHoraInicioValida || !esHoraFinValida || !esPrecioValido) {
        console.log('Formulario de cita no válido');
        return;
    }

    const fecha = citaFechaInput.value;
    const horaInicio = citaHoraInicioInput.value;
    const horaFin = citaHoraFinInput.value;
    const tipoServicio = document.getElementById('citaTipoServicio').value;

    // Crear el JSON con los datos de la cita
    const datosCita = {
        fecha: fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        tipo_servicio: tipoServicio,
        precio_hora: parseInt(document.getElementById('citaPrecioHora').value),
        estado: 'pendiente',
    };

    console.log('Enviando solicitud de cita:', datosCita);

    // Emitir por socket como mensaje especial
    socket.emit('enviar_mensaje', {
        usuario_id: usuarioActualId,
        usuario_destino_id: usuarioDestinoId,
        usuario_nombre: usuarioActualNombre,
        tipo_mensaje: 'cita',
        mensaje: JSON.stringify(datosCita),
        chat_id: chatId,
        anuncio_id: anuncioId
    });

    // Cerrar el modal y limpiar el formulario
    cerrarModal();

    // Mostrar mensaje de cita en pantalla inmediatamente (actualización optimista)
    const divCita = crearDivMensaje(JSON.stringify(datosCita), true, null, false, 'cita');
    divCita.classList.add('pendiente');
    limpiarMensajesInicio();
    contenedorMensajes.appendChild(divCita);
    contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
});

} // fin if (btnSolicitarCita)

// EVENTO ERROR AL ENVIAR CITA (validación servidor)
socket.on('cita_error', (datos) => {
    console.error('Error al enviar cita:', datos);

    // Eliminar el div pendiente creado optimistamente
    const pendiente = contenedorMensajes.querySelector('.mensaje.propio.pendiente');
    if (pendiente) pendiente.remove();

    mostrarModalError(datos.error, datos.errores || []);
});

/*
 * Crea y muestra dinámicamente un modal de error con la misma estructura
 * que la plantilla modalErrores.ejs (modal-overlay / modal-box / modal-list).
 */
function mostrarModalError(titulo, errores) {
    const previo = document.getElementById('modalErrorDinamico');
    if (previo) previo.remove();

    const listaHTML = errores.length > 0
        ? `<ul class="modal-list">${errores.map(e => `<li>${e.msg}</li>`).join('')}</ul>`
        : '';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modalErrorDinamico';
    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">
                <h3>${titulo}</h3>
            </div>
            ${listaHTML}
            <div class="modal-footer">
                <button class="btn-submit" id="btnCerrarErrorDinamico">Cerrar</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.getElementById('btnCerrarErrorDinamico').addEventListener('click', () => overlay.remove());
}

// EVENTO ACTUALIZACIÓN ESTADO CITA
socket.on('cita_estado_actualizado', (datos) => {
    const divMensaje = contenedorMensajes.querySelector(`.mensaje[data-id="${datos.id_mensaje}"]`);
    if (!divMensaje) return;

    const estadoDiv = divMensaje.querySelector('.cita-estado');
    if (estadoDiv) {
        estadoDiv.textContent = datos.nuevo_estado;
    }

    const accionesDiv = divMensaje.querySelector('.cita-acciones');
    if (accionesDiv) accionesDiv.remove();
});

// ─── ACEPTAR/RECHAZAR CITA ──────────────────────────────────────

contenedorMensajes.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-aceptar-cita')) {
        const idMensaje = parseInt(e.target.dataset.idMensaje);
        socket.emit('aceptar_cita', {
            id_mensaje: idMensaje,
            chat_id: chatId,
            anuncio_id: anuncioId,
            usuario_id: usuarioActualId,
            usuario_destino_id: usuarioDestinoId
        });
    } else if (e.target.classList.contains('btn-rechazar-cita')) {
        const idMensaje = parseInt(e.target.dataset.idMensaje);
        socket.emit('rechazar_cita', {
            id_mensaje: idMensaje,
            chat_id: chatId,
            anuncio_id: anuncioId,
            usuario_id: usuarioActualId,
            usuario_destino_id: usuarioDestinoId
        });
    }
});

// ─── FINALIZAR SERVICIO ───────────────────────────────────────────────────────

const btnFinalizarServicio = document.getElementById('btnFinalizarServicio');
const bannerFinalizacion   = document.getElementById('bannerFinalizacion');

// ── Modal confirmar finalizar ─────────────────────────────────────────────────
const modalFinalizar         = document.getElementById('modalFinalizarServicio');
const btnConfirmarFinalizar  = document.getElementById('btnConfirmarFinalizar');
const btnCancelarFinalizar   = document.getElementById('btnCancelarModalFinalizar');
const btnCerrarFinalizar     = document.getElementById('btnCerrarModalFinalizar');

function abrirModalFinalizar() {
    if (modalFinalizar) modalFinalizar.style.display = 'flex';
}

function cerrarModalFinalizar() {
    if (modalFinalizar) modalFinalizar.style.display = 'none';
}

if (btnCancelarFinalizar)  btnCancelarFinalizar.addEventListener('click', cerrarModalFinalizar);
if (btnCerrarFinalizar)    btnCerrarFinalizar.addEventListener('click', cerrarModalFinalizar);
if (modalFinalizar) {
    modalFinalizar.addEventListener('click', (e) => {
        if (e.target === modalFinalizar) cerrarModalFinalizar();
    });
}

if (btnConfirmarFinalizar) {
    btnConfirmarFinalizar.addEventListener('click', () => {
        cerrarModalFinalizar();
        socket.emit('solicitar_finalizar', {
            chat_id: chatId,
            usuario_id: usuarioActualId,
            usuario_destino_id: usuarioDestinoId,
            anuncio_id: anuncioId
        });
    });
}

if (btnFinalizarServicio) {
    btnFinalizarServicio.addEventListener('click', () => {
        if (btnFinalizarServicio.classList.contains('btn-finalizar-pendiente')) return;
        abrirModalFinalizar();
    });
}

// Evento: un usuario solicitó finalizar (puede ser yo o el otro)
socket.on('finalizacion_pendiente', (datos) => {
    if (datos.usuario_id === usuarioActualId) {
        // Soy yo quien lo solicitó → poner el botón en estado "esperando"
        if (btnFinalizarServicio) {
            btnFinalizarServicio.textContent = 'Esperando confirmación del otro usuario...';
            btnFinalizarServicio.classList.add('btn-finalizar-pendiente');
        }
    } else {
        // El otro usuario lo solicitó → mostrar banner para que yo confirme
        if (bannerFinalizacion) {
            bannerFinalizacion.style.display = '';
        } else {
            // Crear el banner dinámicamente si no estaba en el HTML inicial
            const chatWrapper = document.querySelector('.chat-finalizar-bar');
            if (chatWrapper) {
                const banner = document.createElement('div');
                banner.className = 'chat-finalizar-banner';
                banner.id = 'bannerFinalizacion';
                banner.innerHTML = `<span><strong>${usuarioDestinoNombre}</strong> ha solicitado finalizar el servicio. ¿Confirmas?</span>`;
                chatWrapper.parentNode.insertBefore(banner, chatWrapper);
            }
        }
    }
});

// Evento: ambos confirmaron → el chat ha sido finalizado/archivado
socket.on('chat_finalizado', () => {
    // Deshabilitar la interfaz de escritura
    if (inputMensaje) inputMensaje.disabled = true;
    if (btnEnviar)    btnEnviar.disabled = true;
    if (bannerFinalizacion) bannerFinalizacion.style.display = 'none';

    // Ocultar el área de inputs entera
    const chatInput = document.querySelector('.chat-input');
    if (chatInput) chatInput.style.display = 'none';

    // Ocultar el botón de finalizar del header
    if (btnFinalizarServicio) btnFinalizarServicio.style.display = 'none';

    // Mostrar botón de valoración
    const mensajesDiv = document.getElementById('mensajes');
    if (mensajesDiv) {
        const valorarAccion = document.createElement('div');
        valorarAccion.className = 'chat-valorar-accion';
        valorarAccion.id = 'chatValorarAccion';
        valorarAccion.innerHTML = `<span>El servicio ha finalizado ✓</span><button class="btn-abrir-valorar" id="btnAbrirValorar" type="button">Valorar a ${usuarioDestinoNombre}</button>`;
        mensajesDiv.insertAdjacentElement('afterend', valorarAccion);
    }
});

// ─── VALORAR SERVICIO ─────────────────────────────────────────────────────────────────────
const modalValorar      = document.getElementById('modalValorar');
const btnCerrarValorar  = document.getElementById('btnCerrarModalValorar');
const btnOmitirValorar  = document.getElementById('btnOmitirValorar');
const btnEnviarValorar  = document.getElementById('btnEnviarValorar');
const mvEstrellas       = document.getElementById('mvEstrellas');
const mvComentario      = document.getElementById('mvComentario');

let valoracionSeleccionada = 0;

function abrirModalValorar() {
    if (modalValorar) modalValorar.style.display = 'flex';
}

function cerrarModalValorar() {
    if (modalValorar) modalValorar.style.display = 'none';
}

if (btnCerrarValorar) btnCerrarValorar.addEventListener('click', cerrarModalValorar);
if (btnOmitirValorar) btnOmitirValorar.addEventListener('click', cerrarModalValorar);
if (modalValorar) {
    modalValorar.addEventListener('click', (e) => {
        if (e.target === modalValorar) cerrarModalValorar();
    });
}

// Interacción con las estrellas
if (mvEstrellas) {
    const estrellas = mvEstrellas.querySelectorAll('.mv-estrella');

    mvEstrellas.addEventListener('mouseover', (e) => {
        const btn = e.target.closest('.mv-estrella');
        if (!btn) return;
        const valor = parseInt(btn.dataset.valor);
        estrellas.forEach((s, i) => s.classList.toggle('activa', i < valor));
    });

    mvEstrellas.addEventListener('mouseout', () => {
        estrellas.forEach((s, i) => s.classList.toggle('activa', i < valoracionSeleccionada));
    });

    mvEstrellas.addEventListener('click', (e) => {
        const btn = e.target.closest('.mv-estrella');
        if (!btn) return;
        valoracionSeleccionada = parseInt(btn.dataset.valor);
        estrellas.forEach((s, i) => s.classList.toggle('activa', i < valoracionSeleccionada));
        if (btnEnviarValorar) btnEnviarValorar.disabled = false;
    });
}

if (btnEnviarValorar) {
    btnEnviarValorar.addEventListener('click', async () => {
        if (!valoracionSeleccionada) return;
        btnEnviarValorar.disabled = true;
        btnEnviarValorar.textContent = 'Enviando...';
        try {
            const resp = await fetch('/services/chat/valorar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    puntuacion: valoracionSeleccionada,
                    comentario: mvComentario ? mvComentario.value.trim() : ''
                })
            });
            if (resp.ok) {
                cerrarModalValorar();
                const accion = document.getElementById('chatValorarAccion');
                if (accion) {
                    const gracias = document.createElement('div');
                    gracias.className = 'chat-valoracion-gracias';
                    gracias.innerHTML = '<span>¡Gracias por tu valoración! 🐾</span>';
                    accion.replaceWith(gracias);
                }
            } else {
                btnEnviarValorar.disabled = false;
                btnEnviarValorar.textContent = 'Enviar valoración';
            }
        } catch {
            btnEnviarValorar.disabled = false;
            btnEnviarValorar.textContent = 'Enviar valoración';
        }
    });
}

// Botón valorar (renderizado por EJS o inyectado en tiempo real)
document.addEventListener('click', (e) => {
    if (e.target.closest('#btnAbrirValorar')) abrirModalValorar();
});

// ─── REPORTAR USUARIO ─────────────────────────────────────────────────────────

const btnReportarUsuario      = document.getElementById('btnReportarUsuario');
const modalReportarUsuario    = document.getElementById('modalReportarUsuario');
const btnCerrarModalReportar  = document.getElementById('btnCerrarModalReportar');
const btnCancelarReportar     = document.getElementById('btnCancelarReportar');
const formReportarUsuario     = document.getElementById('formReportarUsuario');
const mrMotivo                = document.getElementById('mr-motivo');
const mrDescripcion           = document.getElementById('mr-descripcion');
const mrErrorMotivo           = document.getElementById('mr-error-motivo');
const mrErrorDescripcion      = document.getElementById('mr-error-descripcion');

const modalFeedbackReporte    = document.getElementById('modalFeedbackReporte');
const mfrIcono                = document.getElementById('mrf-icon');
const mfrTitulo               = document.getElementById('mrf-titulo');
const mfrDesc                 = document.getElementById('mrf-desc');
const btnCerrarFeedback       = document.getElementById('btnCerrarFeedbackReporte');

function abrirModalReportar() {
    if (modalReportarUsuario) {
        formReportarUsuario.reset();
        if (mrErrorMotivo)     mrErrorMotivo.textContent = '';
        if (mrErrorDescripcion) mrErrorDescripcion.textContent = '';
        modalReportarUsuario.style.display = 'flex';
    }
}

function cerrarModalReportar() {
    if (modalReportarUsuario) modalReportarUsuario.style.display = 'none';
}

function mostrarFeedbackReporte(exito, titulo, desc) {
    if (!modalFeedbackReporte) return;
    mfrIcono.innerHTML = exito
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="26" height="26"><path d="M5 12l5 5L20 7"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
    mfrIcono.className = 'mrf-icon-wrap' + (exito ? ' mrf-icon-ok' : ' mrf-icon-err');
    mfrTitulo.textContent = titulo;
    mfrDesc.textContent = desc;
    modalFeedbackReporte.style.display = 'flex';
}

function cerrarFeedbackReporte() {
    if (modalFeedbackReporte) modalFeedbackReporte.style.display = 'none';
}

if (btnReportarUsuario) {
    btnReportarUsuario.addEventListener('click', abrirModalReportar);
}
if (btnCerrarModalReportar) btnCerrarModalReportar.addEventListener('click', cerrarModalReportar);
if (btnCancelarReportar)    btnCancelarReportar.addEventListener('click', cerrarModalReportar);
if (modalReportarUsuario) {
    modalReportarUsuario.addEventListener('click', (e) => {
        if (e.target === modalReportarUsuario) cerrarModalReportar();
    });
}
if (btnCerrarFeedback) btnCerrarFeedback.addEventListener('click', cerrarFeedbackReporte);
if (modalFeedbackReporte) {
    modalFeedbackReporte.addEventListener('click', (e) => {
        if (e.target === modalFeedbackReporte) cerrarFeedbackReporte();
    });
}

// Validación en tiempo real del motivo
if (mrMotivo) {
    mrMotivo.addEventListener('change', () => {
        if (mrMotivo.value) mrErrorMotivo.textContent = '';
    });
}

if (formReportarUsuario) {
    formReportarUsuario.addEventListener('submit', async (e) => {
        e.preventDefault();

        let valido = true;
        if (!mrMotivo.value) {
            mrErrorMotivo.textContent = 'Debes seleccionar un motivo válido';
            valido = false;
        } else {
            mrErrorMotivo.textContent = '';
        }
        if (mrDescripcion.value.length > 255) {
            mrErrorDescripcion.textContent = 'La descripción no puede superar 255 caracteres';
            valido = false;
        } else {
            mrErrorDescripcion.textContent = '';
        }
        if (!valido) return;

        const btnEnviar = document.getElementById('btnEnviarReporte');
        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Enviando...';

        try {
            const resp = await fetch('/services/usuario/reportar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    id_usuario_reportado: usuarioDestinoId,
                    motivo: mrMotivo.value,
                    descripcion: mrDescripcion.value.trim()
                })
            });
            let data = {};
            try { data = await resp.json(); } catch { /* respuesta sin JSON válido */ }
            cerrarModalReportar();
            if (resp.ok && data.ok) {
                mostrarFeedbackReporte(true, '¡Reporte enviado!', 'Gracias por ayudarnos a mantener PetCARE seguro. Revisaremos tu reporte a la brevedad.');
            } else {
                mostrarFeedbackReporte(false, 'No se pudo enviar el reporte', data.error || 'Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.');
            }
        } catch {
            cerrarModalReportar();
            console.log('Entra por el catch');
            mostrarFeedbackReporte(false, 'Error de conexión', 'No pudimos conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.');
        } finally {
            const btnEnviarRef = document.getElementById('btnEnviarReporte');
            if (btnEnviarRef) {
                btnEnviarRef.disabled = false;
                btnEnviarRef.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg> Enviar reporte`;
            }
        }
    });
}

"use strict";

/**
 * misChats.js
 * Gestiona la paginación de los dos listados de la página /services/mis-chats:
 *   - Columna "Contacté yo"  (tipo=iniciados)
 *   - Columna "Me contactaron" (tipo=recibidos)
 *
 * Patrón:
 *   1. Al cargar la página se piden los primeros 10 chats de cada columna.
 *   2. Si el servidor indica hayMas=true se muestra el botón "Ver más".
 *   3. Cada clic en "Ver más" incrementa la página y concatena las nuevas tarjetas.
 */

// ── Estado por columna ───────────────────────────────────────────────────────

/** Estado de paginación de la columna "Contacté yo" */
const estadoIniciados = {
    pagina: 1,
    cargando: false,
    agotado: false
};

/** Estado de paginación de la columna "Me contactaron" */
const estadoRecibidos = {
    pagina: 1, 
    cargando: false,
    agotado: false
};

// ── Utilidades ───────────────────────────────────────────────────────────────

// Formatea una fecha ISO/MySQL como "hace X min/h/días" o la fecha completa. 
function formatearFecha(fechaStr) {
    if (!fechaStr) return '';
    const fecha = new Date(fechaStr);
    const ahora = new Date();
    const diffMs = ahora - fecha;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'ahora mismo';
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `hace ${diffH} h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `hace ${diffD} día${diffD > 1 ? 's' : ''}`;

    // Más de una semana: mostrar fecha corta
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Genera la inicial del nombre para el avatar
function inicial(nombre) {
    return nombre ? nombre.charAt(0).toUpperCase() : '?';
}

// Trunca un texto a una longitud máxima añadiendo "…"
function truncar(texto, max) {
    if (!texto) return 'Sin mensajes todavía';
    return texto.length > max ? texto.slice(0, max) + '…' : texto;
}
//Crea el HTML de una tarjeta de chat. Al hacer clic va a /services/chat?usuario_id=X&anuncio_id=Y
function crearTarjeta(chat) {
    const avatarSrc = chat.destino_foto
        ? `${chat.destino_foto}`
        : null;

    const avatarHtml = avatarSrc
        ? `<img class="chat-card-avatar" src="${avatarSrc}" alt="${chat.destino_nombre}">`
        : `<div class="chat-card-avatar chat-card-avatar--inicial">${inicial(chat.destino_nombre)}</div>`;

    const badgeServicio = chat.tipo_servicio
        ? `<span class="chat-card-badge">${chat.tipo_servicio}</span>`
        : '';
    const badgeMascota = chat.tipo_mascota
        ? `<span class="chat-card-badge chat-card-badge--mascota">${chat.tipo_mascota}</span>`
        : '';

    const noLeidosHtml = chat.mensajes_no_leidos > 0
        ? `<span class="chat-card-no-leidos">${chat.mensajes_no_leidos}</span>`
        : '';

    const url = `/services/chat?usuario_id=${chat.destino_id}&anuncio_id=${chat.id_anuncio}`;

    return `
        <a class="chat-card" href="${url}" aria-label="Chat con ${chat.destino_nombre}">
            <div class="chat-card-left">
                ${avatarHtml}
            </div>
            <div class="chat-card-body">
                <div class="chat-card-header">
                    <span class="chat-card-nombre">${chat.destino_nombre}</span>
                    <span class="chat-card-fecha">${formatearFecha(chat.ultima_fecha)}</span>
                </div>
                <div class="chat-card-badges">
                    ${badgeServicio}
                    ${badgeMascota}
                </div>
                <div class="chat-card-preview">
                    <span class="chat-card-ultimo-msg">${chat.ultimo_tipo_mensaje === 'cita' ? '📅 Cita solicitada' : truncar(chat.ultimo_mensaje, 60)}</span>
                    ${noLeidosHtml}
                </div>
            </div>
        </a>
    `.trim();
}

// --- Carga de datos -------------------------------------------------

// Pide una página de chats al servidor y las añade al listado indicado
function cargarChats(tipo, estado, lista, btnVerMas, divVerMas, pEmpty) {
    if (estado.cargando || estado.agotado) return;

    estado.cargando = true;
    btnVerMas.disabled = true;

    console.log(`cargarChats: tipo=${tipo} pagina=${estado.pagina}`);

    fetch(`/services/mis-chats/data?tipo=${tipo}&pagina=${estado.pagina}`)
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
        .then(data => {
            console.log(`cargarChats ${tipo}: recibidos ${data.chats.length}, hayMas=${data.hayMas}`);

            if (data.chats.length === 0 && estado.pagina === 1) {
                // Sin resultados en la primera carga -> mostrar mensaje vacío
                pEmpty.style.display = 'block';
                divVerMas.style.display = 'none';
                return;
            }

            // Insertar tarjetas
            data.chats.forEach(chat => {
                lista.insertAdjacentHTML('beforeend', crearTarjeta(chat));
            });

            if (data.hayMas) {
                divVerMas.style.display = 'flex';
                btnVerMas.disabled = false;
                estado.pagina++;
            } else {
                divVerMas.style.display = 'none';
                estado.agotado = true;
            }
        })
        .catch(err => {
            console.error(`cargarChats ${tipo} error:`, err);
            btnVerMas.disabled = false;
        })
        .finally(() => {
            estado.cargando = false;
        });
}

// --- Inicialización ------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // Columna "Contacté yo"
    const listaIniciados  = document.getElementById('lista-iniciados');
    const btnMasIniciados = document.getElementById('btn-mas-iniciados');
    const vmIniciados     = document.getElementById('vm-iniciados');
    const emptyIniciados  = document.getElementById('empty-iniciados');

    // Columna "Me contactaron"
    const listaRecibidos  = document.getElementById('lista-recibidos');
    const btnMasRecibidos = document.getElementById('btn-mas-recibidos');
    const vmRecibidos     = document.getElementById('vm-recibidos');
    const emptyRecibidos  = document.getElementById('empty-recibidos');

    // Carga inicial de ambas columnas en paralelo
    cargarChats('iniciados', estadoIniciados, listaIniciados, btnMasIniciados, vmIniciados, emptyIniciados);
    cargarChats('recibidos',  estadoRecibidos, listaRecibidos, btnMasRecibidos, vmRecibidos,  emptyRecibidos);

    // Evento "Ver más" – columna izquierda
    btnMasIniciados.addEventListener('click', () => {
        cargarChats('iniciados', estadoIniciados, listaIniciados, btnMasIniciados, vmIniciados, emptyIniciados);
    });

    // Evento "Ver más" – columna derecha
    btnMasRecibidos.addEventListener('click', () => {
        cargarChats('recibidos', estadoRecibidos, listaRecibidos, btnMasRecibidos, vmRecibidos, emptyRecibidos);
    });
});

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

/** Estado de paginación de archivados - columna "Contacté yo" */
const estadoArchivadosIniciados = {
    pagina: 1,
    cargando: false,
    agotado: false
};

/** Estado de paginación de archivados - columna "Me contactaron" */
const estadoArchivadosRecibidos = {
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
//Crea el HTML de una tarjeta de chat.
// Si archivada=false (defecto): card activa con botón eliminar, URL usa usuario_id+anuncio_id.
// Si archivada=true: card de solo lectura, URL usa chat_id directamente.
function crearTarjeta(chat, archivada = false) {
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

    const noLeidosHtml = (!archivada && chat.mensajes_no_leidos > 0)
        ? `<span class="chat-card-no-leidos">${chat.mensajes_no_leidos}</span>`
        : '';

    const url = archivada
        ? `/services/chat/archivado?chat_id=${chat.id_chat}`
        : `/services/chat?usuario_id=${chat.destino_id}&anuncio_id=${chat.id_anuncio}`;

    const btnEliminarHtml = archivada ? '' : `
        <button class="btn-eliminar-chat" data-chat-id="${chat.id_chat}" title="Archivar chat" aria-label="Archivar chat">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M17 3H7a2 2 0 0 0-2 2v1H3v2h1v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8h1V6h-2V5a2 2 0 0 0-2-2zm0 2v1H7V5h10zm1 14H6V8h12v11z"/></svg>
        </button>`;

    return `
        <div class="chat-card-wrapper">
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
                        <span class="chat-card-ultimo-msg">${(() => {
                            if (archivada && chat.finalizar_usuario1 && chat.finalizar_usuario2) {
                                return chat.ya_valorado
                                    ? `✓ Has valorado a ${chat.destino_nombre}`
                                    : `⭐ Valora a ${chat.destino_nombre}`;
                            }
                            return chat.ultimo_tipo_mensaje === 'cita' ? '📅 Cita solicitada' : truncar(chat.ultimo_mensaje, 60);
                        })()}</span>
                        ${noLeidosHtml}
                    </div>
                </div>
            </a>
            ${btnEliminarHtml}
        </div>
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
                pEmpty.style.display = 'block';
                divVerMas.style.display = 'none';
                return;
            }

            data.chats.forEach(chat => {
                lista.insertAdjacentHTML('beforeend', crearTarjeta(chat, false));
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

// Pide una página de chats archivados y los añade al listado de archivados
function cargarChatsArchivados(tipo, estado, seccion, lista, btnVerMas, divVerMas, pEmpty) {
    if (estado.cargando || estado.agotado) return;

    estado.cargando = true;
    btnVerMas.disabled = true;

    console.log(`cargarChatsArchivados: tipo=${tipo} pagina=${estado.pagina}`);

    fetch(`/services/mis-chats/data?tipo=${tipo}&archivados=1&pagina=${estado.pagina}`)
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
        .then(data => {
            console.log(`cargarChatsArchivados ${tipo}: recibidos ${data.chats.length}, hayMas=${data.hayMas}`);

            if (data.chats.length === 0 && estado.pagina === 1) {
                // No hay archivados: mantener sección oculta si nunca se mostró
                if (seccion.style.display === 'none') return;
                pEmpty.style.display = 'block';
                divVerMas.style.display = 'none';
                return;
            }

            // Mostrar la sección si hay al menos un archivado
            seccion.style.display = '';

            data.chats.forEach(chat => {
                lista.insertAdjacentHTML('beforeend', crearTarjeta(chat, true));
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
            console.error(`cargarChatsArchivados ${tipo} error:`, err);
            btnVerMas.disabled = false;
        })
        .finally(() => {
            estado.cargando = false;
        });
}

// --- Inicialización ------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // Columna "Contacté yo" – activos
    const listaIniciados  = document.getElementById('lista-iniciados');
    const btnMasIniciados = document.getElementById('btn-mas-iniciados');
    const vmIniciados     = document.getElementById('vm-iniciados');
    const emptyIniciados  = document.getElementById('empty-iniciados');

    // Columna "Me contactaron" – activos
    const listaRecibidos  = document.getElementById('lista-recibidos');
    const btnMasRecibidos = document.getElementById('btn-mas-recibidos');
    const vmRecibidos     = document.getElementById('vm-recibidos');
    const emptyRecibidos  = document.getElementById('empty-recibidos');

    // Columna "Contacté yo" – archivados
    const seccionArchivadosIniciados = document.getElementById('seccion-archivados-iniciados');
    const listaArchivadosIniciados   = document.getElementById('lista-archivados-iniciados');
    const btnMasArchivadosIniciados  = document.getElementById('btn-mas-archivados-iniciados');
    const vmArchivadosIniciados      = document.getElementById('vm-archivados-iniciados');
    const emptyArchivadosIniciados   = document.getElementById('empty-archivados-iniciados');

    // Columna "Me contactaron" – archivados
    const seccionArchivadosRecibidos = document.getElementById('seccion-archivados-recibidos');
    const listaArchivadosRecibidos   = document.getElementById('lista-archivados-recibidos');
    const btnMasArchivadosRecibidos  = document.getElementById('btn-mas-archivados-recibidos');
    const vmArchivadosRecibidos      = document.getElementById('vm-archivados-recibidos');
    const emptyArchivadosRecibidos   = document.getElementById('empty-archivados-recibidos');

    // Carga inicial de chats activos
    cargarChats('iniciados', estadoIniciados, listaIniciados, btnMasIniciados, vmIniciados, emptyIniciados);
    cargarChats('recibidos',  estadoRecibidos, listaRecibidos, btnMasRecibidos, vmRecibidos,  emptyRecibidos);

    // Carga inicial de chats archivados
    cargarChatsArchivados('iniciados', estadoArchivadosIniciados, seccionArchivadosIniciados, listaArchivadosIniciados, btnMasArchivadosIniciados, vmArchivadosIniciados, emptyArchivadosIniciados);
    cargarChatsArchivados('recibidos',  estadoArchivadosRecibidos,  seccionArchivadosRecibidos,  listaArchivadosRecibidos,  btnMasArchivadosRecibidos,  vmArchivadosRecibidos,  emptyArchivadosRecibidos);

    // Eventos "Ver más" – activos
    btnMasIniciados.addEventListener('click', () => {
        cargarChats('iniciados', estadoIniciados, listaIniciados, btnMasIniciados, vmIniciados, emptyIniciados);
    });
    btnMasRecibidos.addEventListener('click', () => {
        cargarChats('recibidos', estadoRecibidos, listaRecibidos, btnMasRecibidos, vmRecibidos, emptyRecibidos);
    });

    // Eventos "Ver más" – archivados
    btnMasArchivadosIniciados.addEventListener('click', () => {
        cargarChatsArchivados('iniciados', estadoArchivadosIniciados, seccionArchivadosIniciados, listaArchivadosIniciados, btnMasArchivadosIniciados, vmArchivadosIniciados, emptyArchivadosIniciados);
    });
    btnMasArchivadosRecibidos.addEventListener('click', () => {
        cargarChatsArchivados('recibidos', estadoArchivadosRecibidos, seccionArchivadosRecibidos, listaArchivadosRecibidos, btnMasArchivadosRecibidos, vmArchivadosRecibidos, emptyArchivadosRecibidos);
    });

    // ── Modal confirmar archivar chat ───────────────────────────────────────────
    const modalArchivar      = document.getElementById('modalArchivarChat');
    const btnConfirmarArch   = document.getElementById('btnConfirmarArchivar');
    const btnCancelarArch    = document.getElementById('btnCancelarArchivar');
    const btnCerrarModalArch = document.getElementById('btnCerrarModalArchivar');

    // Estado temporal del chat pendiente de archivar
    let pendienteArchivar = null; // { chatId, wrapper, tipo }

    function abrirModalArchivar(chatId, wrapper, tipo) {
        pendienteArchivar = { chatId, wrapper, tipo };
        modalArchivar.style.display = 'flex';
    }

    function cerrarModalArchivar() {
        modalArchivar.style.display = 'none';
        pendienteArchivar = null;
    }

    btnCancelarArch.addEventListener('click', cerrarModalArchivar);
    btnCerrarModalArch.addEventListener('click', cerrarModalArchivar);
    modalArchivar.addEventListener('click', (e) => {
        if (e.target === modalArchivar) cerrarModalArchivar();
    });

    btnConfirmarArch.addEventListener('click', async () => {
        if (!pendienteArchivar) return;
        const { chatId, wrapper, tipo } = pendienteArchivar;
        cerrarModalArchivar();

        try {
            const respuesta = await fetch(`/services/mis-chats/${chatId}/eliminar`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

            // Eliminar la tarjeta de la lista de activos
            if (wrapper) wrapper.remove();

            // Si la lista activa queda vacía, mostrar mensaje vacío
            const listaActiva = tipo === 'iniciados' ? listaIniciados : listaRecibidos;
            if (listaActiva && listaActiva.querySelectorAll('.chat-card-wrapper').length === 0) {
                (tipo === 'iniciados' ? emptyIniciados : emptyRecibidos).style.display = 'block';
            }

            // Recargar sección de archivados de esa columna desde cero
            if (tipo === 'iniciados') {
                listaArchivadosIniciados.innerHTML = '';
                estadoArchivadosIniciados.pagina = 1;
                estadoArchivadosIniciados.agotado = false;
                cargarChatsArchivados('iniciados', estadoArchivadosIniciados, seccionArchivadosIniciados, listaArchivadosIniciados, btnMasArchivadosIniciados, vmArchivadosIniciados, emptyArchivadosIniciados);
            } else {
                listaArchivadosRecibidos.innerHTML = '';
                estadoArchivadosRecibidos.pagina = 1;
                estadoArchivadosRecibidos.agotado = false;
                cargarChatsArchivados('recibidos', estadoArchivadosRecibidos, seccionArchivadosRecibidos, listaArchivadosRecibidos, btnMasArchivadosRecibidos, vmArchivadosRecibidos, emptyArchivadosRecibidos);
            }
        } catch (err) {
            console.error('Error al archivar chat:', err);
        }
    });

    // ── Manejador de clic en botón "Archivar chat" ──────────────────────────────
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-eliminar-chat');
        if (!btn) return;

        const chatId = parseInt(btn.dataset.chatId);
        const wrapper = btn.closest('.chat-card-wrapper');

        // Determinar a qué columna pertenece según la lista padre
        const listaParent = wrapper && wrapper.closest('.chats-lista');
        const tipo = listaParent && listaParent.id === 'lista-iniciados' ? 'iniciados' : 'recibidos';

        abrirModalArchivar(chatId, wrapper, tipo);
    });
});

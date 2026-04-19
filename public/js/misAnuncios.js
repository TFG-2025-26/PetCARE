"use strict";

let anuncios = [];
let paginaActual = 1;
let anuncioAEliminar = null;


function fetchAnuncios(acumular) {

    $('#ver-mas-anuncios').prop('disabled', true).text('Cargando...');

    $.ajax({
        url: '/services/get-mis-anuncios',
        method: 'GET',
        data: {
            pagina: paginaActual,
            limite: 10
        },
        success: function (data) {
            if (acumular) {
                anuncios = anuncios.concat(data.anuncios);
            } else {
                anuncios = data.anuncios;
            }

            paginaActual++;

            if (data.hayMasPaginas) {
                $('#ver-mas-anuncios').show().prop('disabled', false).text('Ver más');
            } else {
                $('#ver-mas-anuncios').hide();
            }

            renderizarAnuncios(anuncios);
        },
        error: function () {
            alert('Error al cargar los anuncios. Por favor, inténtalo de nuevo.');
            $('#ver-mas-anuncios').prop('disabled', false).text('Ver más');
        }
    });
}


function agruparDisponibilidad(disponibilidades, tipo) {
    const grupos = {};

    if (tipo === 'puntual') {
        disponibilidades.forEach(function(disp) {
            const clave = disp.fecha_inicio.split('T')[0].split('-').reverse().join('/');
            if (!grupos[clave]) grupos[clave] = [];
            grupos[clave].push(disp);
        });
        return grupos;
    } else if (tipo === 'recurrente') {
        const ordenSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
        disponibilidades.forEach(function(disp) {
            const clave = disp.dia_semana;
            if (!grupos[clave]) grupos[clave] = [];
            grupos[clave].push(disp);
        });
        const gruposOrdenados = {};
        ordenSemana.forEach(function(dia) {
            if (grupos[dia]) gruposOrdenados[dia] = grupos[dia];
        });
        return gruposOrdenados;
    } else if (tipo === 'puntual/recurrente') {
        const puntuales = disponibilidades.filter(d => d.tipo === 'puntual');
        const recurrentes = disponibilidades.filter(d => d.tipo === 'recurrente');

        const gruposPuntuales = {};
        puntuales.forEach(function(disp) {
            const clave = disp.fecha_inicio.split('T')[0].split('-').reverse().join('/');
            if (!gruposPuntuales[clave]) gruposPuntuales[clave] = [];
            gruposPuntuales[clave].push(disp);
        });

        const ordenSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
        const gruposRecurrentes = {};
        recurrentes.forEach(function(disp) {
            const clave = disp.dia_semana;
            if (!gruposRecurrentes[clave]) gruposRecurrentes[clave] = [];
            gruposRecurrentes[clave].push(disp);
        });
        const gruposRecurrentesOrdenados = {};
        ordenSemana.forEach(function(dia) {
            if (gruposRecurrentes[dia]) gruposRecurrentesOrdenados[dia] = gruposRecurrentes[dia];
        });

        return { puntual: gruposPuntuales, recurrente: gruposRecurrentesOrdenados };
    }
}


function renderDisponibilidad(disponibilidades, tipo) {
    if (!disponibilidades || disponibilidades.length === 0) {
        return '<p>No hay franjas de disponibilidad añadidas.</p>';
    }

    const grupos = agruparDisponibilidad(disponibilidades, tipo);

    if (tipo === 'recurrente') {
        const filas = Object.entries(grupos).map(function([dia, franjas]) {
            const slots = franjas.map(function(f) {
                return `<span class="slot">${f.hora_inicio} - ${f.hora_fin}</span>`;
            }).join('');
            return `<div class="fila-dia"><span class="day-tag">${dia}</span>${slots}</div>`;
        }).join('');
        return `<div class="disponibilidad-recurrente">${filas}</div>`;
    } else if (tipo === 'puntual/recurrente') {
        let html = '';
        if (Object.keys(grupos.puntual).length > 0) {
            const chips = Object.entries(grupos.puntual).map(function([fecha, franjas]) {
                const slots = franjas.map(function(f) {
                    return `<span class="slot">${f.hora_inicio} - ${f.hora_fin}</span>`;
                }).join('');
                return `<div class="date-chip"><span class="date">${fecha}</span>${slots}</div>`;
            }).join('');
            html += `<div class="disponibilidad-puntual">${chips}</div>`;
        }
        if (Object.keys(grupos.recurrente).length > 0) {
            const filas = Object.entries(grupos.recurrente).map(function([dia, franjas]) {
                const slots = franjas.map(function(f) {
                    return `<span class="slot">${f.hora_inicio} - ${f.hora_fin}</span>`;
                }).join('');
                return `<div class="fila-dia"><span class="day-tag">${dia}</span>${slots}</div>`;
            }).join('');
            html += `<div class="disponibilidad-recurrente">${filas}</div>`;
        }
        return html || '<p>No hay franjas de disponibilidad añadidas.</p>';
    } else {
        const chips = Object.entries(grupos).map(function([fecha, franjas]) {
            const slots = franjas.map(function(f) {
                return `<span class="slot">${f.hora_inicio} - ${f.hora_fin}</span>`;
            }).join('');
            return `<div class="date-chip"><span class="date">${fecha}</span>${slots}</div>`;
        }).join('');
        return `<div class="disponibilidad-puntual">${chips}</div>`;
    }
}


function buildTarjeta(anuncio, inactivo) {
    return `
            <div class="tarjeta-anuncio${inactivo ? ' tarjeta-anuncio--inactiva' : ''}" data-id="${anuncio.id_anuncio}">
                <div class="tarjeta-anuncio-contenido">
                    <div class="info-perfil-anuncio">
                        <img src="${anuncio.foto || '/images/no-pet.png'}" alt="Foto de perfil">
                        <p>${anuncio.nombre_usuario}</p>
                        <span>Valoración media: ${anuncio.valoracion_media ? parseFloat(anuncio.valoracion_media).toFixed(1) : 'Sin valoraciones'} ⭐</span>
                    </div>
                    <div class="seccion-centro-anuncio">
                        <div class="descripcion-anuncio">
                            <p>${anuncio.descripcion}</p>
                        </div>
                        <div class="atributos-anuncio">
                            <div class="atributo-anuncio atributo-tipo-servicio">
                                <p>Servicio | <strong>${anuncio.tipo_servicio}</strong></p>
                            </div>
                            <div class="atributo-anuncio atributo-mascota">
                                <p>Mascota | <strong>${anuncio.tipo_mascota}</strong></p>
                            </div>
                            <div class="atributo-anuncio atributo-tipo-anuncio">
                                <p>Anuncio | <strong>${anuncio.tipo_anuncio}</strong></p>
                            </div>
                        </div>
                    </div>
                    <div class="seccion-dcha-anuncio">
                        ${inactivo ? '<span class="badge-inactivo">Inactivo</span>' : ''}
                        <div class="precio-anuncio">
                            <p>${anuncio.precio_hora}€</p>
                            <span>por hora</span>
                        </div>
                        <div class="acciones-anuncio">
                            ${inactivo ? `<button class="btn-reactivar-anuncio" data-id="${anuncio.id_anuncio}" title="Reactivar anuncio"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>` : ''}
                            <button class="btn-eliminar-anuncio" data-id="${anuncio.id_anuncio}" title="Eliminar anuncio"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="17" height="17"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
                        </div>
                    </div>
                </div>
                <div class="tarjeta-anuncio-disponibilidad">
                    <h4 class="disponibilidad-titulo">Disponibilidad:</h4>
                    ${renderDisponibilidad(anuncio.disponibilidades, anuncio.tipo_anuncio)}
                </div>
            </div>
        `;
}


function renderizarAnuncios(listaAnuncios) {
    const contenedor = $('#anuncios-container');
    contenedor.empty();

    if (listaAnuncios.length === 0) {
        contenedor.html('<div class="no-anuncios"><p>Todavía no has publicado ningún anuncio.</p></div>');
        return;
    }

    const activos = listaAnuncios.filter(function(a) { return a.activo; });
    const inactivos = listaAnuncios.filter(function(a) { return !a.activo; });

    let html = '<div class="mis-anuncios-seccion" id="seccion-activos">';
    if (activos.length > 0) {
        activos.forEach(function(anuncio) { html += buildTarjeta(anuncio, false); });
    } else {
        html += '<div class="no-anuncios"><p>No tienes anuncios activos.</p></div>';
    }
    html += '</div>';

    if (inactivos.length > 0) {
        html += '<div class="mis-anuncios-seccion mis-anuncios-seccion--inactivos" id="seccion-inactivos">';
        html += '<h2 class="mis-anuncios-seccion-titulo">Anuncios inactivos</h2>';
        inactivos.forEach(function(anuncio) { html += buildTarjeta(anuncio, true); });
        html += '</div>';
    }

    contenedor.html(html);
}


function abrirModalEliminar(id, inactivo) {
    anuncioAEliminar = id;
    $('#btn-confirmar-eliminar-simple').closest('.mea-opcion').toggle(!inactivo);
    $('#modal-eliminar-anuncio').fadeIn(150);
}

function cerrarModalEliminar() {
    anuncioAEliminar = null;
    $('#modal-eliminar-anuncio').fadeOut(150);
}

function confirmarEliminar(tipo) {
    if (!anuncioAEliminar) return;
    const id = anuncioAEliminar;
    cerrarModalEliminar();

    $.ajax({
        url: `/services/anuncios/${id}/eliminar`,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({ tipo }),
        success: function () {
            if (tipo === 'simple') {
                location.reload();
            } else {
                $(`.tarjeta-anuncio[data-id="${id}"]`).fadeOut(300, function() {
                    $(this).remove();
                    anuncios = anuncios.filter(a => a.id_anuncio !== id);
                    if (anuncios.length === 0) {
                        $('#anuncios-container').html('<div class="no-anuncios"><p>Todavía no has publicado ningún anuncio.</p></div>');
                    }
                });
            }
        },
        error: function (xhr) {
            const msg = xhr.responseJSON && xhr.responseJSON.error
                ? xhr.responseJSON.error
                : 'Error al eliminar el anuncio. Inténtalo de nuevo.';
            alert(msg);
        }
    });
}


$(document).ready(function() {
    fetchAnuncios(false);

    $('#ver-mas-anuncios').click(function() {
        fetchAnuncios(true);
    });

    $('#anuncios-container').on('click', '.btn-eliminar-anuncio', function() {
        const inactivo = $(this).closest('.tarjeta-anuncio--inactiva').length > 0;
        abrirModalEliminar(parseInt($(this).data('id')), inactivo);
    });

    $('#anuncios-container').on('click', '.btn-reactivar-anuncio', function() {
        const id = parseInt($(this).data('id'));
        $.ajax({
            url: `/services/anuncios/${id}/reactivar`,
            method: 'PUT',
            success: function() { location.reload(); },
            error: function(xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.error
                    ? xhr.responseJSON.error
                    : 'Error al reactivar el anuncio.';
                alert(msg);
            }
        });
    });

    $('#btn-cerrar-modal-anuncio, #btn-cancelar-modal-anuncio').click(function() {
        cerrarModalEliminar();
    });

    $('#modal-eliminar-anuncio').click(function(e) {
        if ($(e.target).is('#modal-eliminar-anuncio')) cerrarModalEliminar();
    });

    $('#btn-confirmar-eliminar-total').click(function() { confirmarEliminar('total'); });
    $('#btn-confirmar-eliminar-simple').click(function() { confirmarEliminar('simple'); });
});

"use strict";

let anuncios = [];
let paginaActual = 1;


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


function renderizarAnuncios(listaAnuncios) {
    const contenedor = $('#anuncios-container');
    contenedor.empty();

    if (listaAnuncios.length === 0) {
        contenedor.html('<div class="no-anuncios"><p>Todavía no has publicado ningún anuncio.</p></div>');
        return;
    }

    listaAnuncios.forEach(function(anuncio) {
        const tarjeta = `
            <div class="tarjeta-anuncio">
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
                        <div class="precio-anuncio">
                            <p>${anuncio.precio_hora}€</p>
                            <span>por hora</span>
                        </div>
                    </div>
                </div>
                <div class="tarjeta-anuncio-disponibilidad">
                    <h4 class="disponibilidad-titulo">Disponibilidad:</h4>
                    ${renderDisponibilidad(anuncio.disponibilidades, anuncio.tipo_anuncio)}
                </div>
            </div>
        `;
        contenedor.append(tarjeta);
    });
}


$(document).ready(function() {
    fetchAnuncios(false);

    $('#ver-mas-anuncios').click(function() {
        fetchAnuncios(true);
    });
});

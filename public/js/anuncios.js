"use strict";


// ---- VARIABLES GLOBALES ----
// Array donde guardamos TODOS los anuncios que hemos cargado hasta ahora
// Cuando el usuario pulsa "Ver más", se van añadiendo al final
let anuncios = [];

// Página en la que estamos. Empieza en 1 y sube con cada "Ver más"
let paginaActual = 1;

// Los filtros que tiene seleccionados el usuario en este momento
let filtrosActuales = {
    tipoAnuncio: '',
    tipoServicio: '',
    tipoAnimal: '',
    precioMax: '',
    valoracionMin: ''
}


// ----- FUNCIÓN APLICAR FILTROS -----
// Se llama cuando el usuario cambia un filtro.
// Resetea el estado y hace una nueva petición desde la página 1.

function aplicarFiltros() {

    // Recogemos los valores de los filtros
    filtrosActuales.tipoAnuncio = $('#filtro-tipo-anuncio').val();
    const tipoServicio = $('#filtro-tipo-servicio').val();
    filtrosActuales.tipoServicio = tipoServicio === 'todos-servicios' ? '' : tipoServicio;
    const tipoAnimal = $('#filtro-animal').val();
    filtrosActuales.tipoAnimal = tipoAnimal === 'todos-animales' ? '' : tipoAnimal;
    filtrosActuales.precioMax = $('#filtro-precio-max').val();
    const valoracionMin = $('#filtro-valoracion').val();
    filtrosActuales.valoracionMin = valoracionMin === 'todas-valoraciones' ? '' : valoracionMin;

    // Reseteamos el estado
    anuncios = [];
    paginaActual = 1;

    // Hacemos una nueva petición con los filtros aplicados
    fetchAnuncios(false);   // false = no acumular, reemplazar lo que hay
}


// ----- FUNCIÓN FETCH ANUNCIOS (petición al backend) -----
// Si acumular es true, añadimos los nuevos anuncios al final del array.
// Si es false, reemplazamos el array por completo (usado al aplicar filtros).

function fetchAnuncios(acumular) {

    // Desactivamos el botón de "Ver más" mientras cargamos
    $('#ver-mas-anuncios').prop('disabled', true).text('Cargando...');

    $.ajax({
        url: '/services/get-anuncios',
        method: 'GET',
        data: {
            pagina: paginaActual,
            limite: 2,
            tipoAnuncio: filtrosActuales.tipoAnuncio,
            tipoServicio: filtrosActuales.tipoServicio,
            tipoAnimal: filtrosActuales.tipoAnimal,
            precioMax: filtrosActuales.precioMax,
            valoracionMin: filtrosActuales.valoracionMin
        },
        success: function (data) {
            if (acumular) {
                anuncios = anuncios.concat(data.anuncios);
            } else {
                anuncios = data.anuncios;
            }

            // Incrementamos la página actual para la próxima petición
            paginaActual++;

            if(data.hayMasPaginas) {
                $('#ver-mas-anuncios').show().prop('disabled', false).text('Ver más');
            }
            else {
                $('#ver-mas-anuncios').hide();
            }

            ordenarYRenderizar();
        },
        error: function () {
            alert('Error al cargar los anuncios. Por favor, inténtalo de nuevo.');
            $('#ver-mas-anuncios').prop('disabled', false).text('Ver más');
        }
    });
}

// ----- FUNCIÓN ORDENAR Y RENDERIZAR -----
// Ordena el array de anuncios según el criterio seleccionado y los pinta en pantalla.

function ordenarYRenderizar() {

    // Hacemos una copia del array para no modificar el original
    let anunciosOrdenados = [...anuncios];

    const orden = $('#ordenar-por').val();

   
    if (orden === 'precio-asc') {
        anunciosOrdenados.sort((a, b) => a.precio_hora - b.precio_hora);
    }
    else if (orden === 'precio-desc') {
        anunciosOrdenados.sort((a, b) => b.precio_hora - a.precio_hora);
    }
    else if (orden === 'mejor-valorados') {
        anunciosOrdenados.sort((a, b) => b.valoracion_media - a.valoracion_media);
    }
    else if (orden === 'predeterminado') {
        // El orden que nos ha dado el backend
        // No hacemos nada porque ya está en ese orden
    }
    console.log('Anuncios ordenados:', anunciosOrdenados);
    renderizarAnuncios(anunciosOrdenados);
}

// ----- FUNCIÓN AGRUPAR DISPONIBILIDAD -----
// Agrupa el array de disponibilidades por fecha (puntual) o día de la semana (recurrente).

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
    }
    else if (tipo === 'puntual/recurrente') {
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


// ----- FUNCIÓN RENDER DISPONIBILIDAD -----
// Devuelve un string HTML con la disponibilidad agrupada y formateada.

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


// ----- FUNCIÓN RENDERIZAR ANUNCIOS -----
// Limpia el contenedor y pinta los anuncios que le pasamos por parámetro.

function renderizarAnuncios(listaAnuncios) {
    const contenedor = $('#anuncios-container');
    contenedor.empty();

    if(listaAnuncios.length === 0) {
        contenedor.html('<div class="no-anuncios"><p>No se encontraron anuncios que coincidan con los filtros.</p></div>');
        return;
    }

    listaAnuncios.forEach(function(anuncio){
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
                        <a href="/contactar/${anuncio.id_anuncio}" id="btn-contacto">Contactar</a>
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

$(document).ready(function(){

    // Leemos query params para filtros preseleccionados (ej. desde servicios.ejs)
    const params = new URLSearchParams(window.location.search);
    const tipoServicioParam = params.get('tipoServicio');
    if (tipoServicioParam) {
        $('#filtro-tipo-servicio').val(tipoServicioParam);
        filtrosActuales.tipoServicio = tipoServicioParam;
    }

    // Cargamos los primeros anuncios nada más entrar
    fetchAnuncios(false);

    // Eventos filtros
    $('#boton-aplicar-filtros').click(function(){
        aplicarFiltros();
    });

    // Evento "Ver más"
    $('#ver-mas-anuncios').click(function(){
        fetchAnuncios(true);    // true = acumular, añadir al final del array
    });

    // Evento ordenar
    $('#ordenar-por').on('change', function(){
        console.log('Criterio de ordenación cambiado a:', $(this).val());
        ordenarYRenderizar();
    });
})
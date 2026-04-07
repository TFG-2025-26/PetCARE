"use strict";

// ---- VARIABLES GLOBALES ----
let empresas = [];
let paginaActual = 1;
let filtrosActuales = {
    nombre: '',
    tipoEmpresa: '',
    valoracionMin: ''
};

// ---- BOTONES FILTRO (selección única) ----
document.querySelectorAll('.btn-group-filtro').forEach(function(group) {
    group.querySelectorAll('.btn-filtro-opcion').forEach(function(btn) {
        btn.addEventListener('click', function() {
            group.querySelectorAll('.btn-filtro-opcion').forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo');
        });
    });
});

function getFiltroSeleccionado(groupId) {
    const activo = document.querySelector('#' + groupId + ' .btn-filtro-opcion.activo');
    return activo ? activo.dataset.value : '';
}

function abrirModalFiltros() {
    const modal = document.getElementById('modal-filtros-empresas');
    modal.classList.add('activo');
    modal.style.display = 'flex';
}

function cerrarModalFiltros() {
    const modal = document.getElementById('modal-filtros-empresas');
    modal.classList.remove('activo');
    modal.style.display = 'none';
}

// ---- APLICAR FILTROS (desde el modal) ----
function aplicarFiltros() {
    filtrosActuales.tipoEmpresa = getFiltroSeleccionado('filtro-tipo-empresa');
    filtrosActuales.valoracionMin = getFiltroSeleccionado('filtro-valoracion-empresa');
    filtrosActuales.nombre = $('#filtro-nombre-empresa').val().trim();
    empresas = [];
    paginaActual = 1;
    cerrarModalFiltros();
    fetchEmpresas(false);
}

// ---- FETCH EMPRESAS ----
function fetchEmpresas(acumular) {
    $('#ver-mas-empresas').prop('disabled', true).text('Cargando...');

    $.ajax({
        url: '/services/get-empresas',
        method: 'GET',
        data: {
            pagina: paginaActual,
            limite: 10,
            nombre: filtrosActuales.nombre,
            tipoEmpresa: filtrosActuales.tipoEmpresa,
            valoracionMin: filtrosActuales.valoracionMin
        },
        success: function(data) {
            if (acumular) {
                empresas = [...empresas, ...data.empresas];
            } else {
                empresas = data.empresas;
            }

            paginaActual++;

            if (data.hayMasPaginas) {
                $('#ver-mas-empresas').show().prop('disabled', false).text('Ver más');
            } else {
                $('#ver-mas-empresas').hide();
            }

            renderizarEmpresas(empresas);
        },
        error: function() {
            alert('Error al cargar las empresas. Por favor, inténtalo de nuevo.');
            $('#ver-mas-empresas').prop('disabled', false).text('Ver más');
        }
    });
}

// ---- TIPO LABEL ----
function getTipoLabel(tipo, tipo_otro) {
    const labels = {
        'clinica_veterinaria': 'Clínica Veterinaria',
        'hotel': 'Hotel para mascotas',
        'tienda_animal': 'Tienda de animales',
        'peluquería_canina': 'Peluquería canina',
        'otro': tipo_otro || 'Otro'
    };
    return labels[tipo] || tipo;
}

// ---- ESTRELLAS ----
function renderEstrellas(valoracion) {
    const redondeada = Math.round(valoracion);
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += i <= redondeada ? '★' : '☆';
    }
    return html;
}

// ---- RENDERIZAR EMPRESAS ----
function renderizarEmpresas(listaEmpresas) {
    const contenedor = $('#empresas-container');
    contenedor.empty();

    if (listaEmpresas.length === 0) {
        contenedor.html('<div class="no-empresas"><p>No se encontraron empresas que coincidan con los filtros.</p></div>');
        return;
    }

    listaEmpresas.forEach(function(empresa) {
        const foto = empresa.foto || '/images/empresa-default.jpg';
        const tipoLabel = getTipoLabel(empresa.tipo, empresa.tipo_otro);
        const estrellas = renderEstrellas(empresa.valoracion_media);
        const valoracionNum = parseFloat(empresa.valoracion_media).toFixed(1);

        const card = `
            <div class="tarjeta-empresa">
                <img src="${foto}" class="empresa-foto" alt="${empresa.nombre}">
                <div class="empresa-cuerpo">
                    <div class="empresa-header-info">
                        <h3 class="empresa-nombre">${empresa.nombre}</h3>
                        <span class="empresa-tipo-badge">${tipoLabel}</span>
                    </div>
                    <div class="empresa-valoracion">${estrellas} <span>(${valoracionNum})</span></div>
                    <p class="empresa-descripcion">${empresa.descripcion}</p>
                </div>
                <a href="/services/empresa/${empresa.id_empresa}" class="btn-ver-empresa">Ver perfil</a>
            </div>
        `;
        contenedor.append(card);
    });
}

// ---- DOCUMENT READY ----
$(document).ready(function() {

    // Leemos query params para filtros preseleccionados (ej. desde servicios.ejs)
    const params = new URLSearchParams(window.location.search);
    const tipoEmpresaParam = params.get('tipoEmpresa');
    if (tipoEmpresaParam) {
        filtrosActuales.tipoEmpresa = tipoEmpresaParam;
        const btn = document.querySelector('#filtro-tipo-empresa .btn-filtro-opcion[data-value="' + tipoEmpresaParam + '"]');
        if (btn) {
            document.querySelectorAll('#filtro-tipo-empresa .btn-filtro-opcion').forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo');
        }
    }

    fetchEmpresas(false);

    $('#aplicar-filtros-empresas').click(function() {
        aplicarFiltros();
    });

    $('#btn-buscar-empresa').click(function() {
        filtrosActuales.nombre = $('#filtro-nombre-empresa').val().trim();
        empresas = [];
        paginaActual = 1;
        fetchEmpresas(false);
    });

    $('#filtro-nombre-empresa').on('keypress', function(e) {
        if (e.which === 13) {
            filtrosActuales.nombre = $(this).val().trim();
            empresas = [];
            paginaActual = 1;
            fetchEmpresas(false);
        }
    });

    $('#ver-mas-empresas').click(function() {
        fetchEmpresas(true);
    });
});
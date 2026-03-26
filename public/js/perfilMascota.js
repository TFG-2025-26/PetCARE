"use strict";

const botonesCartilla = document.querySelectorAll('[data-seccion-cartilla]');
const seccionesCartilla = document.querySelectorAll('.seccion-cartilla');
const cartillaContenido = document.querySelector('.cartilla-contenido');

function activarSeccionCartilla(seccionId) {
    botonesCartilla.forEach(btn => {
        btn.classList.toggle('activa', btn.getAttribute('data-seccion-cartilla') === seccionId);
    });

    if (cartillaContenido) {
        cartillaContenido.classList.toggle('mostrando-todos', seccionId === 'todos');
    }

    if (seccionId === 'todos') {
        seccionesCartilla.forEach(seccion => seccion.classList.add('activa'));
        return;
    }

    seccionesCartilla.forEach(seccion => {
        seccion.classList.toggle('activa', seccion.id === seccionId);
    });
}

botonesCartilla.forEach(boton =>{
    boton.addEventListener('click', () =>{
        const seccionId = boton.getAttribute('data-seccion-cartilla');
        activarSeccionCartilla(seccionId);
    })
})

const acordeones = document.querySelectorAll('.acordeon-titulo');

acordeones.forEach(titulo => {
    titulo.addEventListener('click', () => {
        const seccion = titulo.parentElement;
        seccion.classList.toggle('abierta');
    });
});


const esMovil = window.matchMedia('(max-width: 750px)');

function actualizarFormatoCartilla() {
    const desktopViews = document.querySelectorAll('.js-desktop-view');
    const mobileViews = document.querySelectorAll('.js-mobile-view');
    const anadirRegistroMovil = document.querySelector('.añadir_registro_movil');

    desktopViews.forEach((view) => {
        view.hidden = esMovil.matches;
    });

    mobileViews.forEach((view) => {
        view.hidden = !esMovil.matches;
    });

    if (anadirRegistroMovil) {
        anadirRegistroMovil.hidden = !esMovil.matches;
    }
}

actualizarFormatoCartilla();
if (!esMovil.matches) {
    activarSeccionCartilla('todos');
}

esMovil.addEventListener('change', () => {
    actualizarFormatoCartilla();
    if (!esMovil.matches) {
        document.querySelectorAll('.seccion-cartilla').forEach(s => s.classList.remove('abierta'));
        activarSeccionCartilla('todos');
    }
});


function abrirModal(e){
    e.preventDefault();
    document.getElementById('modal').classList.add('activo');
}

function cerrarModal(){
    document.getElementById('modal').classList.remove('activo');
}



// Abre el modal de eliminación de un registro de la cartilla y carga dinámicamente el tipo, id y acción del registro seleccionado.
function abrirModalEliminarRegistro(enlace) {
    const modal = document.getElementById('modal-eliminar-registro');
    const formEliminarRegistro = document.getElementById('form-eliminar-registro');
    const inputIdEliminarRegistro = document.getElementById('input-id-eliminar-registro');
    const fraseRegistroModal = document.getElementById('frase-registro-modal');

    if (!modal || !formEliminarRegistro || !inputIdEliminarRegistro || !fraseRegistroModal) {
        return;
    }

    const tipoRegistro = enlace.dataset.tipoRegistro || 'registro';
    const idRegistro = enlace.dataset.idRegistro || '';
    const idName = enlace.dataset.idName || 'id';

    const etiquetasRegistro = {
        cita: { articulo: 'esta', nombre: 'cita' },
        vacuna: { articulo: 'esta', nombre: 'vacuna' },
        tratamiento: { articulo: 'este', nombre: 'tratamiento' },
        patologia: { articulo: 'esta', nombre: 'patología' }
    };

    const etiqueta = etiquetasRegistro[tipoRegistro] || { articulo: 'este', nombre: tipoRegistro };

    formEliminarRegistro.action = enlace.getAttribute('href') || '';
    inputIdEliminarRegistro.name = idName;
    inputIdEliminarRegistro.value = idRegistro;
    fraseRegistroModal.textContent = `${etiqueta.articulo} ${etiqueta.nombre}`;

    modal.classList.add('activo');
}

function cerrarModalEliminarRegistro() {
    const modal = document.getElementById('modal-eliminar-registro');

    if (modal) {
        modal.classList.remove('activo');
    }
}

// Selecciona todos los botones de eliminar de la cartilla.
const botonesEliminarRegistro = document.querySelectorAll('.js-abrir-modal-eliminar-registro');

botonesEliminarRegistro.forEach((enlace) => {
    enlace.addEventListener('click', (event) => {
        event.preventDefault();
        // Abre el modal con los datos del registro seleccionado.
        abrirModalEliminarRegistro(enlace);
    });
});

//Cerrar el modal cuando se hace click fuera
document.getElementById('modal').addEventListener('click', function(e){
    if (e.target === this) cerrarModal();
});

document.getElementById('modal-eliminar-registro').addEventListener('click', function(e){
    if (e.target === this) cerrarModalEliminarRegistro();
});
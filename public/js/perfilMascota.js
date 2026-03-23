"use strict";

const botonesCartilla = document.querySelectorAll('[data-seccion-cartilla]');
const seccionesCartilla = document.querySelectorAll('.seccion-cartilla');

botonesCartilla.forEach(boton =>{
    boton.addEventListener('click', () =>{
        botonesCartilla.forEach(btn => btn.classList.remove('activa'));
        seccionesCartilla.forEach(seccion => seccion.classList.remove('activa'));

        const seccionId = boton.getAttribute('data-seccion-cartilla');
        document.getElementById(seccionId).classList.add('activa');
        boton.classList.add('activa');
    })
})

const acordeones = document.querySelectorAll('.acordeon-titulo');

acordeones.forEach(titulo => {
    titulo.addEventListener('click', () => {
        const seccion = titulo.parentElement;
        seccion.classList.toggle('abierta');
    });
});


const esMovil = window.matchMedia('(max-width: 600px)');

esMovil.addEventListener('change', () => {
    if (!esMovil.matches) {
        document.querySelectorAll('.seccion-cartilla').forEach(s => s.classList.remove('abierta'));
        botonesCartilla[0].click();
    }
});


function abrirModal(e){
    e.preventDefault();
    document.getElementById('modal').classList.add('activo');
}

function cerrarModal(){
    document.getElementById('modal').classList.remove('activo');
}

function confirmar(){
    //TODO logica de confirmar la eliminación
    cerrarModal();
}

//Cerrar el modal cuando se hace click fuera
document.getElementById('modal').addEventListener('click', function(e){
    if (e.target === this) cerrarModal();
});
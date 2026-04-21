"use strict";

const modal = document.getElementById('modal-cancelar-cita');
let citaIdSeleccionada = null;

function abrirModal(id) {
    citaIdSeleccionada = id;
    modal.style.display = 'flex';
}

function cerrarModal() {
    citaIdSeleccionada = null;
    modal.style.display = 'none';
}

document.querySelectorAll('.btn-cancelar-cita').forEach(btn => {
    btn.addEventListener('click', () => abrirModal(btn.dataset.id));
});

document.getElementById('modal-cancelar-cita-cerrar').addEventListener('click', cerrarModal);
document.getElementById('modal-cancelar-cita-no').addEventListener('click', cerrarModal);

modal.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModal();
});

document.getElementById('modal-cancelar-cita-si').addEventListener('click', async () => {
    if (!citaIdSeleccionada) return;

    try {
        const res = await fetch(`/services/citas/${citaIdSeleccionada}/cancelar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) throw new Error('Error al cancelar');

        const tarjeta = document.querySelector(`.btn-cancelar-cita[data-id="${citaIdSeleccionada}"]`)?.closest('.cita');
        if (tarjeta) {
            const contenido = tarjeta.closest('.citas-contenido');
            tarjeta.remove();

            if (contenido && contenido.querySelectorAll('.cita').length === 0) {
                const vacio = document.createElement('div');
                vacio.className = 'citas-vacio';
                vacio.innerHTML = '<p>No tienes citas programadas.</p>';
                contenido.replaceWith(vacio);
            }
        }

        cerrarModal();
    } catch (err) {
        console.error(err);
        alert('No se pudo cancelar la cita. Inténtalo de nuevo.');
    }
});
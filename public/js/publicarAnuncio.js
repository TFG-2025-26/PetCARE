"use strict";


document.getElementById('btn-add-franja').addEventListener('click', () => {
    const contenedorFranjas = document.getElementById('franjas-container');
    const index = contenedorFranjas.children.length;

    if (index >= 10){
        document.getElementById('btn-add-franja').disabled = true;
        document.getElementById('btn-add-franja').textContent = 'Máximo 10 franjas';
        document.getElementById('btn-add-franja').classList.add('disabled');
        return;
    }

    const nuevaFranja = document.createElement('div');
    nuevaFranja.classList.add('franja');

    nuevaFranja.innerHTML = `<div class="form-group">
                            <label>Fecha</label>
                            <input type="date" name="disponibilidad[${index}][fecha]" required>
                            <span class="error" id="error-fecha-${index}"></span>
                        </div>
                        <div class="form-group">
                            <label>Hora inicio</label>
                            <input type="time" name="disponibilidad[${index}][hora_inicio]" required>
                            <span class="error" id="error-hora_inicio-${index}"></span>
                        </div>
                        <div class="form-group">
                            <label>Hora fin</label>
                            <input type="time" name="disponibilidad[${index}][hora_fin]" required>
                            <span class="error" id="error-hora_fin-${index}"></span>
                        </div>
                        <button type="button" class="franja-eliminar" aria-label="Eliminar franja">&times;</button>`;
    contenedorFranjas.appendChild(nuevaFranja);
    actualizarBotonesEliminar();
});


const actualizarBotonesEliminar = () => {
    const franjas = document.querySelectorAll('#franjas-container .franja');
    franjas.forEach(franja => {
        franja.querySelector('.franja-eliminar').style.visibility = franjas.length > 1 ? 'visible' : 'hidden';
    });
};

document.getElementById('franjas-container').addEventListener('click', (e) => {
    if (!e.target.classList.contains('franja-eliminar')) return;
    e.target.closest('.franja').remove();
    const btn = document.getElementById('btn-add-franja');
    btn.disabled = false;
    btn.textContent = '+ Añadir franja';
    btn.classList.remove('disabled');
    actualizarBotonesEliminar();
});

const actualizarBotonesEliminarSlot = (dia) => {
    const slots = document.getElementById(`slots-${dia}`).querySelectorAll('.franja-recurrente');
    slots.forEach(slot => {
        slot.querySelector('.franja-eliminar-slot').style.visibility = slots.length > 1 ? 'visible' : 'hidden';
    });
};

const toggleDia = (dia, checked) => {
    const container = document.getElementById(`franjas-${dia}`);
    container.style.display = checked ? '' : 'none';

    if (checked) limpiarError('error-dias');

    // Habilitar/deshabilitar inputs para que no se envíen cuando el día está oculto
    document.getElementById(`slots-${dia}`).querySelectorAll('input').forEach(input => {
        input.disabled = !checked;
    });

    if (!checked) {
        // Al desmarcar: quitar el segundo slot si existe y reactivar el botón añadir
        const slots = document.getElementById(`slots-${dia}`);
        // Limpiar errores de todos los slots antes de eliminarlos
        slots.querySelectorAll('.error').forEach(span => limpiarError(span.id));
        while (slots.children.length > 1) {
            slots.removeChild(slots.lastChild);
        }
        // Limpiar los inputs y errores del primer slot
        slots.querySelectorAll('input').forEach(input => {
            input.value = '';
        });
        limpiarError(`error-rec-inicio-${dia}-0`);
        limpiarError(`error-rec-fin-${dia}-0`);
        container.querySelector('.btn-add-slot-dia').disabled = false;
        actualizarBotonesEliminarSlot(dia);
    }
};

document.getElementById('franjas-recurrente-container').addEventListener('click', (e) => {
    // Añadir segundo slot
    if (e.target.classList.contains('btn-add-slot-dia')) {
        const dia = e.target.dataset.dia;
        const slots = document.getElementById(`slots-${dia}`);
        if (slots.children.length >= 2) return;

        const nuevaFranjaSlot = document.createElement('div');
        nuevaFranjaSlot.classList.add('franja-recurrente');
        nuevaFranjaSlot.innerHTML = `
            <div class="form-group">
                <label>Hora inicio</label>
                <input type="time" name="recurrente[${dia}][1][hora_inicio]">
                <span class="error" id="error-rec-inicio-${dia}-1"></span>
            </div>
            <div class="form-group">
                <label>Hora fin</label>
                <input type="time" name="recurrente[${dia}][1][hora_fin]">
                <span class="error" id="error-rec-fin-${dia}-1"></span>
            </div>
            <button type="button" class="franja-eliminar franja-eliminar-slot" aria-label="Eliminar franja">&times;</button>
        `;
        slots.appendChild(nuevaFranjaSlot);
        e.target.disabled = true;
        actualizarBotonesEliminarSlot(dia);
    }

    // Eliminar segundo slot
    if (e.target.classList.contains('franja-eliminar-slot')) {
        const franja = e.target.closest('.franja-recurrente');
        const container = franja.closest('.dia-franjas');
        const dia = container.dataset.dia;
        franja.remove();
        container.querySelector('.btn-add-slot-dia').disabled = false;
        actualizarBotonesEliminarSlot(dia);
    }
});

const seleccionarTipo = (tipo) => {
    document.getElementById('opt-puntual').classList.toggle('active', tipo === 'puntual');
    document.getElementById('opt-recurrente').classList.toggle('active', tipo === 'recurrente');
    document.getElementById('seccion-puntual').style.display = tipo === 'puntual' ? '' : 'none';
    document.getElementById('seccion-recurrente').style.display = tipo === 'recurrente' ? '' : 'none';
  
    const form = document.getElementById('form-anuncio');
    const inputTipo = document.getElementById('input-tipo');


    inputTipo.value = tipo;
    form.style.display = '';
}


// Validación

function mostrarError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
}

function limpiarError(id) {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
}

function validarTipoServicio() {
    const val = document.getElementById('tipo_servicio').value;
    if (!val) {
        mostrarError('error-tipo_servicio', 'El tipo de servicio es obligatorio.');
        return false;
    }
    limpiarError('error-tipo_servicio');
    return true;
}

function validarTipoMascota() {
    const val = document.getElementById('tipo_mascota').value;
    if (!val) {
        mostrarError('error-tipo_mascota', 'El tipo de mascota es obligatorio.');
        return false;
    }
    limpiarError('error-tipo_mascota');
    return true;
}

function validarPrecio() {
    const val = document.getElementById('precio_hora').value;
    if (val === '') {
        mostrarError('error-precio_hora', 'El precio por hora es obligatorio.');
        return false;
    }
    if (Number(val) < 0 || Number(val) > 999) {
        mostrarError('error-precio_hora', 'El precio debe estar entre 0 y 999.');
        return false;
    }
    limpiarError('error-precio_hora');
    return true;
}

function validarDescripcion() {
    const val = document.getElementById('descripcion').value.trim();
    if (val.length > 500) {
        mostrarError('error-descripcion', 'La descripción no puede superar los 500 caracteres.');
        return false;
    }
    limpiarError('error-descripcion');
    return true;
}

function validarDisponibilidadPuntual() {
    const franjas = document.querySelectorAll('#franjas-container .franja');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    let ok = true;

    franjas.forEach((franja, i) => {
        const fechaInput = franja.querySelector(`input[name="disponibilidad[${i}][fecha]"]`);
        const inicioInput = franja.querySelector(`input[name="disponibilidad[${i}][hora_inicio]"]`);
        const finInput   = franja.querySelector(`input[name="disponibilidad[${i}][hora_fin]"]`);

        // Fecha
        if (!fechaInput.value) {
            mostrarError(`error-fecha-${i}`, 'La fecha es obligatoria.');
            ok = false;
        } else {
            const fecha = new Date(fechaInput.value + 'T00:00:00');
            if (fecha < hoy) {
                mostrarError(`error-fecha-${i}`, 'La fecha no puede ser anterior a hoy.');
                ok = false;
            } else {
                limpiarError(`error-fecha-${i}`);
            }
        }

        // Hora inicio
        if (!inicioInput.value) {
            mostrarError(`error-hora_inicio-${i}`, 'La hora de inicio es obligatoria.');
            ok = false;
        } else {
            limpiarError(`error-hora_inicio-${i}`);
        }

        // Hora fin
        if (!finInput.value) {
            mostrarError(`error-hora_fin-${i}`, 'La hora de fin es obligatoria.');
            ok = false;
        } else if (inicioInput.value && finInput.value <= inicioInput.value) {
            mostrarError(`error-hora_fin-${i}`, 'La hora de fin debe ser posterior a la de inicio.');
            ok = false;
        } else {
            limpiarError(`error-hora_fin-${i}`);
        }
    });

    return ok;
}

function validarDisponibilidadRecurrente() {
    const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    const algunDia = dias.some(dia => {
        const container = document.getElementById(`franjas-${dia}`);
        return container && container.style.display !== 'none';
    });

    if (!algunDia) {
        mostrarError('error-dias', 'Debes seleccionar al menos un día de la semana.');
        return false;
    }
    limpiarError('error-dias');

    let ok = true;
    dias.forEach(dia => {
        const container = document.getElementById(`franjas-${dia}`);
        if (!container || container.style.display === 'none') return;

        const slots = document.getElementById(`slots-${dia}`).querySelectorAll('.franja-recurrente');
        slots.forEach((slot, i) => {
            const inicioInput = slot.querySelector(`input[name="recurrente[${dia}][${i}][hora_inicio]"]`);
            const finInput    = slot.querySelector(`input[name="recurrente[${dia}][${i}][hora_fin]"]`);

            if (!inicioInput || !finInput) return;

            if (!inicioInput.value) {
                mostrarError(`error-rec-inicio-${dia}-${i}`, 'La hora de inicio es obligatoria.');
                ok = false;
            } else {
                limpiarError(`error-rec-inicio-${dia}-${i}`);
            }

            if (!finInput.value) {
                mostrarError(`error-rec-fin-${dia}-${i}`, 'La hora de fin es obligatoria.');
                ok = false;
            } else if (finInput.value <= inicioInput.value) {
                mostrarError(`error-rec-fin-${dia}-${i}`, 'La hora de fin debe ser posterior a la de inicio.');
                ok = false;
            } else {
                limpiarError(`error-rec-fin-${dia}-${i}`);
            }
        });
    });

    return ok;
}

document.getElementById('form-anuncio').addEventListener('submit', (e) => {
    const tipo = document.getElementById('input-tipo').value;

    const camposOk = [
        validarTipoServicio(),
        validarTipoMascota(),
        validarPrecio(),
        validarDescripcion(),
        tipo === 'puntual' ? validarDisponibilidadPuntual() : validarDisponibilidadRecurrente()
    ].every(Boolean);

    if (!camposOk) e.preventDefault();
});

// Validación en tiempo real
document.getElementById('tipo_servicio').addEventListener('change', validarTipoServicio);
document.getElementById('tipo_mascota').addEventListener('change', validarTipoMascota);
document.getElementById('precio_hora').addEventListener('input', validarPrecio);
document.getElementById('descripcion').addEventListener('input', validarDescripcion); 
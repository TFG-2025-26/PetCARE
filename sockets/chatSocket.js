"use strict";

const pool = require('../db');

/*
 * Valida los datos de una solicitud de cita (contenido JSON del mensaje).
 * Devuelve un array de { msg } con los errores encontrados, vacío si todo es correcto.
 */
function validarDatosCita(mensajeJSON) {
    const errores = [];
    let datosCita;

    try {
        datosCita = JSON.parse(mensajeJSON);
    } catch (e) {
        errores.push({ msg: 'El formato de la solicitud de cita no es válido.' });
        return errores;
    }

    const { fecha, hora_inicio, hora_fin, precio_hora } = datosCita;

    // Fecha
    if (!fecha) {
        errores.push({ msg: 'La fecha es obligatoria.' });
    } else {
        const fechaObj = new Date(fecha + 'T00:00:00');
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        if (isNaN(fechaObj.getTime())) {
            errores.push({ msg: 'La fecha no es válida.' });
        } else if (fechaObj < hoy) {
            errores.push({ msg: 'La fecha no puede ser anterior a hoy.' });
        }
    }

    // Hora inicio
    if (!hora_inicio) {
        errores.push({ msg: 'La hora de inicio es obligatoria.' });
    } else if (!/^\d{2}:\d{2}(:\d{2})?$/.test(hora_inicio)) {
        errores.push({ msg: 'El formato de la hora de inicio no es válido.' });
    }

    // Hora fin
    if (!hora_fin) {
        errores.push({ msg: 'La hora de fin es obligatoria.' });
    } else if (!/^\d{2}:\d{2}(:\d{2})?$/.test(hora_fin)) {
        errores.push({ msg: 'El formato de la hora de fin no es válido.' });
    } else if (hora_inicio && hora_fin <= hora_inicio) {
        errores.push({ msg: 'La hora de fin debe ser posterior a la hora de inicio.' });
    }

    // Precio hora
    if (precio_hora === undefined || precio_hora === null || precio_hora === '') {
        errores.push({ msg: 'El precio por hora es obligatorio.' });
    } else {
        const precio = parseFloat(precio_hora);
        if (isNaN(precio) || precio < 0) {
            errores.push({ msg: 'El precio por hora no puede ser negativo.' });
        } else if (precio > 999) {
            errores.push({ msg: 'El precio por hora no puede superar los 999 €.' });
        }
    }

    return errores;
}

module.exports = (io) => {

    // Mapa de sockets activos: socket.id → datos del usuario conectado
    const usuariosConectados = {};

    io.on('connection', (socket) => {
        console.log('Cliente conectado:', socket.id);

        // ── Evento 1: Usuario se une a la conversación ──────────────────────────
        // El cliente emite 'unirse_chat' al cargar la página del chat.
        // Se crea/une a una sala única por par de usuarios + anuncio.
        socket.on('unirse_chat', (datos) => {
            console.log('Usuario se une al chat:', datos);

            // Nombre de sala: chat_idMenor_idMayor_aAnuncioId
            // Esto garantiza que (1,2) y (2,1) acaban en la misma sala
            const roomName = crearNombreRoom(datos.usuario_id, datos.usuario_destino_id, datos.anuncio_id);

            // Guardar datos del socket para poder buscarlo más adelante
            // (p.ej. al notificar que un mensaje fue leído)
            usuariosConectados[socket.id] = {
                usuario_id: datos.usuario_id,
                usuario_nombre: datos.usuario_nombre,
                socket_id: socket.id,
                usuario_destino_id: datos.usuario_destino_id,
                anuncio_id: datos.anuncio_id,
                chat_id: datos.chat_id
            };

            // Unir el socket a la sala
            socket.join(roomName);
            console.log(`Usuario ${datos.usuario_nombre} se unió a la sala ${roomName}`);

            // Notificar al otro usuario (si ya está en la sala) que estamos en línea
            socket.broadcast.to(roomName).emit('usuario_en_linea');

            // Si el otro usuario ya estaba conectado, notificarnos también a nosotros
            const otroUsuarioConectado = Object.values(usuariosConectados).find(
                u => u.usuario_id === datos.usuario_destino_id && u.anuncio_id === datos.anuncio_id
            );
            if (otroUsuarioConectado) {
                socket.emit('usuario_en_linea');
            }
        });

        // ── Evento 2: Recibir mensaje, guardar en BD y retransmitir ─────────────
        // El cliente emite 'enviar_mensaje' al pulsar Enviar o presionar Enter.
        // El mensaje se persiste en la tabla `mensajes` antes de retransmitirse.
        socket.on('enviar_mensaje', (datos) => {
            console.log('Mensaje recibido para guardar en BD:', datos);

            const tipo = datos.tipo_mensaje || 'texto';

            // ── Validación de tipo ────────────────────────────────────────────────
            if (!['texto', 'cita'].includes(tipo)) {
                socket.emit('cita_error', { error: 'Tipo de mensaje no válido.', errores: [] });
                return;
            }

            // ── Validación de mensaje de texto ────────────────────────────────────
            if (tipo === 'texto' && (!datos.mensaje || !datos.mensaje.trim())) {
                socket.emit('cita_error', { error: 'El mensaje no puede estar vacío.', errores: [] });
                return;
            }

            // ── Validación de datos de cita (sincróna) ────────────────────────────
            if (tipo === 'cita') {
                const erroresCita = validarDatosCita(datos.mensaje);
                if (erroresCita.length > 0) {
                    socket.emit('cita_error', {
                        error: 'Por favor, corrige los errores en el formulario.',
                        errores: erroresCita
                    });
                    return;
                }
            }

            // Crear nombre de sala para saber a quién retransmitir
            const roomName = crearNombreRoom(datos.usuario_id, datos.usuario_destino_id, datos.anuncio_id);

            pool.getConnection((err, connection) => {
                if (err) {
                    console.error('Error de conexión al guardar mensaje:', err);
                    return;
                }

                // ── Validación en BD: usuarios activos y chat activo ──────────────
                connection.query(
                    `SELECT
                        (SELECT COUNT(*) FROM usuarios WHERE id_usuario = ? AND activo = 1 AND ban = 0) AS usuario_ok,
                        (SELECT COUNT(*) FROM usuarios WHERE id_usuario = ? AND activo = 1 AND ban = 0) AS destino_ok,
                        (SELECT COUNT(*) FROM chats WHERE id_chat = ? AND activo = 1) AS chat_ok`,
                    [datos.usuario_id, datos.usuario_destino_id, datos.chat_id],
                    (err, results) => {
                        if (err) {
                            connection.release();
                            console.error('Error al verificar usuarios/chat:', err);
                            return;
                        }

                        const { usuario_ok, destino_ok, chat_ok } = results[0];
                        const erroresDB = [];
                        if (!usuario_ok) erroresDB.push({ msg: 'Tu cuenta no está activa.' });
                        if (!destino_ok) erroresDB.push({ msg: 'El usuario destinatario no está activo.' });
                        if (!chat_ok) erroresDB.push({ msg: 'El chat no está disponible.' });

                        if (erroresDB.length > 0) {
                            connection.release();
                            socket.emit('cita_error', {
                                error: 'No se puede enviar el mensaje.',
                                errores: erroresDB
                            });
                            return;
                        }

                        // ── Insertar mensaje ──────────────────────────────────────
                        connection.query(
                            'INSERT INTO mensajes (tipo_mensaje, contenido, fecha, leido, id_chat, id_usuario) VALUES (?, ?, NOW(), 0, ?, ?)',
                            [tipo, datos.mensaje, datos.chat_id, datos.usuario_id],
                            (err, result) => {
                                connection.release();
                                if (err) {
                                    console.error('Error al guardar mensaje en BD:', err);
                                    return;
                                }

                                const objetoMensaje = {
                                    id_mensaje: result.insertId,
                                    usuario_id: datos.usuario_id,
                                    usuario_nombre: datos.usuario_nombre,
                                    mensaje: datos.mensaje,
                                    chat_id: datos.chat_id,
                                    fecha: new Date(),
                                    tipo_mensaje: tipo
                                };

                                // Enviar el mensaje al destinatario (broadcast excluye al emisor)
                                socket.broadcast.to(roomName).emit('mensaje_recibido', objetoMensaje);
                                // Confirmar al emisor con el id_mensaje de BD (para asignar data-id al DOM)
                                socket.emit('mensaje_enviado_confirmado', objetoMensaje);

                                console.log(`Mensaje guardado (id: ${result.insertId}) y enviado a sala: ${roomName}`);
                            }
                        );
                    }
                );
            });
        });

        // ── Evento 3: Marcar mensaje como leído ─────────────────────────────────
        // El cliente emite 'mensaje_leido' cuando el último mensaje ajeno es visible
        // en pantalla (detectado con IntersectionObserver en chat.js).
        // Se actualiza leido=1 en BD y se notifica al emisor original.
        socket.on('mensaje_leido', (datos) => {
            // datos: { id_mensaje, chat_id, anuncio_id, usuario_emisor_id }
            console.log('Marcando mensaje como leído:', datos.id_mensaje);
            pool.getConnection((err, connection) => {
                if (err) return;
                // Marcar como leídos todos los mensajes del emisor en este chat hasta este id
                connection.query(
                    'UPDATE mensajes SET leido = 1 WHERE id_chat = ? AND id_mensaje <= ? AND leido = 0 AND id_usuario = ?',
                    [datos.chat_id, datos.id_mensaje, datos.usuario_emisor_id],
                    (err, result) => {
                        connection.release();
                        if (err || result.affectedRows === 0) return; // ya estaba leído o error

                        // Buscar el socket del emisor original para notificarle
                        const emisor = Object.values(usuariosConectados).find(
                            u => u.usuario_id === datos.usuario_emisor_id && u.anuncio_id === datos.anuncio_id
                        );
                        if (emisor) {
                            console.log(`Notificando a usuario ${datos.usuario_emisor_id} que su mensaje ${datos.id_mensaje} fue leído`);
                            io.to(emisor.socket_id).emit('mensaje_visto', { id_mensaje: datos.id_mensaje });
                        }
                    }
                );
            });
        });

        // ── Evento 4: Aceptar cita ───────────────────────────────────
        socket.on('aceptar_cita', (datos) => {
            console.log('Evento aceptar_cita recibido:', datos);
            const { id_mensaje, chat_id, anuncio_id, usuario_id, usuario_destino_id } = datos;
            const roomName = crearNombreRoom(usuario_id, usuario_destino_id, anuncio_id);

            pool.getConnection((err, connection) => {
                if (err) {
                    console.error('Error al conectar con la base de datos:', err);
                    return;
                }

                connection.query(
                    'SELECT contenido FROM mensajes WHERE id_mensaje = ? AND id_chat = ?',
                    [id_mensaje, chat_id],
                    (err, results) => {
                        if (err || results.length === 0) {
                            connection.release();
                            console.error('Error al obtener el mensaje de la cita:', err);
                            return;
                        }

                        try {
                            const datosCita = JSON.parse(results[0].contenido);
                            datosCita.estado = 'aceptada';

                            connection.query(
                                'INSERT INTO reservas (id_cliente, id_proveedor, fecha, hora_inicio, hora_fin, precio_hora, id_chat) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                [usuario_destino_id, usuario_id, datosCita.fecha, datosCita.hora_inicio, datosCita.hora_fin, datosCita.precio_hora, chat_id],
                                (err) => {
                                    if (err) {
                                        connection.release();
                                        console.error('Error al insertar reserva:', err);
                                        return;
                                    }

                                    connection.query(
                                        'UPDATE mensajes SET contenido = ? WHERE id_mensaje = ?',
                                        [JSON.stringify(datosCita), id_mensaje],
                                        (err) => {
                                            connection.release();
                                            if (err) {
                                                console.error('Error al actualizar estado de la cita:', err);
                                                return;
                                            }
                                            io.to(roomName).emit('cita_estado_actualizado', { id_mensaje, nuevo_estado: 'aceptada' });
                                        }
                                    );
                                }
                            );
                        } catch (e) {
                            connection.release();
                            console.error('Error al parsear JSON de la cita:', e);
                        }
                    }
                );
            });
        });

        // ── Evento 5: Rechazar cita ───────────────────────────────────
        socket.on('rechazar_cita', (datos) => {
            console.log('Evento rechazar_cita recibido:', datos);
            const { id_mensaje, chat_id, anuncio_id, usuario_id, usuario_destino_id } = datos;
            const roomName = crearNombreRoom(usuario_id, usuario_destino_id, anuncio_id);

            pool.getConnection((err, connection) => {
                if (err) {
                    console.error('Error al conectar con la base de datos:', err);
                    return;
                }

                connection.query(
                    'SELECT contenido FROM mensajes WHERE id_mensaje = ? AND id_chat = ?',
                    [id_mensaje, chat_id],
                    (err, results) => {
                        if (err || results.length === 0) {
                            connection.release();
                            console.error('Error al obtener el mensaje de la cita:', err);
                            return;
                        }

                        try {
                            const datosCita = JSON.parse(results[0].contenido);
                            datosCita.estado = 'rechazada';

                            connection.query(
                                'UPDATE mensajes SET contenido = ? WHERE id_mensaje = ?',
                                [JSON.stringify(datosCita), id_mensaje],
                                (err) => {
                                    connection.release();
                                    if (err) {
                                        console.error('Error al actualizar estado de la cita:', err);
                                        return;
                                    }
                                    io.to(roomName).emit('cita_estado_actualizado', { id_mensaje, nuevo_estado: 'rechazada' });
                                }
                            );
                        } catch (e) {
                            connection.release();
                            console.error('Error al parsear JSON de la cita:', e);
                        }
                    }
                );
            });
        });

        // ── Evento 6: Solicitar finalizar servicio ───────────────────────────────
        // El cliente emite 'solicitar_finalizar' al pulsar el botón "Finalizar servicio".
        // Se marca en BD qué usuario lo solicitó. Si ambos lo han solicitado, se archiva
        // el chat (activo=0) y se notifica a la sala con 'chat_finalizado'.
        // Si solo uno, se emite 'finalizacion_pendiente' a la sala.
        socket.on('solicitar_finalizar', (datos) => {
            const { chat_id, usuario_id, usuario_destino_id, anuncio_id } = datos;
            console.log(`solicitar_finalizar: usuario ${usuario_id}, chat ${chat_id}`);
            const roomName = crearNombreRoom(usuario_id, usuario_destino_id, anuncio_id);

            pool.getConnection((err, connection) => {
                if (err) {
                    console.error('Error de conexión al finalizar servicio:', err);
                    return;
                }

                // Determinar qué usuario es el "mínimo" (usuario1) y cuál el "máximo" (usuario2)
                connection.query(
                    `SELECT MIN(id_usuario) AS u_min, MAX(id_usuario) AS u_max
                     FROM chat_usuario WHERE id_chat = ?`,
                    [chat_id],
                    (err, rows) => {
                        if (err || !rows.length) {
                            connection.release();
                            console.error('Error al obtener participantes del chat:', err);
                            return;
                        }

                        const { u_min, u_max } = rows[0];
                        const columna = usuario_id === u_min ? 'finalizar_usuario1' : 'finalizar_usuario2';

                        // Marcar que este usuario solicita finalizar
                        connection.query(
                            `UPDATE chats SET ${columna} = 1 WHERE id_chat = ? AND activo = 1`,
                            [chat_id],
                            (err, result) => {
                                if (err || result.affectedRows === 0) {
                                    connection.release();
                                    console.error('Error al marcar finalización o chat ya inactivo:', err);
                                    return;
                                }

                                // Comprobar si ambos han solicitado finalizar
                                connection.query(
                                    'SELECT finalizar_usuario1, finalizar_usuario2 FROM chats WHERE id_chat = ?',
                                    [chat_id],
                                    (err, chatRows) => {
                                        if (err || !chatRows.length) {
                                            connection.release();
                                            return;
                                        }

                                        const { finalizar_usuario1, finalizar_usuario2 } = chatRows[0];

                                        if (finalizar_usuario1 && finalizar_usuario2) {
                                            // Ambos confirmaron → archivar el chat
                                            connection.query(
                                                'UPDATE chats SET activo = 0 WHERE id_chat = ?',
                                                [chat_id],
                                                (err) => {
                                                    connection.release();
                                                    if (err) {
                                                        console.error('Error al archivar el chat:', err);
                                                        return;
                                                    }
                                                    console.log(`Chat ${chat_id} archivado por acuerdo mutuo`);
                                                    io.to(roomName).emit('chat_finalizado');
                                                }
                                            );
                                        } else {
                                            connection.release();
                                            // Solo uno ha solicitado → notificar a la sala
                                            io.to(roomName).emit('finalizacion_pendiente', { usuario_id });
                                        }
                                    }
                                );
                            }
                        );
                    }
                );
            });
        });

        // ── Evento 7: Usuario se desconecta ─────────────────────────────────────
        socket.on('disconnect', () => {
            const usuario = usuariosConectados[socket.id];
            if (usuario && usuario.usuario_destino_id) {
                // Avisar al otro usuario de la sala que nos fuimos
                const roomName = crearNombreRoom(usuario.usuario_id, usuario.usuario_destino_id, usuario.anuncio_id);
                io.to(roomName).emit('usuario_desconectado');
            }
            delete usuariosConectados[socket.id];
            console.log('Cliente desconectado:', socket.id);
        });
    });
};

/*
 * Genera un nombre único para la sala de chat entre dos usuarios.
 * El orden de los IDs no importa: crearNombreRoom(1,2,5) === crearNombreRoom(2,1,5)
 * Se incluye el anuncio_id para que el mismo par de usuarios pueda tener
 * conversaciones distintas sobre anuncios distintos.
 */
function crearNombreRoom(usuarioId1, usuarioId2, anuncioId) {
    const ids = [usuarioId1, usuarioId2].sort((a, b) => a - b);
    return `chat_${ids[0]}_${ids[1]}_a${anuncioId}`;
}
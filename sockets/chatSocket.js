"use strict";

const pool = require('../db');

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

            // Crear nombre de sala para saber a quién retransmitir
            const roomName = crearNombreRoom(datos.usuario_id, datos.usuario_destino_id, datos.anuncio_id);

            pool.getConnection((err, connection) => {
                if (err) {
                    console.error('Error de conexión al guardar mensaje:', err);
                    return;
                }
                connection.query(
                    'INSERT INTO mensajes (contenido, fecha, leido, id_chat, id_usuario) VALUES (?, NOW(), 0, ?, ?)',
                    [datos.mensaje, datos.chat_id, datos.usuario_id],
                    (err, result) => {
                        connection.release();
                        if (err) {
                            console.error('Error al guardar mensaje en BD:', err);
                            return;
                        }

                        const objetoMensaje = {
                            id_mensaje: result.insertId, // id real de BD
                            usuario_id: datos.usuario_id,
                            usuario_nombre: datos.usuario_nombre,
                            mensaje: datos.mensaje,
                            chat_id: datos.chat_id,
                            fecha: new Date()
                        };

                        // Enviar el mensaje al destinatario (broadcast excluye al emisor)
                        socket.broadcast.to(roomName).emit('mensaje_recibido', objetoMensaje);
                        // Confirmar al emisor con el id_mensaje de BD (para asignar data-id al DOM)
                        socket.emit('mensaje_enviado_confirmado', objetoMensaje);

                        console.log(`Mensaje guardado (id: ${result.insertId}) y enviado a sala: ${roomName}`);
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
                // Solo actualizamos si todavía no estaba marcado (leido = 0)
                connection.query(
                    'UPDATE mensajes SET leido = 1 WHERE id_mensaje = ? AND leido = 0',
                    [datos.id_mensaje],
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

        // ── Evento 4: Usuario se desconecta ─────────────────────────────────────
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
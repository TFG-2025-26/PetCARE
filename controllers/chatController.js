"use strict";
const pool = require('../db');
const { createHttpError } = require('../handlers/httpErrors');

// Número de mensajes que se devuelven por página en el historial
const MENSAJES_POR_PAGINA = 30;

/*
 * Busca un chat activo entre los dos usuarios para el anuncio dado.
 * Si no existe, crea la fila en `chats` y las dos filas en `chat_usuario`.
 * Devuelve el id_chat resultante vía callback(err, idChat).
 */
function obtenerOCrearChat(connection, usuarioActualId, usuarioDestinoId, anuncioId, callback) {
    const queryBuscar = `
        SELECT c.id_chat
        FROM chats c
        JOIN chat_usuario cu1 ON cu1.id_chat = c.id_chat AND cu1.id_usuario = ?
        JOIN chat_usuario cu2 ON cu2.id_chat = c.id_chat AND cu2.id_usuario = ?
        WHERE c.id_anuncio = ? AND c.activo = 1
        LIMIT 1
    `;
    connection.query(queryBuscar, [usuarioActualId, usuarioDestinoId, anuncioId], (err, chats) => {
        if (err) return callback(err);
        if (chats.length > 0) {
            console.log(`Chat existente encontrado: id_chat=${chats[0].id_chat}`);
            return callback(null, chats[0].id_chat);
        }

        // No existe ningún chat entre estos dos usuarios para este anuncio → crearlo
        connection.query(
            'INSERT INTO chats (activo, id_anuncio) VALUES (1, ?)',
            [anuncioId],
            (err, result) => {
                if (err) return callback(err);
                const idChat = result.insertId;
                console.log(`Nuevo chat creado: id_chat=${idChat}`);
                // Insertar los dos participantes del chat
                connection.query(
                    'INSERT INTO chat_usuario (id_chat, id_usuario) VALUES (?, ?), (?, ?)',
                    [idChat, usuarioActualId, idChat, usuarioDestinoId],
                    (err) => {
                        if (err) return callback(err);
                        callback(null, idChat);
                    }
                );
            }
        );
    });
}

/*
 * GET /services/chat?usuario_id=X&anuncio_id=Y
 * Renderiza la vista del chat entre el usuario autenticado y el propietario del anuncio.
 * Se encarga de:
 *   1. Validar que el usuario destino existe
 *   2. Validar que el anuncio existe y pertenece al usuario destino
 *   3. Cargar la disponibilidad del anuncio
 *   4. Buscar (o crear) el registro de chat en BD
 *   5. Cargar los últimos 30 mensajes para mostrarlos al abrir la página
 */
const getChatPage = (req, res, next) => {
    const usuarioDestinoId = req.query.usuario_id;
    const anuncioId = req.query.anuncio_id;
    const usuarioActualId = req.session.usuario.id;

    if (!usuarioDestinoId) {
        return next(createHttpError(400, 'Debes especificar con quién quieres chatear (usuario_id)'));
    }
    if (!anuncioId) {
        return next(createHttpError(400, 'Debes especificar el anuncio (anuncio_id)'));
    }
    if (parseInt(usuarioDestinoId) === usuarioActualId) {
        return next(createHttpError(400, 'No puedes chatear contigo mismo'));
    }

        console.log(`getChatPage: usuarioActualId=${usuarioActualId}, usuarioDestinoId=${usuarioDestinoId}, anuncioId=${anuncioId}`);

        pool.getConnection((err, connection) => {
        if (err) return next(createHttpError(500, 'Error al conectar con la base de datos'));

        // 1. Verificar que el usuario destino existe en la BD
        connection.query(
            'SELECT id_usuario, nombre_usuario, foto FROM usuarios WHERE id_usuario = ?',
            [usuarioDestinoId],
            (err, usuarios) => {
                if (err) { connection.release(); return next(createHttpError(500, 'Error al obtener el usuario destino')); }
                if (usuarios.length === 0) { connection.release(); console.log("El error es que no hay usuario"); return next(createHttpError(404, 'El usuario con el que intentas chatear no existe')); }

                // 2. Anuncio
                // El anuncio debe pertenecer a uno de los dos participantes de la conversación:
                // al usuarioDestino (caso habitual: yo contacto al dueño del anuncio) o al
                // usuarioActual (caso inverso: el dueño del anuncio entra al chat iniciado por otro).
                connection.query(
                    `SELECT id_anuncio, tipo_anuncio, tipo_servicio, tipo_mascota, precio_hora
                     FROM anuncios WHERE id_anuncio = ? AND (id_usuario = ? OR id_usuario = ?) AND eliminado = 0`,
                    [anuncioId, usuarioDestinoId, usuarioActualId],
                    (err, anuncios) => {
                        if (err) { connection.release(); return next(createHttpError(500, 'Error al obtener el anuncio')); }
                        if (anuncios.length === 0) { connection.release(); console.log("El error es que no hay anuncio"); return next(createHttpError(404, 'El anuncio no existe o no pertenece a este usuario')); }

                        // 3. Disponibilidad
                        connection.query(
                            `SELECT tipo, fecha_inicio, dia_semana, hora_inicio, hora_fin
                             FROM disponibilidad WHERE id_anuncio = ?
                             ORDER BY fecha_inicio ASC, dia_semana ASC, hora_inicio ASC`,
                            [anuncioId],
                            (err, disponibilidades) => {
                                if (err) { connection.release(); return next(createHttpError(500, 'Error al obtener la disponibilidad')); }

                                // 4. Buscar o crear el registro de chat en BD
                                obtenerOCrearChat(connection, usuarioActualId, parseInt(usuarioDestinoId), parseInt(anuncioId), (err, idChat) => {
                                    if (err) { connection.release(); return next(createHttpError(500, 'Error al preparar el chat')); }

                                    // 5. Cargar los últimos N mensajes en orden DESC y luego invertir para
                                    //    mostrarlos cronológicamente. Se pide N+1 para saber si hay más.
                                    connection.query(
                                        `SELECT m.id_mensaje, m.contenido, m.fecha, m.leido, m.id_usuario,
                                                u.nombre_usuario
                                         FROM mensajes m
                                         LEFT JOIN usuarios u ON u.id_usuario = m.id_usuario
                                         WHERE m.id_chat = ?
                                         ORDER BY m.id_mensaje DESC
                                         LIMIT ?`,
                                        [idChat, MENSAJES_POR_PAGINA + 1],
                                        (err, mensajes) => {
                                            connection.release();
                                            if (err) return next(createHttpError(500, 'Error al cargar los mensajes'));

                                            const hayMasAnteriores = mensajes.length > MENSAJES_POR_PAGINA;
                                            if (hayMasAnteriores) mensajes.pop(); // eliminar el mensaje extra del sondeo
                                            mensajes.reverse(); // pasar de DESC a orden cronológico (más antiguo primero)
                                            console.log(`Chat ${idChat}: ${mensajes.length} mensajes cargados, hayMasAnteriores=${hayMasAnteriores}`);

                                            res.render('chat', {
                                                usuarioActualId,
                                                usuarioActualNombre: req.session.usuario.nombre_usuario,
                                                usuarioDestino: {
                                                    id: usuarios[0].id_usuario,
                                                    nombre: usuarios[0].nombre_usuario,
                                                    foto: usuarios[0].foto
                                                },
                                                anuncio: {
                                                    id: parseInt(anuncioId),
                                                    tipoAnuncio: anuncios[0].tipo_anuncio,
                                                    tipoServicio: anuncios[0].tipo_servicio,
                                                    tipoMascota: anuncios[0].tipo_mascota,
                                                    precioHora: anuncios[0].precio_hora,
                                                    disponibilidades
                                                },
                                                chatId: idChat,
                                                mensajesIniciales: mensajes,
                                                hayMasAnteriores
                                            });
                                        }
                                    );
                                });
                            }
                        );
                    }
                );
            }
        );
    });
};

/*
 * GET /services/chat/historial?chat_id=X&antes_de=Y
 * Endpoint AJAX para paginación infinita del historial de mensajes.
 * Devuelve los 30 mensajes anteriores al id_mensaje indicado en `antes_de`.
 * El cliente lo usa cuando el usuario pulsa "Cargar mensajes anteriores".
 */
const getHistorial = (req, res) => {
    const chatId = parseInt(req.query.chat_id);
    const antesDeId = parseInt(req.query.antes_de);
    const usuarioActualId = req.session.usuario.id;

    if (!chatId || !antesDeId) {
        return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    console.log(`getHistorial: chatId=${chatId}, antesDeId=${antesDeId}, usuarioActualId=${usuarioActualId}`);

    pool.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: 'Error de conexión' });

        // Verificar que el usuario autenticado es participante del chat (seguridad)
        connection.query(
            'SELECT id_chat FROM chat_usuario WHERE id_chat = ? AND id_usuario = ? LIMIT 1',
            [chatId, usuarioActualId],
            (err, rows) => {
                if (err || rows.length === 0) {
                    connection.release();
                    return res.status(403).json({ error: 'No tienes acceso a este chat' });
                }

                connection.query(
                    `SELECT m.id_mensaje, m.contenido, m.fecha, m.leido, m.id_usuario,
                            u.nombre_usuario
                     FROM mensajes m
                     LEFT JOIN usuarios u ON u.id_usuario = m.id_usuario
                     WHERE m.id_chat = ? AND m.id_mensaje < ?
                     ORDER BY m.id_mensaje DESC
                     LIMIT ?`,
                    [chatId, antesDeId, MENSAJES_POR_PAGINA + 1],
                    (err, mensajes) => {
                        connection.release();
                        if (err) return res.status(500).json({ error: 'Error al cargar mensajes' });

                        const hayMas = mensajes.length > MENSAJES_POR_PAGINA;
                        if (hayMas) mensajes.pop(); // eliminar el mensaje extra del sondeo
                        mensajes.reverse(); // pasar a orden cronológico
                        console.log(`getHistorial: devolviendo ${mensajes.length} mensajes, hayMas=${hayMas}`);
                        res.json({ mensajes, hayMas });
                    }
                );
            }
        );
    });
};

/* ─────────────────────────────────────────────────────────────────────────
 *  getMisChats – GET /services/mis-chats
 *  Renderiza la página "Mis Chats" (dos columnas).
 *  Los datos se cargan de forma diferida mediante getMisChatsData (AJAX).
 * ─────────────────────────────────────────────────────────────────────────*/
const getMisChats = (req, res, next) => {
    res.render('misChats', { usuario: req.session.usuario });
};

/* ─────────────────────────────────────────────────────────────────────────
 *  getMisChatsData – GET /services/mis-chats/data?tipo=iniciados|recibidos&pagina=1
 *  Devuelve JSON { chats: [...], hayMas: bool } para la paginación.
 *
 *  Lógica de negocio:
 *    • tipo=iniciados  → chats donde YO no soy el dueño del anuncio
 *      (yo usé el botón "Contactar" en el anuncio de otro usuario)
 *    • tipo=recibidos  → chats donde YO soy el dueño del anuncio
 *      (otro usuario pulsó "Contactar" en uno de mis anuncios)
 *
 *  Se piden LIMITE+1 filas para saber si hay más páginas sin COUNT(*).
 * ─────────────────────────────────────────────────────────────────────────*/
const getMisChatsData = (req, res) => {
    const tipo = req.query.tipo;
    const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
    const LIMITE = 10;
    const offset = (pagina - 1) * LIMITE;
    const userId = req.session.usuario.id;

    if (tipo !== 'iniciados' && tipo !== 'recibidos') {
        return res.status(400).json({ error: 'Parámetro tipo inválido' });
    }

    console.log(`getMisChatsData: userId=${userId}, tipo=${tipo}, pagina=${pagina}`);

    pool.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: 'Error de conexión' });

        let query, params;

        if (tipo === 'iniciados') {
            // Chats donde estoy como participante PERO no soy el dueño del anuncio.
            // El "destino" es el dueño del anuncio (u_dest).
            query = `
                SELECT
                    c.id_chat,
                    c.id_anuncio,
                    a.tipo_servicio,
                    a.tipo_mascota,
                    a.tipo_anuncio,
                    a.precio_hora,
                    u_dest.id_usuario   AS destino_id,
                    u_dest.nombre_usuario AS destino_nombre,
                    u_dest.foto         AS destino_foto,
                    (SELECT m.contenido FROM mensajes m WHERE m.id_chat = c.id_chat ORDER BY m.id_mensaje DESC LIMIT 1) AS ultimo_mensaje,
                    (SELECT m.fecha     FROM mensajes m WHERE m.id_chat = c.id_chat ORDER BY m.id_mensaje DESC LIMIT 1) AS ultima_fecha,
                    (SELECT COUNT(*) FROM mensajes m WHERE m.id_chat = c.id_chat AND m.leido = 0 AND m.id_usuario != ?) AS mensajes_no_leidos
                FROM chats c
                JOIN chat_usuario cu  ON cu.id_chat   = c.id_chat  AND cu.id_usuario = ?
                JOIN anuncios a       ON a.id_anuncio  = c.id_anuncio
                JOIN usuarios u_dest  ON u_dest.id_usuario = a.id_usuario
                WHERE c.activo = 1
                  AND a.id_usuario != ?
                  AND a.eliminado = 0
                ORDER BY COALESCE(ultima_fecha, '1970-01-01') DESC
                LIMIT ? OFFSET ?
            `;
            params = [userId, userId, userId, LIMITE + 1, offset];
        } else {
            // Chats donde yo soy el dueño del anuncio.
            // El "destino" es el OTRO participante en chat_usuario (cu2).
            query = `
                SELECT
                    c.id_chat,
                    c.id_anuncio,
                    a.tipo_servicio,
                    a.tipo_mascota,
                    a.tipo_anuncio,
                    a.precio_hora,
                    u_dest.id_usuario   AS destino_id,
                    u_dest.nombre_usuario AS destino_nombre,
                    u_dest.foto         AS destino_foto,
                    (SELECT m.contenido FROM mensajes m WHERE m.id_chat = c.id_chat ORDER BY m.id_mensaje DESC LIMIT 1) AS ultimo_mensaje,
                    (SELECT m.fecha     FROM mensajes m WHERE m.id_chat = c.id_chat ORDER BY m.id_mensaje DESC LIMIT 1) AS ultima_fecha,
                    (SELECT COUNT(*) FROM mensajes m WHERE m.id_chat = c.id_chat AND m.leido = 0 AND m.id_usuario != ?) AS mensajes_no_leidos
                FROM chats c
                JOIN chat_usuario cu   ON cu.id_chat  = c.id_chat AND cu.id_usuario = ?
                JOIN chat_usuario cu2  ON cu2.id_chat = c.id_chat AND cu2.id_usuario != ?
                JOIN anuncios a        ON a.id_anuncio = c.id_anuncio
                JOIN usuarios u_dest   ON u_dest.id_usuario = cu2.id_usuario
                WHERE c.activo = 1
                  AND a.id_usuario = ?
                  AND a.eliminado = 0
                ORDER BY COALESCE(ultima_fecha, '1970-01-01') DESC
                LIMIT ? OFFSET ?
            `;
            params = [userId, userId, userId, userId, LIMITE + 1, offset];
        }

        connection.query(query, params, (err, rows) => {
            connection.release();
            if (err) {
                console.error('getMisChatsData error:', err);
                return res.status(500).json({ error: 'Error al obtener chats' });
            }

            // Si llegaron LIMITE+1 filas hay una página más; quitamos la extra del resultado
            const hayMas = rows.length > LIMITE;
            const chats = hayMas ? rows.slice(0, LIMITE) : rows;

            console.log(`getMisChatsData: devolviendo ${chats.length} chats, hayMas=${hayMas}`);
            res.json({ chats, hayMas });
        });
    });
};

module.exports = { getChatPage, getHistorial, getMisChats, getMisChatsData };
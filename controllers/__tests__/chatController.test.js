'use strict';

jest.mock('../../db', () => ({ getConnection: jest.fn() }));
jest.mock('../../handlers/httpErrors', () => ({
    createHttpError: jest.fn((status, message) => ({ status, message }))
}));

const pool = require('../../db');
const { getChatPage, getChatArchivadoPage, getHistorial, getMisChats, getMisChatsData, eliminarChat, postValorar } = require('../chatController');

const buildResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const buildConnection = (queryImpl) => ({
    query: jest.fn(queryImpl),
    release: jest.fn()
});

beforeEach(() => {
    jest.clearAllMocks();
});

// ----------------------------------------------------------------------------
describe('getMisChats', () => {
    test('renders misChats with session user', () => {
        const req = { session: { usuario: { id: 1, nombre_usuario: 'Ana' } } };
        const res = buildResponse();
        getMisChats(req, res);
        expect(res.render).toHaveBeenCalledWith('misChats', { usuario: req.session.usuario });
    });
});

// ----------------------------------------------------------------------------
describe('getMisChatsData', () => {
    const baseReq = (overrides = {}) => ({
        query: { tipo: 'iniciados', pagina: '1', archivados: '0', ...overrides },
        session: { usuario: { id: 1 } }
    });

    test('returns 400 for invalid tipo', () => {
        const req = baseReq({ tipo: 'invalido' });
        const res = buildResponse();
        getMisChatsData(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Parámetro tipo inválido' });
    });

    test('returns 500 on connection error', () => {
        const req = baseReq();
        const res = buildResponse();
        pool.getConnection.mockImplementation((cb) => cb(new Error('conn fail')));
        getMisChatsData(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error de conexión' });
    });

    test('returns 500 on query error', () => {
        const req = baseReq();
        const res = buildResponse();
        const connection = buildConnection((_sql, _params, cb) => cb(new Error('query fail')));
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getMisChatsData(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener chats' });
        expect(connection.release).toHaveBeenCalled();
    });

    test('returns chats activos tipo=iniciados sin paginacion', () => {
        const req = baseReq({ tipo: 'iniciados', archivados: '0' });
        const res = buildResponse();
        const chatsData = [{ id_chat: 1 }, { id_chat: 2 }];
        const connection = buildConnection((_sql, _params, cb) => cb(null, chatsData));
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getMisChatsData(req, res);
        expect(res.json).toHaveBeenCalledWith({ chats: chatsData, hayMas: false });
    });

    test('returns chats activos tipo=iniciados con hayMas=true', () => {
        const req = baseReq({ tipo: 'iniciados', archivados: '0' });
        const res = buildResponse();
        const chatsData = Array.from({ length: 11 }, (_, i) => ({ id_chat: i + 1 }));
        const connection = buildConnection((_sql, _params, cb) => cb(null, chatsData));
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getMisChatsData(req, res);
        expect(res.json).toHaveBeenCalledWith({ chats: chatsData.slice(0, 10), hayMas: true });
    });

    test('returns chats activos tipo=recibidos', () => {
        const req = baseReq({ tipo: 'recibidos', archivados: '0' });
        const res = buildResponse();
        const chatsData = [{ id_chat: 5 }];
        const connection = buildConnection((_sql, _params, cb) => cb(null, chatsData));
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getMisChatsData(req, res);
        expect(res.json).toHaveBeenCalledWith({ chats: chatsData, hayMas: false });
    });

    test('returns chats archivados tipo=iniciados', () => {
        const req = baseReq({ tipo: 'iniciados', archivados: '1' });
        const res = buildResponse();
        const chatsData = [{ id_chat: 3 }];
        const connection = buildConnection((_sql, _params, cb) => cb(null, chatsData));
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getMisChatsData(req, res);
        expect(res.json).toHaveBeenCalledWith({ chats: chatsData, hayMas: false });
    });

    test('returns chats archivados tipo=recibidos', () => {
        const req = baseReq({ tipo: 'recibidos', archivados: '1' });
        const res = buildResponse();
        const chatsData = [{ id_chat: 7 }];
        const connection = buildConnection((_sql, _params, cb) => cb(null, chatsData));
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getMisChatsData(req, res);
        expect(res.json).toHaveBeenCalledWith({ chats: chatsData, hayMas: false });
    });
});

// ----------------------------------------------------------------------------
describe('eliminarChat', () => {
    const baseReq = (id = '10') => ({
        params: { id },
        session: { usuario: { id: 1 } }
    });

    test('returns 400 for chatId invalido', () => {
        const req = baseReq('abc');
        const res = buildResponse();
        eliminarChat(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'ID de chat inválido' });
    });

    test('returns 500 on connection error', () => {
        const req = baseReq('10');
        const res = buildResponse();
        pool.getConnection.mockImplementation((cb) => cb(new Error('conn')));
        eliminarChat(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error de conexión' });
    });

    test('returns 500 on error al verificar participante', () => {
        const req = baseReq('10');
        const res = buildResponse();
        const connection = buildConnection((_sql, _params, cb) => cb(new Error('db error')));
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        eliminarChat(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error de base de datos' });
        expect(connection.release).toHaveBeenCalled();
    });

    test('returns 403 si el usuario no es participante', () => {
        const req = baseReq('10');
        const res = buildResponse();
        const connection = buildConnection((_sql, _params, cb) => cb(null, []));
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        eliminarChat(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'No tienes acceso a este chat' });
        expect(connection.release).toHaveBeenCalled();
    });

    test('returns 500 on error al actualizar el chat', () => {
        const req = baseReq('10');
        const res = buildResponse();
        let callCount = 0;
        const connection = buildConnection((_sql, _params, cb) => {
            callCount++;
            if (callCount === 1) cb(null, [{ id_chat: 10 }]);
            else cb(new Error('update fail'));
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        eliminarChat(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error al archivar el chat' });
    });

    test('returns ok:true al archivar correctamente', () => {
        const req = baseReq('10');
        const res = buildResponse();
        let callCount = 0;
        const connection = buildConnection((_sql, _params, cb) => {
            callCount++;
            if (callCount === 1) cb(null, [{ id_chat: 10 }]);
            else cb(null);
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        eliminarChat(req, res);
        expect(res.json).toHaveBeenCalledWith({ ok: true });
        expect(connection.release).toHaveBeenCalled();
    });
});

// ----------------------------------------------------------------------------
describe('getHistorial', () => {
    const baseReq = (overrides = {}) => ({
        query: { chat_id: '5', antes_de: '100', ...overrides },
        session: { usuario: { id: 1 } }
    });

    test('returns 400 si falta chat_id', () => {
        const req = baseReq({ chat_id: undefined });
        const res = buildResponse();
        getHistorial(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Parámetros inválidos' });
    });

    test('returns 400 si falta antes_de', () => {
        const req = baseReq({ antes_de: undefined });
        const res = buildResponse();
        getHistorial(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Parámetros inválidos' });
    });

    test('returns 500 on connection error', () => {
        const req = baseReq();
        const res = buildResponse();
        pool.getConnection.mockImplementation((cb) => cb(new Error('conn')));
        getHistorial(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error de conexión' });
    });

    test('returns 403 si el usuario no es participante del chat', () => {
        const req = baseReq();
        const res = buildResponse();
        const connection = buildConnection((_sql, _params, cb) => cb(null, []));
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getHistorial(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'No tienes acceso a este chat' });
        expect(connection.release).toHaveBeenCalled();
    });

    test('returns 500 on error al cargar mensajes', () => {
        const req = baseReq();
        const res = buildResponse();
        let callCount = 0;
        const connection = buildConnection((_sql, _params, cb) => {
            callCount++;
            if (callCount === 1) cb(null, [{ id_chat: 5 }]);
            else cb(new Error('mensajes fail'));
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getHistorial(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error al cargar mensajes' });
    });

    test('returns mensajes con hayMas=false', () => {
        const req = baseReq();
        const res = buildResponse();
        const mensajes = [{ id_mensaje: 99 }, { id_mensaje: 98 }];
        let callCount = 0;
        const connection = buildConnection((_sql, _params, cb) => {
            callCount++;
            if (callCount === 1) cb(null, [{ id_chat: 5 }]);
            else cb(null, [...mensajes]);
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getHistorial(req, res);
        const { mensajes: result, hayMas } = res.json.mock.calls[0][0];
        expect(hayMas).toBe(false);
        expect(result).toHaveLength(2);
        expect(connection.release).toHaveBeenCalled();
    });

    test('returns mensajes con hayMas=true al haber más de 30', () => {
        const req = baseReq();
        const res = buildResponse();
        const mensajes = Array.from({ length: 31 }, (_, i) => ({ id_mensaje: 130 - i }));
        let callCount = 0;
        const connection = buildConnection((_sql, _params, cb) => {
            callCount++;
            if (callCount === 1) cb(null, [{ id_chat: 5 }]);
            else cb(null, [...mensajes]);
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getHistorial(req, res);
        const { mensajes: result, hayMas } = res.json.mock.calls[0][0];
        expect(hayMas).toBe(true);
        expect(result).toHaveLength(30);
    });
});

// ----------------------------------------------------------------------------
describe('postValorar', () => {
    const baseReq = (overrides = {}) => ({
        body: { chat_id: '10', puntuacion: '4', comentario: 'Bien', ...overrides },
        session: { usuario: { id: 1 } }
    });

    test('returns 400 si falta chat_id', () => {
        const req = baseReq({ chat_id: undefined });
        const res = buildResponse();
        postValorar(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Datos inválidos' });
    });

    test('returns 400 si puntuacion está fuera de rango', () => {
        const req = baseReq({ puntuacion: '6' });
        const res = buildResponse();
        postValorar(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Datos inválidos' });
    });

    test('returns 400 si puntuacion es menor que 1', () => {
        const req = baseReq({ puntuacion: '0' });
        const res = buildResponse();
        postValorar(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Datos inválidos' });
    });

    test('returns 500 on connection error', () => {
        const req = baseReq();
        const res = buildResponse();
        pool.getConnection.mockImplementation((cb) => cb(new Error('conn')));
        postValorar(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error de conexión' });
    });

    test('returns 403 si el usuario no es participante', () => {
        const req = baseReq();
        const res = buildResponse();
        const connection = buildConnection((_sql, _params, cb) => cb(null, []));
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        postValorar(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'No tienes acceso a este chat' });
        expect(connection.release).toHaveBeenCalled();
    });

    test('returns 403 si el servicio no ha sido finalizado por ambos', () => {
        const req = baseReq();
        const res = buildResponse();
        const connection = buildConnection((_sql, _params, cb) =>
            cb(null, [{ finalizar_usuario1: 0, finalizar_usuario2: 0, id_destinatario: 2 }])
        );
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        postValorar(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'El servicio no ha sido finalizado por ambos usuarios' });
        expect(connection.release).toHaveBeenCalled();
    });

    test('returns 500 on error al verificar valoracion existente', () => {
        const req = baseReq();
        const res = buildResponse();
        let callCount = 0;
        const connection = buildConnection((_sql, _params, cb) => {
            callCount++;
            if (callCount === 1) cb(null, [{ finalizar_usuario1: 1, finalizar_usuario2: 1, id_destinatario: 2 }]);
            else cb(new Error('check fail'));
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        postValorar(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error al verificar' });
    });

    test('returns 409 si el usuario ya ha valorado el servicio', () => {
        const req = baseReq();
        const res = buildResponse();
        let callCount = 0;
        const connection = buildConnection((_sql, _params, cb) => {
            callCount++;
            if (callCount === 1) cb(null, [{ finalizar_usuario1: 1, finalizar_usuario2: 1, id_destinatario: 2 }]);
            else cb(null, [{ id_valoracion: 5 }]);
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        postValorar(req, res);
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({ error: 'Ya has valorado este servicio' });
    });

    test('returns 500 on error al guardar la valoracion', () => {
        const req = baseReq();
        const res = buildResponse();
        let callCount = 0;
        const connection = buildConnection((_sql, _params, cb) => {
            callCount++;
            if (callCount === 1) cb(null, [{ finalizar_usuario1: 1, finalizar_usuario2: 1, id_destinatario: 2 }]);
            else if (callCount === 2) cb(null, []);
            else cb(new Error('insert fail'));
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        postValorar(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error al guardar la valoración' });
    });

    test('returns ok:true al valorar correctamente', () => {
        const req = baseReq();
        const res = buildResponse();
        let callCount = 0;
        const connection = buildConnection((_sql, _params, cb) => {
            callCount++;
            if (callCount === 1) cb(null, [{ finalizar_usuario1: 1, finalizar_usuario2: 1, id_destinatario: 2 }]);
            else if (callCount === 2) cb(null, []);
            else cb(null);
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        postValorar(req, res);
        expect(res.json).toHaveBeenCalledWith({ ok: true });
        expect(connection.release).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
describe('getChatPage', () => {
    const baseReq = (overrides = {}) => ({
        query: { usuario_id: '2', anuncio_id: '5', ...overrides },
        session: { usuario: { id: 1, nombre_usuario: 'Ana' } }
    });

    test('returns 400 si falta usuario_id', () => {
        const req = baseReq({ usuario_id: undefined });
        const res = buildResponse();
        const next = jest.fn();
        getChatPage(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
    });

    test('returns 400 si falta anuncio_id', () => {
        const req = baseReq({ anuncio_id: undefined });
        const res = buildResponse();
        const next = jest.fn();
        getChatPage(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
    });

    test('returns 400 si el usuario intenta chatear consigo mismo', () => {
        const req = baseReq({ usuario_id: '1' });
        const res = buildResponse();
        const next = jest.fn();
        getChatPage(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
    });

    test('returns 500 on connection error', () => {
        const req = baseReq();
        const res = buildResponse();
        const next = jest.fn();
        pool.getConnection.mockImplementation((cb) => cb(new Error('conn')));
        getChatPage(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
    });

    test('returns 404 si el usuario destino no existe', () => {
        const req = baseReq();
        const res = buildResponse();
        const next = jest.fn();
        const connection = buildConnection((_sql, _params, cb) => cb(null, []));
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getChatPage(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
        expect(connection.release).toHaveBeenCalled();
    });

    test('returns 404 si el anuncio no existe o no pertenece al usuario', () => {
        const req = baseReq();
        const res = buildResponse();
        const next = jest.fn();
        let callCount = 0;
        const connection = buildConnection((_sql, _params, cb) => {
            callCount++;
            if (callCount === 1) cb(null, [{ id_usuario: 2, nombre_usuario: 'Bob', foto: null }]);
            else cb(null, []);
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getChatPage(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
        expect(connection.release).toHaveBeenCalled();
    });

    test('returns 500 on error al obtener disponibilidad', () => {
        const req = baseReq();
        const res = buildResponse();
        const next = jest.fn();
        let callCount = 0;
        const connection = buildConnection((_sql, _params, cb) => {
            callCount++;
            if (callCount === 1) cb(null, [{ id_usuario: 2, nombre_usuario: 'Bob', foto: null }]);
            else if (callCount === 2) cb(null, [{ id_anuncio: 5, id_usuario: 2, tipo_anuncio: 'oferta', tipo_servicio: 'cuidado', tipo_mascota: 'perro', precio_hora: 10 }]);
            else cb(new Error('disp fail'));
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getChatPage(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
    });

    test('renders chat correctamente con chat existente', () => {
        const req = baseReq();
        const res = buildResponse();
        const next = jest.fn();
        const connection = buildConnection((sql, _params, cb) => {
            if (sql.includes('SELECT id_usuario, nombre_usuario'))
                cb(null, [{ id_usuario: 2, nombre_usuario: 'Bob', foto: 'bob.jpg' }]);
            else if (sql.includes('FROM anuncios WHERE'))
                cb(null, [{ id_anuncio: 5, id_usuario: 2, tipo_anuncio: 'oferta', tipo_servicio: 'cuidado', tipo_mascota: 'perro', precio_hora: 10 }]);
            else if (sql.includes('FROM disponibilidad WHERE'))
                cb(null, []);
            else if (sql.includes('JOIN chat_usuario cu1'))
                cb(null, [{ id_chat: 42 }]);
            else if (sql.includes('u_min'))
                cb(null, [{ finalizar_usuario1: 0, finalizar_usuario2: 0, u_min: 1 }]);
            else
                cb(null, [{ id_mensaje: 1, contenido: 'hola', nombre_usuario: 'Bob' }]);
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getChatPage(req, res, next);
        expect(res.render).toHaveBeenCalledWith('chat', expect.objectContaining({
            chatId: 42,
            chatActivo: true,
            usuarioActualId: 1
        }));
        expect(connection.release).toHaveBeenCalled();
    });

    test('renders chat correctamente creando un chat nuevo', () => {
        const req = baseReq();
        const res = buildResponse();
        const next = jest.fn();
        let insertChatDone = false;
        const connection = buildConnection((sql, _params, cb) => {
            if (sql.includes('SELECT id_usuario, nombre_usuario'))
                cb(null, [{ id_usuario: 2, nombre_usuario: 'Bob', foto: null }]);
            else if (sql.includes('FROM anuncios WHERE'))
                cb(null, [{ id_anuncio: 5, id_usuario: 2, tipo_anuncio: 'oferta', tipo_servicio: 'cuidado', tipo_mascota: 'perro', precio_hora: 10 }]);
            else if (sql.includes('FROM disponibilidad WHERE'))
                cb(null, []);
            else if (sql.includes('JOIN chat_usuario cu1'))
                cb(null, []); // no chat existente → se crea uno nuevo
            else if (sql.includes('INSERT INTO chats'))
                cb(null, { insertId: 99 });
            else if (sql.includes('INSERT INTO chat_usuario'))
                cb(null);
            else if (sql.includes('u_min'))
                cb(null, [{ finalizar_usuario1: 0, finalizar_usuario2: 0, u_min: 1 }]);
            else
                cb(null, []);
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getChatPage(req, res, next);
        expect(res.render).toHaveBeenCalledWith('chat', expect.objectContaining({ chatId: 99 }));
    });
});

// ----------------------------------------------------------------------------
describe('getChatArchivadoPage', () => {
    const baseReq = (overrides = {}) => ({
        query: { chat_id: '10', ...overrides },
        session: { usuario: { id: 1, nombre_usuario: 'Ana' } }
    });

    test('returns 400 si falta chat_id', () => {
        const req = baseReq({ chat_id: undefined });
        const res = buildResponse();
        const next = jest.fn();
        getChatArchivadoPage(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
    });

    test('returns 500 on connection error', () => {
        const req = baseReq();
        const res = buildResponse();
        const next = jest.fn();
        pool.getConnection.mockImplementation((cb) => cb(new Error('conn')));
        getChatArchivadoPage(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
    });

    test('returns 404 si el chat no existe o el usuario no es participante', () => {
        const req = baseReq();
        const res = buildResponse();
        const next = jest.fn();
        const connection = buildConnection((_sql, _params, cb) => cb(null, []));
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getChatArchivadoPage(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
        expect(connection.release).toHaveBeenCalled();
    });

    test('returns 404 si no se encuentra el otro participante del chat', () => {
        const req = baseReq();
        const res = buildResponse();
        const next = jest.fn();
        let callCount = 0;
        const connection = buildConnection((_sql, _params, cb) => {
            callCount++;
            if (callCount === 1) cb(null, [{ id_chat: 10, id_anuncio: 5, finalizar_usuario1: 0, finalizar_usuario2: 0 }]);
            else cb(null, []);
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getChatArchivadoPage(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });

    test('renders chat sin anuncio cuando id_anuncio es null y el chat no está finalizado', () => {
        const req = baseReq();
        const res = buildResponse();
        const next = jest.fn();
        let callCount = 0;
        const connection = buildConnection((_sql, _params, cb) => {
            callCount++;
            if (callCount === 1) cb(null, [{ id_chat: 10, id_anuncio: null, finalizar_usuario1: 0, finalizar_usuario2: 0 }]);
            else if (callCount === 2) cb(null, [{ id_usuario: 2, nombre_usuario: 'Bob', foto: null }]);
            else cb(null, []);
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getChatArchivadoPage(req, res, next);
        expect(res.render).toHaveBeenCalledWith('chat', expect.objectContaining({
            anuncio: null,
            chatActivo: false,
            pendienteValorar: false,
            yaValorado: false
        }));
    });

    test('renders chat con anuncio cuando el chat no está finalizado', () => {
        const req = baseReq();
        const res = buildResponse();
        const next = jest.fn();
        let callCount = 0;
        const connection = buildConnection((_sql, _params, cb) => {
            callCount++;
            if (callCount === 1) cb(null, [{ id_chat: 10, id_anuncio: 5, finalizar_usuario1: 0, finalizar_usuario2: 0 }]);
            else if (callCount === 2) cb(null, [{ id_usuario: 2, nombre_usuario: 'Bob', foto: null }]);
            else if (callCount === 3) cb(null, [{ id_anuncio: 5, id_usuario: 2, tipo_anuncio: 'oferta', tipo_servicio: 'cuidado', tipo_mascota: 'perro', precio_hora: 10 }]);
            else if (callCount === 4) cb(null, []);
            else cb(null, []);
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getChatArchivadoPage(req, res, next);
        expect(res.render).toHaveBeenCalledWith('chat', expect.objectContaining({
            chatActivo: false,
            pendienteValorar: false,
            yaValorado: false
        }));
        expect(res.render.mock.calls[0][1].anuncio).not.toBeNull();
    });

    test('renders chat con pendienteValorar=true cuando el chat está finalizado y no ha sido valorado', () => {
        const req = baseReq();
        const res = buildResponse();
        const next = jest.fn();
        const connection = buildConnection((sql, _params, cb) => {
            if (sql.includes('c.id_anuncio, c.finalizar_usuario1'))
                cb(null, [{ id_chat: 10, id_anuncio: null, finalizar_usuario1: 1, finalizar_usuario2: 1 }]);
            else if (sql.includes('JOIN usuarios u ON u.id_usuario = cu.id_usuario'))
                cb(null, [{ id_usuario: 2, nombre_usuario: 'Bob', foto: null }]);
            else if (sql.includes('FROM mensajes m'))
                cb(null, []);
            else
                cb(null, []); // valoraciones: vacío → pendienteValorar=true
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getChatArchivadoPage(req, res, next);
        expect(res.render).toHaveBeenCalledWith('chat', expect.objectContaining({
            pendienteValorar: true,
            yaValorado: false
        }));
    });

    test('renders chat con yaValorado=true cuando el chat está finalizado y ya fue valorado', () => {
        const req = baseReq();
        const res = buildResponse();
        const next = jest.fn();
        const connection = buildConnection((sql, _params, cb) => {
            if (sql.includes('c.id_anuncio, c.finalizar_usuario1'))
                cb(null, [{ id_chat: 10, id_anuncio: null, finalizar_usuario1: 1, finalizar_usuario2: 1 }]);
            else if (sql.includes('JOIN usuarios u ON u.id_usuario = cu.id_usuario'))
                cb(null, [{ id_usuario: 2, nombre_usuario: 'Bob', foto: null }]);
            else if (sql.includes('FROM mensajes m'))
                cb(null, []);
            else
                cb(null, [{ id_valoracion: 3 }]); // ya valorado
        });
        pool.getConnection.mockImplementation((cb) => cb(null, connection));
        getChatArchivadoPage(req, res, next);
        expect(res.render).toHaveBeenCalledWith('chat', expect.objectContaining({
            pendienteValorar: false,
            yaValorado: true
        }));
    });
});

/* eslint-disable no-undef */
'use strict';

const userController = require('../userController');
const pool = require('../../db');
const { validationResult } = require('express-validator');

// Mock de express-validator
jest.mock('express-validator', () => ({
    validationResult: jest.fn()
}));

// Mock de la base de datos
jest.mock('../../db');

describe('userController', () => {
    let req, res, connection;

    beforeEach(() => {
        // Reset mocks antes de cada test
        jest.clearAllMocks();

        // Mock de la request
        req = {
            params: { id: '1' },
            body: {},
            session: {
                usuario: {
                    id: 1,
                    tipo: 'usuario'
                }
            },
            file: null
        };

        // Mock de la response
        res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            render: jest.fn().mockReturnThis(),
            redirect: jest.fn().mockReturnThis()
        };

        // Mock de la conexión
        connection = {
            query: jest.fn(),
            release: jest.fn()
        };

        pool.getConnection = jest.fn();
    });

    // ============================================================
    // PRUEBAS PARA: getPerfilUsuario
    // ============================================================
    describe('getPerfilUsuario', () => {
        it('Debería renderizar el perfil del usuario correctamente', (done) => {
            // Arrange
            const mockUsuario = {
                id_usuario: 1,
                nombre_completo: 'Juan Pérez',
                activo: 1
            };
            const mockMascotas = [
                { id_mascota: 1, nombre: 'Max' }
            ];

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                // Primera consulta: usuario
                if (query.includes('SELECT * FROM usuarios WHERE')) {
                    callback(null, [mockUsuario]);
                }
                // Segunda consulta: mascotas
                else if (query.includes('SELECT * FROM mascotas WHERE')) {
                    callback(null, mockMascotas);
                }
            });

            // Act
            userController.getPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.render).toHaveBeenCalledWith('perfilUsuario', expect.objectContaining({
                    perfil: mockUsuario,
                    mascotas: mockMascotas,
                    esPropia: true,
                    puedeEditar: true
                }));
                expect(connection.release).toHaveBeenCalled();
                done();
            }, 100);
        });

        it('Debería retornar 500 si hay error de conexión', (done) => {
            // Arrange
            pool.getConnection.mockImplementation((callback) => {
                callback(new Error('Connection error'));
            });

            // Act
            userController.getPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(500);
                expect(res.send).toHaveBeenCalled();
                done();
            }, 100);
        });

        it('Debería retornar 404 si el usuario no existe', (done) => {
            // Arrange
            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            // Act
            userController.getPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(404);
                expect(res.send).toHaveBeenCalledWith('Usuario no encontrado');
                expect(connection.release).toHaveBeenCalled();
                done();
            }, 100);
        });

        it('Debería retornar 403 si la cuenta del usuario está inactiva', (done) => {
            // Arrange
            const mockUsuarioInactivo = {
                id_usuario: 1,
                activo: 0
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(null, [mockUsuarioInactivo]);
            });

            // Act
            userController.getPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(403);
                expect(res.send).toHaveBeenCalledWith('Cuenta de usuario inactiva');
                expect(connection.release).toHaveBeenCalled();
                done();
            }, 100);
        });

        it('Debería retornar 500 si hay error en la consulta de usuario', (done) => {
            // Arrange
            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(new Error('Query error'));
            });

            // Act
            userController.getPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(500);
                expect(res.send).toHaveBeenCalledWith('Error al recuperar los datos del usuario');
                expect(connection.release).toHaveBeenCalled();
                done();
            }, 100);
        });
    });

    // ============================================================
    // PRUEBAS PARA: getPerfilEmpresa
    // ============================================================
    describe('getPerfilEmpresa', () => {
        beforeEach(() => {
            req.params.id = '1';
        });

        it('Debería renderizar el perfil de la empresa correctamente', (done) => {
            // Arrange
            const mockEmpresa = {
                id_empresa: 1,
                nombre: 'PetShop Plus',
                activo: 1
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(null, [mockEmpresa]);
            });

            req.session.usuario = { id: 1, tipo: 'empresa' };

            // Act
            userController.getPerfilEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(res.render).toHaveBeenCalledWith('perfilEmpresa', expect.objectContaining({
                    empresa: mockEmpresa,
                    esPropia: true,
                    puedeEditar: true
                }));
                expect(connection.release).toHaveBeenCalled();
                done();
            }, 100);
        });

        it('Debería retornar 404 si la empresa no existe', (done) => {
            // Arrange
            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            // Act
            userController.getPerfilEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(404);
                expect(res.send).toHaveBeenCalledWith('Empresa no encontrada');
                done();
            }, 100);
        });

        it('Debería retornar 403 si la empresa está inactiva', (done) => {
            // Arrange
            const mockEmpresaInactiva = {
                id_empresa: 1,
                activo: 0
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(null, [mockEmpresaInactiva]);
            });

            // Act
            userController.getPerfilEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(403);
                expect(res.send).toHaveBeenCalledWith('Cuenta de empresa inactiva');
                done();
            }, 100);
        });

        it('Debería mostrar esPropia como false para otros usuarios', (done) => {
            // Arrange
            const mockEmpresa = {
                id_empresa: 1,
                nombre: 'PetShop Plus',
                activo: 1
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(null, [mockEmpresa]);
            });

            req.session.usuario = { id: 999, tipo: 'usuario' };

            // Act
            userController.getPerfilEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(res.render).toHaveBeenCalledWith('perfilEmpresa', expect.objectContaining({
                    esPropia: false,
                    puedeEditar: false
                }));
                done();
            }, 100);
        });
    });

    // ============================================================
    // PRUEBAS PARA: getEditarPerfilUsuario
    // ============================================================
    describe('getEditarPerfilUsuario', () => {
        it('Debería renderizar la página de edición del usuario', (done) => {
            // Arrange
            const mockUsuario = {
                id_usuario: 1,
                nombre_completo: 'Juan Pérez',
                activo: 1
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(null, [mockUsuario]);
            });

            // Act
            userController.getEditarPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.render).toHaveBeenCalledWith('editarPerfilUsuario', {
                    perfil: mockUsuario
                });
                expect(connection.release).toHaveBeenCalled();
                done();
            }, 100);
        });

        it('Debería retornar 404 si el usuario no existe', (done) => {
            // Arrange
            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            // Act
            userController.getEditarPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(404);
                expect(res.send).toHaveBeenCalledWith('Usuario no encontrado');
                done();
            }, 100);
        });

        it('Debería retornar 403 si el usuario está inactivo', (done) => {
            // Arrange
            const mockUsuarioInactivo = {
                id_usuario: 1,
                activo: 0
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(null, [mockUsuarioInactivo]);
            });

            // Act
            userController.getEditarPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(403);
                expect(res.send).toHaveBeenCalledWith('Cuenta de usuario inactiva');
                done();
            }, 100);
        });
    });

    // ============================================================
    // PRUEBAS PARA: getEditarPerfilEmpresa
    // ============================================================
    describe('getEditarPerfilEmpresa', () => {
        it('Debería renderizar la página de edición de la empresa', (done) => {
            // Arrange
            const mockEmpresa = {
                id_empresa: 1,
                nombre: 'PetShop Plus',
                activo: 1
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(null, [mockEmpresa]);
            });

            // Act
            userController.getEditarPerfilEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(res.render).toHaveBeenCalledWith('editarPerfilEmpresa', {
                    empresa: mockEmpresa
                });
                expect(connection.release).toHaveBeenCalled();
                done();
            }, 100);
        });

        it('Debería retornar 404 si la empresa no existe', (done) => {
            // Arrange
            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            // Act
            userController.getEditarPerfilEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(404);
                expect(res.send).toHaveBeenCalledWith('Empresa no encontrada');
                done();
            }, 100);
        });

        it('Debería retornar 403 si la empresa está inactiva', (done) => {
            // Arrange
            const mockEmpresaInactiva = {
                id_empresa: 1,
                activo: 0
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(null, [mockEmpresaInactiva]);
            });

            // Act
            userController.getEditarPerfilEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(403);
                expect(res.send).toHaveBeenCalledWith('Cuenta de empresa inactiva');
                done();
            }, 100);
        });
    });

    // ============================================================
    // PRUEBAS PARA: postEditarPerfilUsuario
    // ============================================================
    describe('postEditarPerfilUsuario', () => {
        beforeEach(() => {
            req.body = {
                nombre_completo: 'Juan Pérez Actualizado',
                nombre_usuario: 'juanperez',
                correo: 'juan@example.com',
                fecha_nacimiento: '1990-01-01',
                telefono: '123456789',
                ciudad: 'Madrid',
                pais: 'España',
                codigo_postal: '28001',
                genero: 'M',
                trabajo: 'Ingeniero',
                bio: 'Mi bio'
            };

            validationResult.mockReturnValue({
                isEmpty: jest.fn().mockReturnValue(true),
                array: jest.fn().mockReturnValue([])
            });
        });

        it('Debería actualizar el perfil del usuario correctamente', (done) => {
            // Arrange
            const mockUsuario = {
                id_usuario: 1,
                contraseña: 'hashed_password',
                foto: '/uploads/old.jpg'
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            let queryCount = 0;
            connection.query.mockImplementation((query, params, callback) => {
                queryCount++;
                
                // Primer query: verificar usuario
                if (queryCount === 1) {
                    callback(null, [{ ...mockUsuario, activo: 1 }]);
                }
                // Segundo query: verificar correo
                else if (queryCount === 2) {
                    callback(null, []);
                }
                // Tercer query: verificar nombre usuario
                else if (queryCount === 3) {
                    callback(null, []);
                }
                // Cuarto query: verificar teléfono
                else if (queryCount === 4) {
                    callback(null, []);
                }
                // Quinto query: obtener contraseña y foto actual
                else if (queryCount === 5) {
                    callback(null, [mockUsuario]);
                }
                // Sexto query: update
                else {
                    callback(null);
                }
            });

            // Act
            userController.postEditarPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.redirect).toHaveBeenCalledWith('/user/perfilUsuario/1');
                expect(connection.release).toHaveBeenCalled();
                done();
            }, 150);
        });

        it('Debería retornar error si hay errores de validación', (done) => {
            // Arrange
            const mockErrores = [{ path: 'correo', msg: 'Email inválido' }];
            
            validationResult.mockReturnValue({
                isEmpty: jest.fn().mockReturnValue(false),
                array: jest.fn().mockReturnValue(mockErrores)
            });

            // Act
            userController.postEditarPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.render).toHaveBeenCalledWith(
                    'editarPerfilUsuario',
                    expect.objectContaining({
                        error: 'Por favor corrige los errores en el formulario',
                        errores: mockErrores
                    })
                );
                done();
            }, 100);
        });

        it('Debería retornar error 500 si hay error de conexión', (done) => {
            // Arrange
            pool.getConnection.mockImplementation((callback) => {
                callback(new Error('Connection error'));
            });

            // Act
            userController.postEditarPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(500);
                expect(res.send).toHaveBeenCalled();
                done();
            }, 100);
        });

        it('Debería retornar error 404 si el usuario no existe', (done) => {
            // Arrange
            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            // Act
            userController.postEditarPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(404);
                expect(res.send).toHaveBeenCalledWith('Usuario no encontrado');
                done();
            }, 100);
        });

        it('Debería retornar error 400 si el correo ya está en uso', (done) => {
            // Arrange
            const mockUsuario = {
                id_usuario: 1,
                activo: 1
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            let queryCount = 0;
            connection.query.mockImplementation((query, params, callback) => {
                queryCount++;
                
                if (queryCount === 1) {
                    // Verificar usuario existe
                    callback(null, [mockUsuario]);
                } else if (queryCount === 2) {
                    // Correo ya en uso
                    callback(null, [{ id_usuario: 999 }]);
                }
            });

            // Act
            userController.postEditarPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.render).toHaveBeenCalledWith(
                    'editarPerfilUsuario',
                    expect.objectContaining({
                        error: 'El correo electrónico ya está en uso'
                    })
                );
                done();
            }, 150);
        });

        it('Debería retornar error 400 si el nombre de usuario ya está en uso', (done) => {
            // Arrange
            const mockUsuario = {
                id_usuario: 1,
                activo: 1
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            let queryCount = 0;
            connection.query.mockImplementation((query, params, callback) => {
                queryCount++;
                
                if (queryCount === 1) {
                    callback(null, [mockUsuario]);
                } else if (queryCount === 2) {
                    callback(null, []); // correo OK
                } else if (queryCount === 3) {
                    callback(null, [{ id_usuario: 999 }]); // nombre usuario en uso
                }
            });

            // Act
            userController.postEditarPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.render).toHaveBeenCalledWith(
                    'editarPerfilUsuario',
                    expect.objectContaining({
                        error: 'El nombre de usuario ya está en uso'
                    })
                );
                done();
            }, 150);
        });

        it('Debería retornar error 400 si el teléfono ya está en uso', (done) => {
            // Arrange
            const mockUsuario = {
                id_usuario: 1,
                activo: 1
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            let queryCount = 0;
            connection.query.mockImplementation((query, params, callback) => {
                queryCount++;
                
                if (queryCount === 1) {
                    callback(null, [mockUsuario]);
                } else if (queryCount === 2) {
                    callback(null, []); // correo OK
                } else if (queryCount === 3) {
                    callback(null, []); // nombre usuario OK
                } else if (queryCount === 4) {
                    callback(null, [{ id_usuario: 999 }]); // teléfono en uso
                }
            });

            // Act
            userController.postEditarPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.render).toHaveBeenCalledWith(
                    'editarPerfilUsuario',
                    expect.objectContaining({
                        error: 'El teléfono ya está en uso'
                    })
                );
                done();
            }, 150);
        });

        it('Debería retornar error 400 si la contraseña actual es incorrecta', (done) => {
            // Arrange
            req.body.password_actual = 'wrong_password';
            req.body.password_nueva = 'new_password';

            const mockUsuario = {
                id_usuario: 1,
                activo: 1,
                contraseña: 'hashed_password'
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            let queryCount = 0;
            connection.query.mockImplementation((query, params, callback) => {
                queryCount++;
                
                if (queryCount === 1) {
                    callback(null, [mockUsuario]);
                } else if (queryCount === 2) {
                    callback(null, []); // correo OK
                } else if (queryCount === 3) {
                    callback(null, []); // nombre usuario OK
                } else if (queryCount === 4) {
                    callback(null, []); // teléfono OK
                } else if (queryCount === 5) {
                    callback(null, [mockUsuario]); // obtener contraseña actual
                }
            });

            // Act
            userController.postEditarPerfilUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.render).toHaveBeenCalledWith(
                    'editarPerfilUsuario',
                    expect.objectContaining({
                        error: 'La contraseña actual no es correcta'
                    })
                );
                done();
            }, 150);
        });
    });

    // ============================================================
    // PRUEBAS PARA: postEditarPerfilEmpresa
    // ============================================================
    describe('postEditarPerfilEmpresa', () => {
        beforeEach(() => {
            req.body = {
                nombre: 'PetShop Plus',
                correo: 'petshop@example.com',
                telefono_contacto: '123456789',
                CIF: 'a12345678',
                tipo: 'peluqueria',
                tipo_otro: '',
                ubicacion: 'Madrid',
                descripcion: 'Una tienda de mascotas'
            };

            validationResult.mockReturnValue({
                isEmpty: jest.fn().mockReturnValue(true),
                array: jest.fn().mockReturnValue([])
            });
        });

        it('Debería actualizar el perfil de la empresa correctamente', (done) => {
            // Arrange
            const mockEmpresa = {
                id_empresa: 1,
                contraseña: 'hashed_password',
                foto: '/uploads/old.jpg'
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            let queryCount = 0;
            connection.query.mockImplementation((query, params, callback) => {
                queryCount++;
                
                if (queryCount === 1) {
                    callback(null, [{ ...mockEmpresa, activo: 1 }]);
                } else if (queryCount === 2) {
                    callback(null, []);
                } else if (queryCount === 3) {
                    callback(null, []);
                } else if (queryCount === 4) {
                    callback(null, [mockEmpresa]);
                } else {
                    callback(null);
                }
            });

            // Act
            userController.postEditarPerfilEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(res.redirect).toHaveBeenCalledWith('/user/perfilEmpresa/1');
                done();
            }, 150);
        });

        it('Debería normalizar el CIF a mayúsculas', (done) => {
            // Arrange
            req.body.cif = 'a12345678';  // El controlador busca 'cif' en minúsculas

            const mockEmpresa = {
                id_empresa: 1,
                activo: 1,
                contraseña: 'hashed_password',
                foto: '/uploads/old.jpg'
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            let queryCifCapturado = null;
            let queryCount = 0;
            connection.query.mockImplementation((query, params, callback) => {
                queryCount++;
                
                if (queryCount === 1) {
                    // SELECT * FROM empresas WHERE id_empresa = ?
                    callback(null, [mockEmpresa]);
                } else if (queryCount === 2) {
                    // SELECT id_empresa FROM empresas WHERE correo = ? AND id_empresa != ?
                    callback(null, []);
                } else if (queryCount === 3) {
                    // SELECT id_empresa FROM empresas WHERE CIF = ? AND id_empresa != ?
                    // Capturar el CIF normalizado (primer parámetro)
                    queryCifCapturado = params[0];
                    callback(null, []);
                } else if (queryCount === 4) {
                    // SELECT contraseña, foto FROM empresas WHERE id_empresa = ?
                    callback(null, [mockEmpresa]);
                } else {
                    // UPDATE
                    callback(null);
                }
            });

            // Act
            userController.postEditarPerfilEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(queryCifCapturado).toBe('A12345678');
                done();
            }, 150);
        }, 10000);

        it('Debería retornar error 400 si hay errores de validación', (done) => {
            // Arrange
            const mockErrores = [{ path: 'nombre', msg: 'El nombre es requerido' }];
            
            validationResult.mockReturnValue({
                isEmpty: jest.fn().mockReturnValue(false),
                array: jest.fn().mockReturnValue(mockErrores)
            });

            // Act
            userController.postEditarPerfilEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.render).toHaveBeenCalledWith(
                    'editarPerfilEmpresa',
                    expect.objectContaining({
                        error: 'Por favor corrige los errores en el formulario'
                    })
                );
                done();
            }, 100);
        });

        it('Debería retornar error 400 si el correo ya está en uso', (done) => {
            // Arrange
            const mockEmpresa = {
                id_empresa: 1,
                activo: 1
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            let queryCount = 0;
            connection.query.mockImplementation((query, params, callback) => {
                queryCount++;
                
                if (queryCount === 1) {
                    callback(null, [mockEmpresa]);
                } else if (queryCount === 2) {
                    callback(null, [{ id_empresa: 999 }]); // correo en uso
                }
            });

            // Act
            userController.postEditarPerfilEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.render).toHaveBeenCalledWith(
                    'editarPerfilEmpresa',
                    expect.objectContaining({
                        error: 'El correo electrónico ya está en uso'
                    })
                );
                done();
            }, 150);
        });

        it('Debería retornar error 400 si el CIF ya está registrado', (done) => {
            // Arrange
            const mockEmpresa = {
                id_empresa: 1,
                activo: 1
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            let queryCount = 0;
            connection.query.mockImplementation((query, params, callback) => {
                queryCount++;
                
                if (queryCount === 1) {
                    callback(null, [mockEmpresa]);
                } else if (queryCount === 2) {
                    callback(null, []); // correo OK
                } else if (queryCount === 3) {
                    callback(null, [{ id_empresa: 999 }]); // CIF en uso
                }
            });

            // Act
            userController.postEditarPerfilEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.render).toHaveBeenCalledWith(
                    'editarPerfilEmpresa',
                    expect.objectContaining({
                        error: 'El CIF ya está registrado'
                    })
                );
                done();
            }, 150);
        });

        it('Debería retornar error 400 si la contraseña actual es incorrecta', (done) => {
            // Arrange
            req.body.password_actual = 'wrong_password';
            req.body.password_nueva = 'new_password';

            const mockEmpresa = {
                id_empresa: 1,
                activo: 1,
                contraseña: 'hashed_password'
            };

            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            let queryCount = 0;
            connection.query.mockImplementation((query, params, callback) => {
                queryCount++;
                
                if (queryCount === 1) {
                    callback(null, [mockEmpresa]);
                } else if (queryCount === 2) {
                    callback(null, []);
                } else if (queryCount === 3) {
                    callback(null, []);
                } else if (queryCount === 4) {
                    callback(null, [mockEmpresa]);
                }
            });

            // Act
            userController.postEditarPerfilEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.render).toHaveBeenCalledWith(
                    'editarPerfilEmpresa',
                    expect.objectContaining({
                        error: 'La contraseña actual no es correcta'
                    })
                );
                done();
            }, 150);
        });
    });

    // ============================================================
    // PRUEBAS PARA: postEliminarCuentaUsuario
    // ============================================================
    describe('postEliminarCuentaUsuario', () => {
        it('Debería eliminar (desactivar) la cuenta del usuario correctamente', (done) => {
            // Arrange
            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(null);
            });

            // Act
            userController.postEliminarCuentaUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.redirect).toHaveBeenCalledWith('/auth/logout');
                expect(connection.release).toHaveBeenCalled();
                done();
            }, 100);
        });

        it('Debería retornar error 500 si hay error de conexión', (done) => {
            // Arrange
            pool.getConnection.mockImplementation((callback) => {
                callback(new Error('Connection error'));
            });

            // Act
            userController.postEliminarCuentaUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(500);
                expect(res.send).toHaveBeenCalled();
                done();
            }, 100);
        });

        it('Debería retornar error 500 si hay error en la consulta', (done) => {
            // Arrange
            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(new Error('Query error'));
            });

            // Act
            userController.postEliminarCuentaUsuario(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(500);
                expect(res.send).toHaveBeenCalledWith('Error al eliminar la cuenta del usuario');
                expect(connection.release).toHaveBeenCalled();
                done();
            }, 100);
        });
    });

    // ============================================================
    // PRUEBAS PARA: postEliminarCuentaEmpresa
    // ============================================================
    describe('postEliminarCuentaEmpresa', () => {
        it('Debería eliminar (desactivar) la cuenta de la empresa correctamente', (done) => {
            // Arrange
            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(null);
            });

            // Act
            userController.postEliminarCuentaEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(res.redirect).toHaveBeenCalledWith('/auth/logout');
                expect(connection.release).toHaveBeenCalled();
                done();
            }, 100);
        });

        it('Debería retornar error 500 si hay error de conexión', (done) => {
            // Arrange
            pool.getConnection.mockImplementation((callback) => {
                callback(new Error('Connection error'));
            });

            // Act
            userController.postEliminarCuentaEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(500);
                expect(res.send).toHaveBeenCalled();
                done();
            }, 100);
        });

        it('Debería retornar error 500 si hay error en la consulta', (done) => {
            // Arrange
            pool.getConnection.mockImplementation((callback) => {
                callback(null, connection);
            });

            connection.query.mockImplementation((query, params, callback) => {
                callback(new Error('Query error'));
            });

            // Act
            userController.postEliminarCuentaEmpresa(req, res);

            // Assert
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(500);
                expect(res.send).toHaveBeenCalledWith('Error al eliminar la cuenta de la empresa');
                expect(connection.release).toHaveBeenCalled();
                done();
            }, 100);
        });
    });
});

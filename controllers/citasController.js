"use strict";

const pool = require("../db");


const getCitas = (req, res) => {
    const id_usuario = req.session.usuario.id;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).json({ error: "Error al conectar a la base de datos" });
        }

        const query_cliente = `
            SELECT r.*, u.nombre_completo AS proveedor_nombre_completo, u.foto AS proveedor_foto,
                   a.tipo_servicio
            FROM reservas r
            LEFT JOIN chats c ON r.id_chat = c.id_chat
            LEFT JOIN anuncios a ON c.id_anuncio = a.id_anuncio
            LEFT JOIN usuarios u ON r.id_proveedor = u.id_usuario
            WHERE r.id_cliente = ?
        `;

        const query_proveedor = `
            SELECT r.*, u.nombre_completo AS cliente_nombre_completo, u.foto AS cliente_foto,
                   a.tipo_servicio
            FROM reservas r
            LEFT JOIN chats c ON r.id_chat = c.id_chat
            LEFT JOIN anuncios a ON c.id_anuncio = a.id_anuncio
            LEFT JOIN usuarios u ON r.id_cliente = u.id_usuario
            WHERE r.id_proveedor = ?
        `;

        const formatFechaEspaña = (fecha) => {
            if (!fecha) return null;
            const date = new Date(fecha);
            const formatted = date.toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
            const cleaned = formatted.replace(/,/g, '').trim();
            return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        };

        const mapCitasConFecha = (citas) => citas.map((cita) => ({
            ...cita,
            fecha_formateada: formatFechaEspaña(cita.fecha)
        }));

        connection.query(query_cliente, [id_usuario], (err, citas_cliente) => {
            if (err) {
                connection.release();
                console.error("Error al obtener las citas del cliente:", err);
                return res.status(500).json({ error: "Error al obtener las citas del cliente" });
            }

            connection.query(query_proveedor, [id_usuario], (err, citas_proveedor) => {
                connection.release();
                if (err) {
                    console.error("Error al obtener las citas del proveedor:", err);
                    return res.status(500).json({ error: "Error al obtener las citas del proveedor" });
                }

                const citasClienteFormateadas = mapCitasConFecha(citas_cliente);
                const citasProveedorFormateadas = mapCitasConFecha(citas_proveedor);

                console.log("Citas del cliente:", citasClienteFormateadas);
                console.log("Citas del proveedor:", citasProveedorFormateadas);

                return res.render("citas", {
                    citas_cliente: citasClienteFormateadas,
                    citas_proveedor: citasProveedorFormateadas
                });
            });
        });
    });
}

module.exports = {
    getCitas
};
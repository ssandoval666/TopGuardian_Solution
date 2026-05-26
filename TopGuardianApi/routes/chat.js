const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     ChatMessage:
 *       type: object
 *       required:
 *         - from_user_id
 *         - to_user_id
 *         - message_text
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único del mensaje
 *         from_user_id:
 *           type: integer
 *           description: ID del usuario que envía el mensaje
 *         to_user_id:
 *           type: integer
 *           description: ID del usuario que recibe el mensaje
 *         message_text:
 *           type: string
 *           description: Contenido del mensaje
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Fecha y hora del mensaje
 *         read_status:
 *           type: boolean
 *           description: Indica si el mensaje ha sido leído
 *     ChatUser:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID del usuario
 *         name:
 *           type: string
 *           description: Nombre completo del usuario
 *         username:
 *           type: string
 *           description: Nombre de usuario
 *         online:
 *           type: boolean
 *           description: Estado online del usuario
 */

/**
 * @swagger
 * /chat/messages:
 *   get:
 *     summary: Obtener mensajes de chat entre dos usuarios
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: other_user_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del otro usuario en la conversación
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Número máximo de mensajes a retornar
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Número de mensajes a saltar
 *     responses:
 *       200:
 *         description: Lista de mensajes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ChatMessage'
 */
router.get('/messages', authenticateToken, async (req, res) => {
  try {
    const { other_user_id, limit = 50, offset = 0 } = req.query;
    const currentUserId = req.user.id;

    if (!other_user_id) {
      return res.status(400).json({ error: 'other_user_id es requerido' });
    }

    const messages = await db.allAsync(`
      SELECT
        id,
        from_user_id,
        to_user_id,
        message_text,
        timestamp,
        read_status
      FROM chat_messages
      WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `, [currentUserId, other_user_id, other_user_id, currentUserId, parseInt(limit), parseInt(offset)]);

    // Marcar mensajes como leídos
    await db.runAsync(`
      UPDATE chat_messages
      SET read_status = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE to_user_id = ? AND from_user_id = ? AND read_status = FALSE
    `, [currentUserId, other_user_id]);

    res.json(messages.reverse()); // Revertir para orden cronológico
  } catch (error) {
    console.error('Error obteniendo mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * @swagger
 * /chat/messages:
 *   post:
 *     summary: Enviar un mensaje de chat
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to_user_id
 *               - message_text
 *             properties:
 *               to_user_id:
 *                 type: integer
 *                 description: ID del usuario destinatario
 *               message_text:
 *                 type: string
 *                 description: Contenido del mensaje
 *     responses:
 *       201:
 *         description: Mensaje enviado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatMessage'
 */
router.post('/messages', authenticateToken, async (req, res) => {
  try {
    const { to_user_id, message_text } = req.body;
    const from_user_id = req.user.id;

    if (!to_user_id || !message_text) {
      return res.status(400).json({ error: 'to_user_id y message_text son requeridos' });
    }

    if (message_text.trim().length === 0) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
    }

    // Verificar que el usuario destinatario existe
    const recipient = await db.getAsync('SELECT id FROM users WHERE id = ?', [to_user_id]);
    if (!recipient) {
      return res.status(404).json({ error: 'Usuario destinatario no encontrado' });
    }

    const result = await db.runAsync(`
      INSERT INTO chat_messages (from_user_id, to_user_id, message_text)
      VALUES (?, ?, ?)
    `, [from_user_id, to_user_id, message_text.trim()]);

    const message = await db.getAsync(`
      SELECT
        id,
        from_user_id,
        to_user_id,
        message_text,
        timestamp,
        read_status
      FROM chat_messages
      WHERE id = ?
    `, [result.lastID]);

    res.status(201).json(message);
  } catch (error) {
    console.error('Error enviando mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * @swagger
 * /chat/users:
 *   get:
 *     summary: Obtener lista de usuarios disponibles para chat
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ChatUser'
 */
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Obtener todos los usuarios excepto el actual
    const users = await db.allAsync(`
      SELECT
        u.id,
        u.name,
        u.username,
        COALESCE(up.is_online, FALSE) as online,
        up.last_seen
      FROM users u
      LEFT JOIN user_presence up ON u.id = up.user_id
      WHERE u.id != ?
      ORDER BY u.name
    `, [currentUserId]);

    res.json(users);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * @swagger
 * /chat/presence:
 *   post:
 *     summary: Actualizar presencia del usuario (online/offline)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - is_online
 *             properties:
 *               is_online:
 *                 type: boolean
 *                 description: Estado online del usuario
 *     responses:
 *       200:
 *         description: Presencia actualizada exitosamente
 */
router.post('/presence', authenticateToken, async (req, res) => {
  try {
    const { is_online } = req.body;
    const userId = req.user.id;

    if (typeof is_online !== 'boolean') {
      return res.status(400).json({ error: 'is_online debe ser un booleano' });
    }

    await db.runAsync(`
      INSERT OR REPLACE INTO user_presence (user_id, is_online, last_seen)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [userId, is_online]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando presencia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * @swagger
 * /chat/unread-count:
 *   get:
 *     summary: Obtener conteo de mensajes no leídos
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conteo de mensajes no leídos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_unread:
 *                   type: integer
 *                   description: Total de mensajes no leídos
 *                 unread_by_user:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user_id:
 *                         type: integer
 *                       user_name:
 *                         type: string
 *                       unread_count:
 *                         type: integer
 */
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Total de mensajes no leídos
    const totalUnread = await db.getAsync(`
      SELECT COUNT(*) as count
      FROM chat_messages
      WHERE to_user_id = ? AND read_status = FALSE
    `, [currentUserId]);

    // Mensajes no leídos por usuario
    const unreadByUser = await db.allAsync(`
      SELECT
        u.id as user_id,
        u.name as user_name,
        COUNT(cm.id) as unread_count
      FROM users u
      LEFT JOIN chat_messages cm ON cm.from_user_id = u.id AND cm.to_user_id = ? AND cm.read_status = FALSE
      WHERE u.id != ?
      GROUP BY u.id, u.name
      HAVING unread_count > 0
      ORDER BY u.name
    `, [currentUserId, currentUserId]);

    res.json({
      total_unread: totalUnread.count || 0,
      unread_by_user: unreadByUser
    });
  } catch (error) {
    console.error('Error obteniendo conteo de no leídos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * @swagger
 * /chat/mark-read/{userId}:
 *   put:
 *     summary: Marcar mensajes como leídos de un usuario específico
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario cuyos mensajes marcar como leídos
 *     responses:
 *       200:
 *         description: Mensajes marcados como leídos
 */
router.put('/mark-read/:userId', authenticateToken, async (req, res) => {
  try {
    const fromUserId = parseInt(req.params.userId);
    const currentUserId = req.user.id;

    if (!fromUserId) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    await db.runAsync(`
      UPDATE chat_messages
      SET read_status = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE from_user_id = ? AND to_user_id = ? AND read_status = FALSE
    `, [fromUserId, currentUserId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marcando mensajes como leídos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

/**
 * @swagger
 * /users/list:
 *   get:
 *     summary: Get paginated users list
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated users
 */
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const search = req.query.search || '';
    const offset = (page - 1) * pageSize;

    let query = 'SELECT id, name, username, email, role, phone, active, created_at FROM users WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR username LIKE ? OR email LIKE ?)';
      countQuery += ' AND (name LIKE ? OR username LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY name LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const [users, countResult] = await Promise.all([
      db.allAsync(query, params),
      db.getAsync(countQuery, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [])
    ]);

    res.json({
      data: users,
      total: countResult.total,
      page,
      pageSize
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - username
 *               - email
 *               - role
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/', authenticateToken, authorizeRole(['Administrador']), async (req, res) => {
  try {
    const { name, username, email, role, phone, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.runAsync(
      'INSERT INTO users (name, username, email, role, phone, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
      [name, username, email, role, phone, hashedPassword]
    );

    const user = await db.getAsync('SELECT id, name, username, email, role, phone, active, created_at FROM users WHERE id = ?', [result.lastID]);
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      res.status(400).json({ error: 'Usuario o email ya existe' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *               phone:
 *                 type: string
 *               active:
 *                 type: boolean
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated
 */
router.put('/:id', authenticateToken, authorizeRole(['Administrador']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, email, role, phone, active, password } = req.body;

    let updateFields = [];
    let params = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      params.push(name);
    }
    if (username !== undefined) {
      updateFields.push('username = ?');
      params.push(username);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      params.push(email);
    }
    if (role !== undefined) {
      updateFields.push('role = ?');
      params.push(role);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      params.push(phone);
    }
    if (active !== undefined) {
      updateFields.push('active = ?');
      params.push(active ? 1 : 0);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push('password_hash = ?');
      params.push(hashedPassword);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    await db.runAsync(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, params);

    const user = await db.getAsync('SELECT id, name, username, email, role, phone, active, created_at FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: User deleted
 */
router.delete('/:id', authenticateToken, authorizeRole(['Administrador']), async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM users WHERE id = ?', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /users/{id}/force-logout:
 *   post:
 *     summary: Force logout a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.post('/:id/force-logout', authenticateToken, authorizeRole(['Administrador']), async (req, res) => {
  try {
    const { id } = req.params;
    const io = req.app.get('io');
    if (io) io.to(id.toString()).emit('force_logout');
    res.json({ success: true, message: 'Orden de desconexión enviada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
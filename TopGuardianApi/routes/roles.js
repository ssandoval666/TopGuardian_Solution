const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

/**
 * @swagger
 * /roles/list:
 *   get:
 *     summary: Get paginated roles list
 *     tags: [Roles]
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
 *         description: Paginated roles
 */
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const search = req.query.search || '';
    const offset = (page - 1) * pageSize;

    let query = 'SELECT id, nombre, fecha_creacion FROM roles WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM roles WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND nombre LIKE ?';
      countQuery += ' AND nombre LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const [rows, countResult] = await Promise.all([
      new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }),
      new Promise((resolve, reject) => {
        db.get(countQuery, params.slice(0, -2), (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      })
    ]);

    res.json({
      data: rows,
      pagination: {
        page,
        pageSize,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / pageSize)
      }
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /roles:
 *   post:
 *     summary: Create a new role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *             properties:
 *               nombre:
 *                 type: string
 *     responses:
 *       201:
 *         description: Role created
 */
router.post('/', authenticateToken, authorizeRole(['Administrador']), async (req, res) => {
  try {
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'Nombre is required' });
    }

    const result = await new Promise((resolve, reject) => {
      db.run('INSERT INTO roles (nombre) VALUES (?)', [nombre], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });

    res.status(201).json({ id: result.id, nombre, fecha_creacion: new Date().toISOString() });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /roles/{id}:
 *   put:
 *     summary: Update a role
 *     tags: [Roles]
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
 *             required:
 *               - nombre
 *             properties:
 *               nombre:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role updated
 */
router.put('/:id', authenticateToken, authorizeRole(['Administrador']), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'Nombre is required' });
    }

    await new Promise((resolve, reject) => {
      db.run('UPDATE roles SET nombre = ? WHERE id = ?', [nombre, id], function(err) {
        if (err) reject(err);
        else if (this.changes === 0) reject(new Error('Role not found'));
        else resolve();
      });
    });

    res.json({ id: parseInt(id), nombre });
  } catch (error) {
    if (error.message === 'Role not found') {
      res.status(404).json({ error: 'Role not found' });
    } else {
      console.error('Error updating role:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * @swagger
 * /roles/{id}:
 *   delete:
 *     summary: Delete a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Role deleted
 */
router.delete('/:id', authenticateToken, authorizeRole(['Administrador']), async (req, res) => {
  try {
    const { id } = req.params;

    await new Promise((resolve, reject) => {
      db.run('DELETE FROM roles WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else if (this.changes === 0) reject(new Error('Role not found'));
        else resolve();
      });
    });

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    if (error.message === 'Role not found') {
      res.status(404).json({ error: 'Role not found' });
    } else {
      console.error('Error deleting role:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

module.exports = router;
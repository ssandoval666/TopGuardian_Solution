const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

/**
 * @swagger
 * /companies:
 *   get:
 *     summary: Get companies for user
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of companies
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const companies = await db.allAsync('SELECT * FROM companies ORDER BY name');
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /companies/list:
 *   get:
 *     summary: Get paginated companies list
 *     tags: [Companies]
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
 *         description: Paginated companies
 */
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const search = req.query.search || '';
    const offset = (page - 1) * pageSize;

    let query = 'SELECT * FROM companies WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM companies WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR ruc LIKE ?)';
      countQuery += ' AND (name LIKE ? OR ruc LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY name LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const [companies, countResult] = await Promise.all([
      db.allAsync(query, params),
      db.getAsync(countQuery, search ? [`%${search}%`, `%${search}%`] : [])
    ]);

    res.json({
      data: companies,
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
 * /companies:
 *   post:
 *     summary: Create company
 *     tags: [Companies]
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
 *               - ruc
 *             properties:
 *               name:
 *                 type: string
 *               ruc:
 *                 type: string
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Company created
 */
router.post('/', authenticateToken, authorizeRole(['Administrador']), async (req, res) => {
  try {
    const { name, ruc, address, phone, email } = req.body;
    const result = await db.runAsync(
      'INSERT INTO companies (name, ruc, address, phone, email) VALUES (?, ?, ?, ?, ?)',
      [name, ruc, address, phone, email]
    );
    const company = await db.getAsync('SELECT * FROM companies WHERE id = ?', [result.lastID]);
    res.status(201).json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /companies/{id}:
 *   put:
 *     summary: Update company
 *     tags: [Companies]
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
 *               ruc:
 *                 type: string
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Company updated
 */
router.put('/:id', authenticateToken, authorizeRole(['Administrador']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, ruc, address, phone, email } = req.body;

    await db.runAsync(
      'UPDATE companies SET name = ?, ruc = ?, address = ?, phone = ?, email = ? WHERE id = ?',
      [name, ruc, address, phone, email, id]
    );

    const company = await db.getAsync('SELECT * FROM companies WHERE id = ?', [id]);
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });

    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /companies/{id}:
 *   delete:
 *     summary: Delete company
 *     tags: [Companies]
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
 *         description: Company deleted
 */
router.delete('/:id', authenticateToken, authorizeRole(['Administrador']), async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM companies WHERE id = ?', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /companies/{id}/users:
 *   get:
 *     summary: Get users assigned to a company
 *     tags: [Companies]
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
 *         description: List of user IDs
 */
router.get('/:id/users', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await db.allAsync('SELECT user_id FROM company_users WHERE company_id = ?', [id]);
    // El frontend espera un array de strings con los IDs
    res.json(rows.map(r => String(r.user_id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /companies/{id}/users:
 *   put:
 *     summary: Update users assigned to a company
 *     tags: [Companies]
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
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Users updated
 */
router.put('/:id/users', authenticateToken, authorizeRole(['Administrador']), async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;

    // Eliminar las asignaciones anteriores para esta empresa
    await db.runAsync('DELETE FROM company_users WHERE company_id = ?', [id]);

    // Insertar las nuevas asignaciones
    if (userIds && Array.isArray(userIds)) {
      for (const userId of userIds) {
        if (userId) {
          await db.runAsync('INSERT OR IGNORE INTO company_users (company_id, user_id) VALUES (?, ?)', [id, userId]);
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error en PUT /companies/:id/users:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
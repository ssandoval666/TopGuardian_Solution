const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

/**
 * @swagger
 * /planos:
 *   get:
 *     summary: Get planos for company
 *     tags: [Planos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: companyId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Company planos
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.query;
    
    let sql = 'SELECT * FROM planos';
    const params = [];
    if (companyId) {
      sql += ' WHERE company_id = ?';
      params.push(companyId);
    }
    sql += ' ORDER BY created_at DESC';
    
    const planos = await db.allAsync(sql, params);
    res.json(planos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /planos:
 *   post:
 *     summary: Create plano
 *     tags: [Planos]
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
 *               - companyId
 *               - fileName
 *               - fileData
 *             properties:
 *               name:
 *                 type: string
 *               companyId:
 *                 type: integer
 *               fileName:
 *                 type: string
 *               fileData:
 *                 type: string
 *                 description: Base64 encoded file data
 *     responses:
 *       201:
 *         description: Plano created
 */
router.post('/', authenticateToken, authorizeRole(['Administrador', 'Editor']), async (req, res) => {
  try {
    const { name, companyId, fileName, fileData } = req.body;
    // Convert base64 to buffer
    const buffer = Buffer.from(fileData, 'base64');

    const result = await db.runAsync(
      'INSERT INTO planos (name, company_id, file_name, file_data) VALUES (?, ?, ?, ?)',
      [name, companyId, fileName, buffer]
    );

    const plano = await db.getAsync('SELECT id, name, company_id, file_name, created_at FROM planos WHERE id = ?', [result.lastID]);
    res.status(201).json(plano);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /planos/{id}:
 *   put:
 *     summary: Update plano
 *     tags: [Planos]
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
 *               fileName:
 *                 type: string
 *               fileData:
 *                 type: string
 *                 description: Base64 encoded file data
 *     responses:
 *       200:
 *         description: Plano updated
 */
router.put('/:id', authenticateToken, authorizeRole(['Administrador', 'Editor']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, fileName, fileData } = req.body;

    let updateFields = [];
    let params = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      params.push(name);
    }
    if (fileName !== undefined) {
      updateFields.push('file_name = ?');
      params.push(fileName);
    }
    if (fileData !== undefined) {
      const buffer = Buffer.from(fileData, 'base64');
      updateFields.push('file_data = ?');
      params.push(buffer);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    await db.runAsync(`UPDATE planos SET ${updateFields.join(', ')} WHERE id = ?`, params);

    const plano = await db.getAsync('SELECT id, name, company_id, file_name, created_at FROM planos WHERE id = ?', [id]);
    if (!plano) return res.status(404).json({ error: 'Plano no encontrado' });

    res.json(plano);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /planos/{id}/download:
 *   get:
 *     summary: Download plano file
 *     tags: [Planos]
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
 *         description: File download
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const plano = await db.getAsync('SELECT * FROM planos WHERE id = ?', [id]);

    if (!plano) return res.status(404).json({ error: 'Plano no encontrado' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${plano.file_name}"`);
    res.send(plano.file_data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /planos/{id}:
 *   delete:
 *     summary: Delete plano
 *     tags: [Planos]
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
 *         description: Plano deleted
 */
router.delete('/:id', authenticateToken, authorizeRole(['Administrador', 'Editor']), async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM planos WHERE id = ?', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
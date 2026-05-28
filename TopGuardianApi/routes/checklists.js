const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * /checklists/items:
 *   get:
 *     summary: Get all checklist items
 *     tags: [Checklist Items]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All checklist items
 */
router.get('/items', authenticateToken, async (req, res) => {
  try {
    const items = await db.allAsync('SELECT * FROM checklist_items ORDER BY category, name');
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /checklists/items:
 *   post:
 *     summary: Create checklist item
 *     tags: [Checklist Items]
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
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *     responses:
 *       201:
 *         description: Checklist item created
 */
router.post('/items', authenticateToken, async (req, res) => {
  try {
    const { name, category } = req.body;
    const result = await db.runAsync(
      'INSERT INTO checklist_items (name, category) VALUES (?, ?)',
      [name, category]
    );
    const item = await db.getAsync('SELECT * FROM checklist_items WHERE id = ?', [result.lastID]);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /checklists/items/{id}:
 *   put:
 *     summary: Update checklist item
 *     tags: [Checklist Items]
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
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Checklist item updated
 */
router.put('/items/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category } = req.body;

    await db.runAsync(
      'UPDATE checklist_items SET name = ?, category = ? WHERE id = ?',
      [name, category, id]
    );

    const item = await db.getAsync('SELECT * FROM checklist_items WHERE id = ?', [id]);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /checklists/items/{id}:
 *   delete:
 *     summary: Delete checklist item
 *     tags: [Checklist Items]
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
 *         description: Checklist item deleted
 */
router.delete('/items/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM checklist_items WHERE id = ?', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /checklists/visits:
 *   get:
 *     summary: Get checklist visits for company
 *     tags: [Checklist Visits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Company checklist visits
 */
router.get('/visits', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.query;
    
    let sql = `
      SELECT cv.*, c.name as company_name,
             GROUP_CONCAT(
               JSON_OBJECT(
                 'itemId', ce.item_id,
                 'itemName', ci.name,
                 'compliant', ce.compliant,
                 'observations', ce.observations
               )
             ) as entries
      FROM checklist_visits cv
      JOIN companies c ON cv.company_id = c.id
      LEFT JOIN checklist_entries ce ON cv.id = ce.visit_id
      LEFT JOIN checklist_items ci ON ce.item_id = ci.id
    `;
    const params = [];
    if (companyId) {
      sql += ` WHERE cv.company_id = ?`;
      params.push(companyId);
    }
    sql += ` GROUP BY cv.id ORDER BY cv.visit_date DESC`;

    const visits = await db.allAsync(sql, params);

    // Parse the JSON entries
    const visitsWithEntries = visits.map(visit => {
      const rawEntries = visit.entries ? JSON.parse(`[${visit.entries}]`) : [];
      const cleanedEntries = rawEntries
        .filter(e => e.itemId !== null) // Remove null entries from LEFT JOIN on visits with no entries
        .map(e => ({
          ...e,
          // SQLite returns 0/1 for booleans, convert to true/false
          compliant: e.compliant === 1 ? true : (e.compliant === 0 ? false : null)
        }));
      return { ...visit, entries: cleanedEntries };
    });

    res.json(visitsWithEntries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /checklists/visits:
 *   post:
 *     summary: Create checklist visit
 *     tags: [Checklist Visits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyId
 *               - visitDate
 *               - entries
 *             properties:
 *               companyId:
 *                 type: integer
 *               visitDate:
 *                 type: string
 *               entries:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: integer
 *                     compliant:
 *                       type: boolean
 *                     observations:
 *                       type: string
 *     responses:
 *       201:
 *         description: Checklist visit created
 */
router.post('/visits', authenticateToken, async (req, res) => {
  const dbConnection = db; // Use a transaction-like approach
  try {
    const { companyId, visitDate, entries } = req.body;

    // Insert visit
    const visitResult = await db.runAsync(
      'INSERT INTO checklist_visits (company_id, visit_date) VALUES (?, ?)',
      [companyId, visitDate]
    );

    const visitId = visitResult.lastID;

    // Insert entries
    for (const entry of entries) {
      await db.runAsync(
        'INSERT INTO checklist_entries (visit_id, item_id, compliant, observations) VALUES (?, ?, ?, ?)',
        [visitId, entry.itemId, entry.compliant, entry.observations || '']
      );
    }

    // Get the complete visit with entries
    const visit = await db.getAsync(`
      SELECT cv.*, c.name as company_name
      FROM checklist_visits cv
      JOIN companies c ON cv.company_id = c.id
      WHERE cv.id = ?
    `, [visitId]);

    const visitEntries = await db.allAsync(`
      SELECT ce.*, ci.name as itemName
      FROM checklist_entries ce
      JOIN checklist_items ci ON ce.item_id = ci.id
      WHERE ce.visit_id = ?
    `, [visitId]);

    const io = req.app.get('io');
    if (io) {
      io.emit('company_activity', {
        companyId: String(companyId),
        message: `Nuevo Check List registrado para el ${visitDate} por ${req.user.name || req.user.username}`,
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      ...visit,
      entries: visitEntries.map(entry => ({
        itemId: entry.item_id,
        itemName: entry.itemName,
        compliant: entry.compliant === 1 ? true : (entry.compliant === 0 ? false : null),
        observations: entry.observations
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /checklists/visits/{id}:
 *   put:
 *     summary: Update checklist visit
 *     tags: [Checklist Visits]
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
 *               visitDate:
 *                 type: string
 *               entries:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: integer
 *                     compliant:
 *                       type: boolean
 *                     observations:
 *                       type: string
 *     responses:
 *       200:
 *         description: Checklist visit updated
 */
router.put('/visits/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { visitDate, entries } = req.body;

    // Update visit
    if (visitDate) {
      await db.runAsync('UPDATE checklist_visits SET visit_date = ? WHERE id = ?', [visitDate, id]);
    }

    // Update entries if provided
    if (entries) {
      // Delete existing entries
      await db.runAsync('DELETE FROM checklist_entries WHERE visit_id = ?', [id]);

      // Insert new entries
      for (const entry of entries) {
        await db.runAsync(
          'INSERT INTO checklist_entries (visit_id, item_id, compliant, observations) VALUES (?, ?, ?, ?)',
          [id, entry.itemId, entry.compliant, entry.observations || '']
        );
      }
    }

    // Get updated visit
    const visit = await db.getAsync(`
      SELECT cv.*, c.name as company_name
      FROM checklist_visits cv
      JOIN companies c ON cv.company_id = c.id
      WHERE cv.id = ?
    `, [id]);

    if (!visit) return res.status(404).json({ error: 'Visita no encontrada' });

    const visitEntries = await db.allAsync(`
      SELECT ce.*, ci.name as itemName
      FROM checklist_entries ce
      JOIN checklist_items ci ON ce.item_id = ci.id
      WHERE ce.visit_id = ?
    `, [id]);

    res.json({
      ...visit,
      entries: visitEntries.map(entry => ({
        itemId: entry.item_id,
        itemName: entry.itemName,
        compliant: entry.compliant === 1 ? true : (entry.compliant === 0 ? false : null),
        observations: entry.observations
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /checklists/visits/{id}:
 *   delete:
 *     summary: Delete checklist visit
 *     tags: [Checklist Visits]
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
 *         description: Checklist visit deleted
 */
router.delete('/visits/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    // Delete entries first due to foreign key constraint
    await db.runAsync('DELETE FROM checklist_entries WHERE visit_id = ?', [id]);
    await db.runAsync('DELETE FROM checklist_visits WHERE id = ?', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
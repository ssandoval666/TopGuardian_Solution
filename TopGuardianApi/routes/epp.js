const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Epp:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 */

// GET all EPPs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const epps = await db.allAsync('SELECT * FROM epps ORDER BY name');
    res.json(epps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const epp = await db.getAsync('SELECT * FROM epps WHERE id = ?', [req.params.id]);
    if (!epp) return res.status(404).json({ error: 'EPP no encontrado' });
    res.json(epp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST new EPP
router.post('/', authenticateToken, authorizeRole(['Administrador']), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  try {
    const result = await db.runAsync(
      'INSERT INTO epps (name, description) VALUES (?, ?)',
      [name, description || '']
    );
    const newEpp = await db.getAsync('SELECT * FROM epps WHERE id = ?', [result.lastID]);
    res.status(201).json(newEpp);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Ya existe un EPP con ese nombre' });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT update EPP
router.put('/:id', authenticateToken, authorizeRole(['Administrador']), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  try {
    await db.runAsync(
      'UPDATE epps SET name = ?, description = ? WHERE id = ?',
      [name, description || '', req.params.id]
    );
    const updatedEpp = await db.getAsync('SELECT * FROM epps WHERE id = ?', [req.params.id]);
    if (!updatedEpp) return res.status(404).json({ error: 'EPP no encontrado' });
    res.json(updatedEpp);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Ya existe un EPP con ese nombre' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE EPP
router.delete('/:id', authenticateToken, authorizeRole(['Administrador']), async (req, res) => {
  try {
    const epp = await db.getAsync('SELECT * FROM epps WHERE id = ?', [req.params.id]);
    if (!epp) return res.status(404).json({ error: 'EPP no encontrado' });

    await db.runAsync('DELETE FROM epps WHERE id = ?', [req.params.id]);
    res.json({ message: 'EPP eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
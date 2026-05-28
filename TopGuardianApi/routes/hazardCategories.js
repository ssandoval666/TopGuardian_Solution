const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Solo validamos el token, no el rol (según el requerimiento)

router.get('/', authenticateToken, async (req, res) => {
  try {
    const categories = await db.allAsync('SELECT * FROM hazard_categories ORDER BY name');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const result = await db.runAsync('INSERT INTO hazard_categories (name) VALUES (?)', [name]);
    const category = await db.getAsync('SELECT * FROM hazard_categories WHERE id = ?', [result.lastID]);
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      res.status(400).json({ error: 'La categoría ya existe' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    await db.runAsync('UPDATE hazard_categories SET name = ? WHERE id = ?', [name, id]);
    const category = await db.getAsync('SELECT * FROM hazard_categories WHERE id = ?', [id]);
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM hazard_categories WHERE id = ?', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
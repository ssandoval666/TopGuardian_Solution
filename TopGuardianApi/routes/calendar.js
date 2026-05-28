const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// GET /calendar - Obtener citas del usuario (filtradas por fecha exacta o mes)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date, month } = req.query;

    let sql = 'SELECT * FROM appointments WHERE user_id = ?';
    let params = [userId];

    if (date) {
      sql += ' AND date = ?';
      params.push(date);
    } else if (month) {
      // month esperado en formato YYYY-MM
      sql += ' AND date LIKE ?';
      params.push(`${month}-%`);
    }

    sql += ' ORDER BY date ASC, start_time ASC';

    const appointments = await db.allAsync(sql, params);

    const mapped = appointments.map(a => ({
      id: String(a.id),
      title: a.title,
      date: a.date,
      startTime: a.start_time,
      endTime: a.end_time,
      notes: a.notes,
      completed: Boolean(a.completed),
      userId: String(a.user_id)
    }));

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /calendar/pending-count - Contar pendientes del día actual
router.get('/pending-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const row = await db.getAsync(
      'SELECT COUNT(*) as count FROM appointments WHERE user_id = ? AND date = ? AND completed = 0',
      [userId, today]
    );

    res.json({ count: row.count || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /calendar - Crear nueva cita
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, date, startTime, endTime, notes, completed } = req.body;

    const result = await db.runAsync(
      'INSERT INTO appointments (user_id, title, date, start_time, end_time, notes, completed) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, title, date, startTime, endTime, notes || "", completed ? 1 : 0]
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('global_notification', {
        id: `cal-${result.lastID}`,
        title: "Nueva Cita en Calendario",
        message: `Se ha agendado: "${title}" para el ${date} a las ${startTime}`,
        time: "Justo ahora",
        read: false,
        type: "info"
      });
    }

    res.status(201).json({ id: String(result.lastID), title, date, startTime, endTime, notes, completed: Boolean(completed), userId: String(userId) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /calendar/:id - Actualizar cita existente
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, date, startTime, endTime, notes, completed } = req.body;

    const existing = await db.getAsync('SELECT * FROM appointments WHERE id = ? AND user_id = ?', [id, userId]);
    if (!existing) return res.status(404).json({ error: 'Cita no encontrada' });

    const newTitle = title !== undefined ? title : existing.title;
    const newDate = date !== undefined ? date : existing.date;
    const newStartTime = startTime !== undefined ? startTime : existing.start_time;
    const newEndTime = endTime !== undefined ? endTime : existing.end_time;
    const newNotes = notes !== undefined ? notes : existing.notes;
    const newCompleted = completed !== undefined ? (completed ? 1 : 0) : existing.completed;

    await db.runAsync(
      'UPDATE appointments SET title = ?, date = ?, start_time = ?, end_time = ?, notes = ?, completed = ? WHERE id = ?',
      [newTitle, newDate, newStartTime, newEndTime, newNotes, newCompleted, id]
    );

    res.json({ id, title: newTitle, date: newDate, startTime: newStartTime, endTime: newEndTime, notes: newNotes, completed: Boolean(newCompleted), userId: String(userId) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /calendar/:id - Eliminar cita
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await db.runAsync('DELETE FROM appointments WHERE id = ? AND user_id = ?', [id, userId]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
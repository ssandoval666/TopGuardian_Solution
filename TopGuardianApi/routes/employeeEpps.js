const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Asegurar compatibilidad de schema agregando la columna
(async () => {
  try {
    await db.runAsync('ALTER TABLE employee_epps ADD COLUMN delivered_by_user_id INTEGER REFERENCES users(id)');
  } catch (e) {
    // Si la columna ya existe o la tabla no está creada aún, se ignora el error
  }
})();

// GET: Obtener EPPs asignados a un empleado específico
router.get('/employee/:employeeId', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT ee.id, ee.employee_id, ee.epp_id, ee.delivery_date, e.name as epp_name, u.name as delivered_by_user_name
      FROM employee_epps ee
      JOIN epps e ON ee.epp_id = e.id
      LEFT JOIN users u ON ee.delivered_by_user_id = u.id
      WHERE ee.employee_id = ?
      ORDER BY ee.delivery_date DESC
    `;
    const results = await db.allAsync(sql, [req.params.employeeId]);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Asignar uno o múltiples EPPs a un empleado con una fecha de entrega
router.post('/', authenticateToken, async (req, res) => {
  const { employeeId, eppIds, deliveryDate } = req.body;
  if (!employeeId || !eppIds || !Array.isArray(eppIds) || !deliveryDate) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  try {
    for (const eppId of eppIds) {
      await db.runAsync(
        'INSERT INTO employee_epps (employee_id, epp_id, delivery_date, delivered_by_user_id) VALUES (?, ?, ?, ?)',
        [employeeId, eppId, deliveryDate, req.user?.id || null]
      );
    }

    // Notificar por WebSockets a los usuarios de la empresa
    const employee = await db.getAsync(
      'SELECT company_id, first_name, last_name FROM employees WHERE id = ?',
      [employeeId]
    );

    if (employee) {
      const io = req.app.get('io');
      if (io) {
        const userName = req.user?.name || req.user?.username || 'Sistema';
        io.emit('company_activity', {
          companyId: String(employee.company_id),
          message: `Se entregaron ${eppIds.length} EPP(s) a ${employee.first_name} ${employee.last_name} por ${userName}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    res.status(201).json({ message: 'EPPs asignados correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Remover una asignación
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.runAsync('DELETE FROM employee_epps WHERE id = ?', [req.params.id]);
    res.json({ message: 'Asignación eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
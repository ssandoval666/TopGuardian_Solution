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
  try {
    await db.runAsync('ALTER TABLE employee_epps ADD COLUMN quantity INTEGER DEFAULT 1');
  } catch (e) {}
  try {
    await db.runAsync('ALTER TABLE employee_epps ADD COLUMN signature_data BLOB');
  } catch (e) {}
})();

// GET: Obtener EPPs asignados a un empleado específico
router.get('/employee/:employeeId', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT ee.id, ee.employee_id, ee.epp_id, ee.delivery_date, ee.quantity, ee.signature_data, e.name as epp_name, u.name as delivered_by_user_name
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
  const { employeeId, epps, eppIds, deliveryDate, signatureData } = req.body;
  const elements = epps || (eppIds ? eppIds.map(id => ({ id, quantity: 1 })) : null);
  
  if (!employeeId || !elements || !Array.isArray(elements) || !deliveryDate) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  try {
    const sigBuffer = signatureData ? Buffer.from(signatureData) : null;
    for (const epp of elements) {
      await db.runAsync(
        'INSERT INTO employee_epps (employee_id, epp_id, delivery_date, delivered_by_user_id, quantity, signature_data) VALUES (?, ?, ?, ?, ?, ?)',
        [employeeId, epp.id, deliveryDate, req.user?.id || null, epp.quantity || 1, sigBuffer]
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
        const totalItems = elements.reduce((acc, curr) => acc + (curr.quantity || 1), 0);
        io.emit('company_activity', {
          companyId: String(employee.company_id),
          message: `Se entregaron ${totalItems} EPP(s) a ${employee.first_name} ${employee.last_name} por ${userName}`,
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
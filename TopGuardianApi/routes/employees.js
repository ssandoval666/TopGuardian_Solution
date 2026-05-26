const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * /employees:
 *   get:
 *     summary: Get employees for company
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema:
 *           type: integer
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
 *         description: Paginated employees
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const companyId = req.query.companyId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const search = req.query.search || '';
    const offset = (page - 1) * pageSize;

    let query = 'SELECT * FROM employees WHERE company_id = ?';
    let countQuery = 'SELECT COUNT(*) as total FROM employees WHERE company_id = ?';
    const params = [companyId];
    const countParams = [companyId];

    if (search) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR document_number LIKE ?)';
      countQuery += ' AND (first_name LIKE ? OR last_name LIKE ? OR document_number LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
      countParams.push(searchParam, searchParam, searchParam);
    }

    query += ' ORDER BY first_name, last_name LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const [employees, countResult] = await Promise.all([
      db.allAsync(query, params),
      db.getAsync(countQuery, countParams)
    ]);

    res.json({
      data: employees,
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
 * /employees:
 *   post:
 *     summary: Create employee
 *     tags: [Employees]
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
 *               - firstName
 *               - lastName
 *               - documentNumber
 *               - position
 *               - department
 *             properties:
 *               companyId:
 *                 type: integer
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               documentNumber:
 *                 type: string
 *               position:
 *                 type: string
 *               department:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Employee created
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { companyId, firstName, lastName, documentNumber, position, department, email, phone } = req.body;
    const result = await db.runAsync(
      'INSERT INTO employees (company_id, first_name, last_name, document_number, position, department, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [companyId, firstName, lastName, documentNumber, position, department, email, phone]
    );
    const employee = await db.getAsync('SELECT * FROM employees WHERE id = ?', [result.lastID]);
    res.status(201).json(employee);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      res.status(400).json({ error: 'Número de documento ya existe' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

/**
 * @swagger
 * /employees/{id}:
 *   put:
 *     summary: Update employee
 *     tags: [Employees]
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
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               documentNumber:
 *                 type: string
 *               position:
 *                 type: string
 *               department:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Employee updated
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, documentNumber, position, department, email, phone, active } = req.body;

    let updateFields = [];
    let params = [];

    if (firstName !== undefined) {
      updateFields.push('first_name = ?');
      params.push(firstName);
    }
    if (lastName !== undefined) {
      updateFields.push('last_name = ?');
      params.push(lastName);
    }
    if (documentNumber !== undefined) {
      updateFields.push('document_number = ?');
      params.push(documentNumber);
    }
    if (position !== undefined) {
      updateFields.push('position = ?');
      params.push(position);
    }
    if (department !== undefined) {
      updateFields.push('department = ?');
      params.push(department);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      params.push(email);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      params.push(phone);
    }
    if (active !== undefined) {
      updateFields.push('active = ?');
      params.push(active ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    await db.runAsync(`UPDATE employees SET ${updateFields.join(', ')} WHERE id = ?`, params);

    const employee = await db.getAsync('SELECT * FROM employees WHERE id = ?', [id]);
    if (!employee) return res.status(404).json({ error: 'Empleado no encontrado' });

    res.json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /employees/{id}:
 *   delete:
 *     summary: Delete employee
 *     tags: [Employees]
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
 *         description: Employee deleted
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM employees WHERE id = ?', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
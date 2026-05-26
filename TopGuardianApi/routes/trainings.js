const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Helper para convertir el JSON array a Buffer de SQLite
function getBuffer(data) {
  if (!data) return null;
  if (Array.isArray(data)) return Buffer.from(data);
  if (data.type === 'Buffer' && Array.isArray(data.data)) return Buffer.from(data.data);
  return null;
}

/**
 * @swagger
 * /trainings:
 *   get:
 *     summary: Get paginated trainings list
 *     tags: [Trainings]
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
 *         description: Paginated trainings
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const search = req.query.search || '';
    const offset = (page - 1) * pageSize;

    let query = 'SELECT * FROM trainings WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM trainings WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (title LIKE ? OR instructor LIKE ?)';
      countQuery += ' AND (title LIKE ? OR instructor LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY title LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const [trainings, countResult] = await Promise.all([
      db.allAsync(query, params),
      db.getAsync(countQuery, search ? [`%${search}%`, `%${search}%`] : [])
    ]);

    res.json({
      data: trainings,
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
 * /trainings/all:
 *   get:
 *     summary: Get all trainings
 *     tags: [Trainings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All trainings
 */
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const trainings = await db.allAsync('SELECT * FROM trainings ORDER BY title');
    res.json(trainings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /trainings:
 *   post:
 *     summary: Create training
 *     tags: [Trainings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - instructor
 *               - date
 *               - duration
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               instructor:
 *                 type: string
 *               date:
 *                 type: string
 *               duration:
 *                 type: string
 *               recurrence:
 *                 type: string
 *                 enum: [none, monthly, yearly]
 *     responses:
 *       201:
 *         description: Training created
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, instructor, date, duration, recurrence, pdfFileName, pdfData, thumbnailFileName, thumbnailData } = req.body;
    const result = await db.runAsync(
      'INSERT INTO trainings (title, description, instructor, date, duration, recurrence, pdf_file_name, pdf_data, thumbnail_file_name, thumbnail_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description, instructor, date, duration, recurrence || 'none', pdfFileName || null, getBuffer(pdfData), thumbnailFileName || null, getBuffer(thumbnailData)]
    );
    const training = await db.getAsync('SELECT * FROM trainings WHERE id = ?', [result.lastID]);
    res.status(201).json(training);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /trainings/{id}:
 *   put:
 *     summary: Update training
 *     tags: [Trainings]
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               instructor:
 *                 type: string
 *               date:
 *                 type: string
 *               duration:
 *                 type: string
 *               recurrence:
 *                 type: string
 *                 enum: [none, monthly, yearly]
 *     responses:
 *       200:
 *         description: Training updated
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, instructor, date, duration, recurrence, pdfFileName, pdfData, thumbnailFileName, thumbnailData } = req.body;

    await db.runAsync(
      'UPDATE trainings SET title = ?, description = ?, instructor = ?, date = ?, duration = ?, recurrence = ?, pdf_file_name = ?, pdf_data = ?, thumbnail_file_name = ?, thumbnail_data = ? WHERE id = ?',
      [title, description, instructor, date, duration, recurrence, pdfFileName || null, getBuffer(pdfData), thumbnailFileName || null, getBuffer(thumbnailData), id]
    );

    const training = await db.getAsync('SELECT * FROM trainings WHERE id = ?', [id]);
    if (!training) return res.status(404).json({ error: 'Capacitación no encontrada' });

    res.json(training);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /trainings/{id}:
 *   delete:
 *     summary: Delete training
 *     tags: [Trainings]
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
 *         description: Training deleted
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM trainings WHERE id = ?', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /trainings/{id}/full:
 *   get:
 *     summary: Get full training details including PDF and Questionnaire for Employee App
 *     tags: [Trainings]
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
 *         description: Full training data
 */
router.get('/:id/full', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const training = await db.getAsync('SELECT * FROM trainings WHERE id = ?', [id]);
    if (!training) return res.status(404).json({ error: 'Capacitación no encontrada' });

    const qRow = await db.getAsync('SELECT * FROM training_questionnaires WHERE training_id = ?', [id]);
    const questionnaire = qRow ? { minPassingScore: qRow.min_passing_score, questions: JSON.parse(qRow.questions_json) } : { minPassingScore: 0, questions: [] };

    res.json({
      ...training,
      pdfData: training.pdf_data ? Array.from(training.pdf_data) : [],
      thumbnailData: training.thumbnail_data ? Array.from(training.thumbnail_data) : [],
      questionnaire
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Training Questionnaires ----

/**
 * @swagger
 * /trainings/{id}/questionnaire:
 *   get:
 *     summary: Get training questionnaire
 *     tags: [Trainings]
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
 *         description: Training questionnaire
 */
router.get('/:id/questionnaire', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const row = await db.getAsync('SELECT * FROM training_questionnaires WHERE training_id = ?', [id]);
    
    if (!row) {
      return res.json({ minPassingScore: 0, questions: [] });
    }

    res.json({
      minPassingScore: row.min_passing_score,
      questions: JSON.parse(row.questions_json)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /trainings/{id}/questionnaire:
 *   put:
 *     summary: Save training questionnaire
 *     tags: [Trainings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.put('/:id/questionnaire', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { minPassingScore, questions } = req.body;
    const questionsJson = JSON.stringify(questions || []);

    await db.runAsync(
      `INSERT INTO training_questionnaires (training_id, min_passing_score, questions_json) VALUES (?, ?, ?)
       ON CONFLICT(training_id) DO UPDATE SET min_passing_score = excluded.min_passing_score, questions_json = excluded.questions_json`,
      [id, minPassingScore || 0, questionsJson]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Company Trainings ----

/**
 * @swagger
 * /trainings/company/{companyId}:
 *   get:
 *     summary: Get trainings for company
 *     tags: [Company Trainings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Company trainings
 */
router.get('/company/:companyId', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;
    const trainings = await db.allAsync(`
      SELECT ct.*, t.title as training_title, t.description, t.instructor, t.date, t.duration, t.recurrence as training_recurrence,
             c.name as company_name
      FROM company_trainings ct
      JOIN trainings t ON ct.training_id = t.id
      JOIN companies c ON ct.company_id = c.id
      WHERE ct.company_id = ?
      ORDER BY ct.assigned_date DESC
    `, [companyId]);

    // Calculate status for each training
    const trainingsWithStatus = trainings.map(training => {
      let status = 'pending';
      if (training.completed_date) {
        if (!training.due_date || training.recurrence === 'none') {
          status = 'completed';
        } else {
          const now = new Date();
          const dueDate = new Date(training.due_date);
          if (now > dueDate) {
            status = 'expired';
          } else if (now.getTime() > (dueDate.getTime() - 30 * 24 * 60 * 60 * 1000)) {
            status = 'expiring_soon';
          } else {
            status = 'completed';
          }
        }
      }
      return { ...training, status };
    });

    res.json(trainingsWithStatus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /trainings/company:
 *   post:
 *     summary: Assign training to company
 *     tags: [Company Trainings]
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
 *               - trainingId
 *               - assignedDate
 *             properties:
 *               companyId:
 *                 type: integer
 *               trainingId:
 *                 type: integer
 *               assignedDate:
 *                 type: string
 *               recurrence:
 *                 type: string
 *                 enum: [none, monthly, yearly]
 *     responses:
 *       201:
 *         description: Training assigned to company
 */
router.post('/company', authenticateToken, async (req, res) => {
  try {
    const { companyId, trainingId, assignedDate, recurrence } = req.body;
    const result = await db.runAsync(
      'INSERT INTO company_trainings (company_id, training_id, assigned_date, recurrence) VALUES (?, ?, ?, ?)',
      [companyId, trainingId, assignedDate, recurrence || 'none']
    );
    const assignment = await db.getAsync(`
      SELECT ct.*, t.title as training_title, c.name as company_name
      FROM company_trainings ct
      JOIN trainings t ON ct.training_id = t.id
      JOIN companies c ON ct.company_id = c.id
      WHERE ct.id = ?
    `, [result.lastID]);
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /trainings/company/{id}/complete:
 *   put:
 *     summary: Mark company training as completed
 *     tags: [Company Trainings]
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
 *               - completedDate
 *             properties:
 *               completedDate:
 *                 type: string
 *     responses:
 *       200:
 *         description: Training marked as completed
 */
router.put('/company/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { completedDate } = req.body;

    // Get the assignment to calculate next due date
    const assignment = await db.getAsync('SELECT * FROM company_trainings WHERE id = ?', [id]);
    if (!assignment) return res.status(404).json({ error: 'Asignación no encontrada' });

    let dueDate = null;
    if (assignment.recurrence !== 'none') {
      // Calculate next due date based on recurrence
      const completed = new Date(completedDate);
      if (assignment.recurrence === 'monthly') {
        completed.setMonth(completed.getMonth() + 1);
      } else if (assignment.recurrence === 'yearly') {
        completed.setFullYear(completed.getFullYear() + 1);
      }
      dueDate = completed.toISOString().split('T')[0];
    }

    await db.runAsync(
      'UPDATE company_trainings SET completed_date = ?, due_date = ? WHERE id = ?',
      [completedDate, dueDate, id]
    );

    const updated = await db.getAsync(`
      SELECT ct.*, t.title as training_title, c.name as company_name
      FROM company_trainings ct
      JOIN trainings t ON ct.training_id = t.id
      JOIN companies c ON ct.company_id = c.id
      WHERE ct.id = ?
    `, [id]);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /trainings/company/{id}:
 *   delete:
 *     summary: Unassign training from company
 *     tags: [Company Trainings]
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
 *         description: Training unassigned
 */
router.delete('/company/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM company_trainings WHERE id = ?', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Employee Trainings ----

/**
 * @swagger
 * /trainings/employee/{employeeId}:
 *   get:
 *     summary: Get trainings for employee
 *     tags: [Employee Trainings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Employee trainings
 */
router.get('/employee/:employeeId', authenticateToken, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const trainings = await db.allAsync(`
      SELECT et.*, t.title as training_title, t.description, t.instructor, t.date, t.duration, t.recurrence as training_recurrence
      FROM employee_trainings et
      JOIN trainings t ON et.training_id = t.id
      WHERE et.employee_id = ?
      ORDER BY et.assigned_date DESC
    `, [employeeId]);

    // Calculate status for each training
    const trainingsWithStatus = trainings.map(training => {
      let status = 'pending';
      if (training.completed_date) {
        if (!training.due_date || training.recurrence === 'none') {
          status = 'completed';
        } else {
          const now = new Date();
          const dueDate = new Date(training.due_date);
          if (now > dueDate) {
            status = 'expired';
          } else if (now.getTime() > (dueDate.getTime() - 30 * 24 * 60 * 60 * 1000)) {
            status = 'expiring_soon';
          } else {
            status = 'completed';
          }
        }
      }
      return { ...training, status };
    });

    res.json(trainingsWithStatus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /trainings/employee:
 *   post:
 *     summary: Assign training to employee
 *     tags: [Employee Trainings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - employeeId
 *               - trainingId
 *               - assignedDate
 *             properties:
 *               employeeId:
 *                 type: integer
 *               trainingId:
 *                 type: integer
 *               assignedDate:
 *                 type: string
 *               recurrence:
 *                 type: string
 *                 enum: [none, monthly, yearly]
 *     responses:
 *       201:
 *         description: Training assigned to employee
 */
router.post('/employee', authenticateToken, async (req, res) => {
  try {
    const { employeeId, trainingId, assignedDate, recurrence } = req.body;
    const result = await db.runAsync(
      'INSERT INTO employee_trainings (employee_id, training_id, assigned_date, recurrence) VALUES (?, ?, ?, ?)',
      [employeeId, trainingId, assignedDate, recurrence || 'none']
    );
    const assignment = await db.getAsync(`
      SELECT et.*, t.title as training_title
      FROM employee_trainings et
      JOIN trainings t ON et.training_id = t.id
      WHERE et.id = ?
    `, [result.lastID]);
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /trainings/employee/{id}/complete:
 *   put:
 *     summary: Mark employee training as completed
 *     tags: [Employee Trainings]
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
 *               - completedDate
 *             properties:
 *               completedDate:
 *                 type: string
 *     responses:
 *       200:
 *         description: Training marked as completed
 */
router.put('/employee/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { completedDate } = req.body;

    // Get the assignment to calculate next due date
    const assignment = await db.getAsync('SELECT * FROM employee_trainings WHERE id = ?', [id]);
    if (!assignment) return res.status(404).json({ error: 'Asignación no encontrada' });

    let dueDate = null;
    if (assignment.recurrence !== 'none') {
      // Calculate next due date based on recurrence
      const completed = new Date(completedDate);
      if (assignment.recurrence === 'monthly') {
        completed.setMonth(completed.getMonth() + 1);
      } else if (assignment.recurrence === 'yearly') {
        completed.setFullYear(completed.getFullYear() + 1);
      }
      dueDate = completed.toISOString().split('T')[0];
    }

    await db.runAsync(
      'UPDATE employee_trainings SET completed_date = ?, due_date = ? WHERE id = ?',
      [completedDate, dueDate, id]
    );

    const updated = await db.getAsync(`
      SELECT et.*, t.title as training_title
      FROM employee_trainings et
      JOIN trainings t ON et.training_id = t.id
      WHERE et.id = ?
    `, [id]);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /trainings/employee/{id}:
 *   delete:
 *     summary: Unassign training from employee
 *     tags: [Employee Trainings]
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
 *         description: Training unassigned
 */
router.delete('/employee/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM employee_trainings WHERE id = ?', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * /risk-matrices:
 *   get:
 *     summary: Get risk matrices for company
 *     tags: [Risk Matrices]
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
 *         description: Company risk matrices
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.query;
    const matrices = await db.allAsync(`
      SELECT rm.*,
             GROUP_CONCAT(
               JSON_OBJECT(
                 'id', rms.id,
                 'name', rms.name
               )
             ) as sectors,
             GROUP_CONCAT(
               JSON_OBJECT(
                 'id', rmh.id,
                 'name', rmh.name,
                 'category', rmh.category
               )
             ) as hazards,
             GROUP_CONCAT(
               JSON_OBJECT(
                 'id', rmc.id,
                 'hazardId', rmc.hazard_id,
                 'sectorId', rmc.sector_id,
                 'probability', rmc.probability,
                 'severity', rmc.severity,
                 'riskScore', rmc.risk_score,
                 'riskLevel', rmc.risk_level,
                 'controlMeasure', rmc.control_measure
               )
             ) as cells
      FROM risk_matrices rm
      LEFT JOIN risk_matrix_sectors rms ON rm.id = rms.matrix_id
      LEFT JOIN risk_matrix_hazards rmh ON rm.id = rmh.matrix_id
      LEFT JOIN risk_matrix_cells rmc ON rm.id = rmc.matrix_id
      WHERE rm.company_id = ?
      GROUP BY rm.id
      ORDER BY rm.date DESC
    `, [companyId]);

    // Parse JSON data
    const matricesWithData = matrices.map(matrix => ({
      ...matrix,
      sectors: matrix.sectors ? JSON.parse(`[${matrix.sectors}]`) : [],
      hazards: matrix.hazards ? JSON.parse(`[${matrix.hazards}]`) : [],
      cells: matrix.cells ? JSON.parse(`[${matrix.cells}]`) : []
    }));

    res.json(matricesWithData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /risk-matrices:
 *   post:
 *     summary: Create risk matrix
 *     tags: [Risk Matrices]
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
 *               - name
 *               - date
 *               - sectors
 *               - hazards
 *               - cells
 *             properties:
 *               companyId:
 *                 type: integer
 *               name:
 *                 type: string
 *               date:
 *                 type: string
 *               sectors:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *               hazards:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     category:
 *                       type: string
 *               cells:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     hazardId:
 *                       type: integer
 *                     sectorId:
 *                       type: integer
 *                     probability:
 *                       type: integer
 *                     severity:
 *                       type: integer
 *                     riskScore:
 *                       type: integer
 *                     riskLevel:
 *                       type: string
 *                     controlMeasure:
 *                       type: string
 *     responses:
 *       201:
 *         description: Risk matrix created
 */
router.post('/', authenticateToken, async (req, res) => {
  const dbConnection = db;
  try {
    const { companyId, name, date, sectors, hazards, cells } = req.body;

    // Insert matrix
    const matrixResult = await db.runAsync(
      'INSERT INTO risk_matrices (company_id, name, date) VALUES (?, ?, ?)',
      [companyId, name, date]
    );

    const matrixId = matrixResult.lastID;

    // Insert sectors
    const sectorIds = {};
    for (const sector of sectors) {
      const sectorResult = await db.runAsync(
        'INSERT INTO risk_matrix_sectors (matrix_id, name) VALUES (?, ?)',
        [matrixId, sector.name]
      );
      sectorIds[sector.name] = sectorResult.lastID;
    }

    // Insert hazards
    const hazardIds = {};
    for (const hazard of hazards) {
      const hazardResult = await db.runAsync(
        'INSERT INTO risk_matrix_hazards (matrix_id, name, category) VALUES (?, ?, ?)',
        [matrixId, hazard.name, hazard.category]
      );
      hazardIds[hazard.name] = hazardResult.lastID;
    }

    // Insert cells
    for (const cell of cells) {
      await db.runAsync(
        'INSERT INTO risk_matrix_cells (matrix_id, hazard_id, sector_id, probability, severity, risk_score, risk_level, control_measure) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [matrixId, cell.hazardId, cell.sectorId, cell.probability, cell.severity, cell.riskScore, cell.riskLevel, cell.controlMeasure]
      );
    }

    // Get the complete matrix
    const matrix = await db.getAsync(`
      SELECT rm.*,
             GROUP_CONCAT(
               JSON_OBJECT(
                 'id', rms.id,
                 'name', rms.name
               )
             ) as sectors,
             GROUP_CONCAT(
               JSON_OBJECT(
                 'id', rmh.id,
                 'name', rmh.name,
                 'category', rmh.category
               )
             ) as hazards,
             GROUP_CONCAT(
               JSON_OBJECT(
                 'id', rmc.id,
                 'hazardId', rmc.hazard_id,
                 'sectorId', rmc.sector_id,
                 'probability', rmc.probability,
                 'severity', rmc.severity,
                 'riskScore', rmc.risk_score,
                 'riskLevel', rmc.risk_level,
                 'controlMeasure', rmc.control_measure
               )
             ) as cells
      FROM risk_matrices rm
      LEFT JOIN risk_matrix_sectors rms ON rm.id = rms.matrix_id
      LEFT JOIN risk_matrix_hazards rmh ON rm.id = rmh.matrix_id
      LEFT JOIN risk_matrix_cells rmc ON rm.id = rmc.matrix_id
      WHERE rm.id = ?
      GROUP BY rm.id
    `, [matrixId]);

    const matrixWithData = {
      ...matrix,
      sectors: matrix.sectors ? JSON.parse(`[${matrix.sectors}]`) : [],
      hazards: matrix.hazards ? JSON.parse(`[${matrix.hazards}]`) : [],
      cells: matrix.cells ? JSON.parse(`[${matrix.cells}]`) : []
    };

    res.status(201).json(matrixWithData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /risk-matrices/{id}:
 *   put:
 *     summary: Update risk matrix
 *     tags: [Risk Matrices]
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
 *               date:
 *                 type: string
 *               sectors:
 *                 type: array
 *               hazards:
 *                 type: array
 *               cells:
 *                 type: array
 *     responses:
 *       200:
 *         description: Risk matrix updated
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date, sectors, hazards, cells } = req.body;

    // Update matrix
    if (name || date) {
      let updateFields = [];
      let params = [];
      if (name) {
        updateFields.push('name = ?');
        params.push(name);
      }
      if (date) {
        updateFields.push('date = ?');
        params.push(date);
      }
      params.push(id);
      await db.runAsync(`UPDATE risk_matrices SET ${updateFields.join(', ')} WHERE id = ?`, params);
    }

    // For simplicity, we'll assume sectors, hazards, and cells are replaced entirely
    // In a real app, you'd want more sophisticated update logic
    if (sectors) {
      await db.runAsync('DELETE FROM risk_matrix_sectors WHERE matrix_id = ?', [id]);
      for (const sector of sectors) {
        await db.runAsync('INSERT INTO risk_matrix_sectors (matrix_id, name) VALUES (?, ?)', [id, sector.name]);
      }
    }

    if (hazards) {
      await db.runAsync('DELETE FROM risk_matrix_hazards WHERE matrix_id = ?', [id]);
      for (const hazard of hazards) {
        await db.runAsync('INSERT INTO risk_matrix_hazards (matrix_id, name, category) VALUES (?, ?, ?)', [id, hazard.name, hazard.category]);
      }
    }

    if (cells) {
      await db.runAsync('DELETE FROM risk_matrix_cells WHERE matrix_id = ?', [id]);
      for (const cell of cells) {
        await db.runAsync(
          'INSERT INTO risk_matrix_cells (matrix_id, hazard_id, sector_id, probability, severity, risk_score, risk_level, control_measure) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, cell.hazardId, cell.sectorId, cell.probability, cell.severity, cell.riskScore, cell.riskLevel, cell.controlMeasure]
        );
      }
    }

    // Get updated matrix
    const matrix = await db.getAsync(`
      SELECT rm.*,
             GROUP_CONCAT(
               JSON_OBJECT(
                 'id', rms.id,
                 'name', rms.name
               )
             ) as sectors,
             GROUP_CONCAT(
               JSON_OBJECT(
                 'id', rmh.id,
                 'name', rmh.name,
                 'category', rmh.category
               )
             ) as hazards,
             GROUP_CONCAT(
               JSON_OBJECT(
                 'id', rmc.id,
                 'hazardId', rmc.hazard_id,
                 'sectorId', rmc.sector_id,
                 'probability', rmc.probability,
                 'severity', rmc.severity,
                 'riskScore', rmc.risk_score,
                 'riskLevel', rmc.risk_level,
                 'controlMeasure', rmc.control_measure
               )
             ) as cells
      FROM risk_matrices rm
      LEFT JOIN risk_matrix_sectors rms ON rm.id = rms.matrix_id
      LEFT JOIN risk_matrix_hazards rmh ON rm.id = rmh.matrix_id
      LEFT JOIN risk_matrix_cells rmc ON rm.id = rmc.matrix_id
      WHERE rm.id = ?
      GROUP BY rm.id
    `, [id]);

    if (!matrix) return res.status(404).json({ error: 'Matriz no encontrada' });

    const matrixWithData = {
      ...matrix,
      sectors: matrix.sectors ? JSON.parse(`[${matrix.sectors}]`) : [],
      hazards: matrix.hazards ? JSON.parse(`[${matrix.hazards}]`) : [],
      cells: matrix.cells ? JSON.parse(`[${matrix.cells}]`) : []
    };

    res.json(matrixWithData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /risk-matrices/{id}:
 *   delete:
 *     summary: Delete risk matrix
 *     tags: [Risk Matrices]
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
 *         description: Risk matrix deleted
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    // Delete in correct order due to foreign keys
    await db.runAsync('DELETE FROM risk_matrix_cells WHERE matrix_id = ?', [id]);
    await db.runAsync('DELETE FROM risk_matrix_hazards WHERE matrix_id = ?', [id]);
    await db.runAsync('DELETE FROM risk_matrix_sectors WHERE matrix_id = ?', [id]);
    await db.runAsync('DELETE FROM risk_matrices WHERE id = ?', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
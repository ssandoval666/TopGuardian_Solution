const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-for-dev-only-change-it';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-for-dev';

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 expiresIn:
 *                   type: number
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ? AND active = 1', [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    bcrypt.compare(password, user.password_hash, (err, isValid) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!isValid) return res.status(401).json({ error: 'Credenciales inválidas' });

      const tokenPayload = {
        id: user.id,
        username: user.username,
        role: user.role
      };

      const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });
      const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

      res.json({
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role
        },
        accessToken,
        refreshToken,
        expiresIn: 3600
      });
    });
  });
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    db.get('SELECT * FROM users WHERE id = ? AND active = 1', [decoded.id], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

      const tokenPayload = {
        id: user.id,
        username: user.username,
        role: user.role
      };

      const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });
      const newRefreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

      res.json({
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600
      });
    });
  } catch (err) {
    res.status(401).json({ error: 'Token de refresco inválido' });
  }
});

/**
 * @swagger
 * /auth/training-login:
 *   post:
 *     summary: Login for employees in the Training App
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ruc
 *               - documentNumber
 *             properties:
 *               ruc:
 *                 type: string
 *               documentNumber:
 *                 type: string
 */
router.post('/training-login', async (req, res) => {
  try {
    const { ruc, documentNumber } = req.body;

    // 1. Buscar empresa por RUC
    const company = await db.getAsync('SELECT * FROM companies WHERE ruc = ?', [ruc]);
    if (!company) return res.status(401).json({ error: 'Empresa no encontrada con ese RUC.' });

    // 2. Buscar empleado por Documento
    const employee = await db.getAsync('SELECT * FROM employees WHERE document_number = ? AND company_id = ?', [documentNumber, company.id]);
    if (!employee) return res.status(401).json({ error: 'Empleado no encontrado en esta empresa.' });
    if (!employee.active) return res.status(403).json({ error: 'El acceso de este empleado está inactivo.' });

    // 3. Generar JWT
    const token = jwt.sign({ id: employee.id, companyId: company.id, role: 'Employee', type: 'training_app' }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      employee: {
        id: String(employee.id), firstName: employee.first_name, lastName: employee.last_name,
        documentNumber: employee.document_number, companyId: String(company.id), companyName: company.name
      },
      accessToken: token
    });
  } catch (err) {
    console.error("Error en training-login:", err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../database');
const rateLimit = require('express-rate-limit');
const {
  clearSessionCookies,
  issueSessionCookies,
  parseCookies,
  validateCsrf
} = require('../middleware/sessionCookies');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-only-change-this-secret');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-only-change-this-refresh-secret');
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET y JWT_REFRESH_SECRET son obligatorios en producción.');
}

// Límite de peticiones para rutas de Login (Prevención de ataques de Fuerza Bruta)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Límite de 10 intentos por IP
  message: { error: 'Demasiados intentos de inicio de sesión. Por favor, espere 15 minutos.' }
});

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
 *                 csrfToken:
 *                   type: string
 *                 expiresIn:
 *                   type: number
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ? AND active = 1', [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    bcrypt.compare(password, user.password_hash, (err, isValid) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!isValid) return res.status(401).json({ error: 'Credenciales inválidas' });

      const tokenPayload = {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role
      };

      const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });
      const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

      const csrfToken = issueSessionCookies(res, {
        accessToken,
        refreshToken,
        expiresIn: 3600
      });

      res.json({
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role
        },
        csrfToken,
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
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', (req, res) => {
  if (!validateCsrf(req)) {
    return res.status(403).json({ error: 'Validación CSRF fallida.' });
  }
  const { tg_refresh: refreshToken } = parseCookies(req.headers.cookie);
  if (!refreshToken) return res.status(401).json({ error: 'Sesión expirada.' });

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    db.get('SELECT * FROM users WHERE id = ? AND active = 1', [decoded.id], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

      const tokenPayload = {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role
      };
      const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });
      const newRefreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
      const csrfToken = issueSessionCookies(res, {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600
      });
      res.json({ csrfToken, expiresIn: 3600 });
    });
  } catch {
    res.status(401).json({ error: 'Token de refresco inválido' });
  }
});

router.get('/session', (req, res) => {
  const { tg_access: accessToken } = parseCookies(req.headers.cookie);
  if (!accessToken) return res.status(401).json({ error: 'Sesión no autenticada.' });

  jwt.verify(accessToken, JWT_SECRET, (verifyError, decoded) => {
    if (verifyError) return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    db.get('SELECT id, name, username, email, role FROM users WHERE id = ? AND active = 1', [decoded.id], (err, user) => {
      if (err) return res.status(500).json({ error: 'No se pudo validar la sesión.' });
      if (!user) return res.status(401).json({ error: 'Usuario no encontrado.' });
      const cookies = parseCookies(req.headers.cookie);
      res.json({
        user,
        csrfToken: cookies.tg_csrf || '',
        expiresIn: Math.max(decoded.exp - Math.floor(Date.now() / 1000), 0)
      });
    });
  });
});

router.post('/logout', (req, res) => {
  if (!validateCsrf(req)) {
    return res.status(403).json({ error: 'Validación CSRF fallida.' });
  }
  clearSessionCookies(res);
  res.status(204).end();
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
router.post('/training-login', loginLimiter, async (req, res) => {
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

    const csrfToken = issueSessionCookies(res, {
      accessToken: token,
      expiresIn: 24 * 60 * 60,
      training: true
    });

    res.json({
      employee: {
        id: String(employee.id), firstName: employee.first_name, lastName: employee.last_name,
        documentNumber: employee.document_number, companyId: String(company.id), companyName: company.name,
        ruc: company.ruc
      },
      csrfToken
    });
  } catch (err) {
    console.error("Error en training-login:", err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/training-session', async (req, res) => {
  const { tg_training_access: accessToken } = parseCookies(req.headers.cookie);
  if (!accessToken) return res.status(401).json({ error: 'Sesión no autenticada.' });

  try {
    const decoded = jwt.verify(accessToken, JWT_SECRET);
    if (decoded.type !== 'training_app') return res.status(401).json({ error: 'Sesión no válida.' });
    const employee = await db.getAsync(
      `SELECT e.id, e.first_name, e.last_name, e.document_number, e.company_id, c.name AS company_name, c.ruc
       FROM employees e JOIN companies c ON c.id = e.company_id
       WHERE e.id = ? AND e.active = 1`,
      [decoded.id]
    );
    if (!employee) return res.status(401).json({ error: 'Empleado no encontrado.' });
    const cookies = parseCookies(req.headers.cookie);
    res.json({
      employee: {
        id: String(employee.id),
        firstName: employee.first_name,
        lastName: employee.last_name,
        documentNumber: employee.document_number,
        companyId: String(employee.company_id),
        companyName: employee.company_name,
        ruc: employee.ruc
      },
      csrfToken: cookies.tg_training_csrf || ''
    });
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
});

router.post('/training-logout', (req, res) => {
  if (!validateCsrf(req, true)) {
    return res.status(403).json({ error: 'Validación CSRF fallida.' });
  }
  clearSessionCookies(res, true);
  res.status(204).end();
});

module.exports = router;
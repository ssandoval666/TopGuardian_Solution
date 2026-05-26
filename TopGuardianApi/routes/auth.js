const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../database');

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

      const accessToken = jwt.sign(tokenPayload, 'your-secret-key', { expiresIn: '1h' });
      const refreshToken = jwt.sign({ id: user.id }, 'your-refresh-secret-key', { expiresIn: '7d' });

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
    const decoded = jwt.verify(refreshToken, 'your-refresh-secret-key');

    db.get('SELECT * FROM users WHERE id = ? AND active = 1', [decoded.id], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

      const tokenPayload = {
        id: user.id,
        username: user.username,
        role: user.role
      };

      const accessToken = jwt.sign(tokenPayload, 'your-secret-key', { expiresIn: '1h' });
      const newRefreshToken = jwt.sign({ id: user.id }, 'your-refresh-secret-key', { expiresIn: '7d' });

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

module.exports = router;
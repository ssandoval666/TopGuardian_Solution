const jwt = require('jsonwebtoken');

// Usamos la misma variable de entorno que configuramos en el .env
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-for-dev-only-change-it';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Middleware para Control de Acceso Basado en Roles (RBAC)
const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Acceso denegado. Rol no definido.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes los privilegios necesarios para realizar esta acción.' });
    }
    next();
  };
};

module.exports = { authenticateToken, authorizeRole };
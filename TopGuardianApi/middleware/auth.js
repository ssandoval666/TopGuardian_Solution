const jwt = require('jsonwebtoken');
const { parseCookies, validateCsrf } = require('./sessionCookies');

// Usamos la misma variable de entorno que configuramos en el .env
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-only-change-this-secret');
if (!JWT_SECRET) throw new Error('JWT_SECRET es obligatorio en producción.');

const authenticateToken = (req, res, next) => {
  if (req.path === '/health') return next();
  const cookies = parseCookies(req.headers.cookie);
  const trainingRequest = !!(req.path.includes('/employee-app/')
    || req.path.endsWith('/employee/record')
    || (req.path.endsWith('/full') && cookies.tg_training_access));
  const token = trainingRequest ? cookies.tg_training_access : cookies.tg_access;

  if (!token) {
    return res.status(401).json({ error: 'Sesión no autenticada.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    }
    if (trainingRequest !== (user.type === 'training_app')) {
      return res.status(403).json({ error: 'Tipo de sesión no autorizado para esta ruta.' });
    }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !validateCsrf(req, trainingRequest)) {
      return res.status(403).json({ error: 'Validación CSRF fallida.' });
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
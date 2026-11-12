const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';
const cookieSecure = isProduction || process.env.COOKIE_SECURE === 'true';
const sameSite = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
if (!['strict', 'lax', 'none'].includes(sameSite)) {
  throw new Error('COOKIE_SAME_SITE debe ser strict, lax o none.');
}
if (sameSite === 'none' && !cookieSecure) {
  throw new Error('COOKIE_SAME_SITE=none requiere COOKIE_SECURE=true.');
}
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
const csrfSecret = process.env.CSRF_SECRET
  || process.env.JWT_SECRET
  || (isProduction ? null : 'dev-only-change-this-csrf-secret');
if (!csrfSecret) throw new Error('CSRF_SECRET o JWT_SECRET es obligatorio en producción.');

const cookieOptions = (httpOnly, maxAge) => ({
  httpOnly,
  secure: cookieSecure,
  sameSite,
  path: '/',
  domain: cookieDomain,
  maxAge
});

const parseCookies = (header = '') => header.split(';').reduce((cookies, part) => {
  const separator = part.indexOf('=');
  if (separator === -1) return cookies;
  const name = part.slice(0, separator).trim();
  const value = part.slice(separator + 1).trim();
  if (name) {
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = '';
    }
  }
  return cookies;
}, {});

const getCsrfCookieName = (training = false) => training ? 'tg_training_csrf' : 'tg_csrf';

const createCsrfToken = () => {
  const nonce = crypto.randomBytes(32).toString('hex');
  const signature = crypto.createHmac('sha256', csrfSecret).update(nonce).digest('hex');
  return `${nonce}.${signature}`;
};

const issueSessionCookies = (res, { accessToken, refreshToken, expiresIn, training = false }) => {
  const accessName = training ? 'tg_training_access' : 'tg_access';
  const refreshName = training ? null : 'tg_refresh';
  const csrfToken = createCsrfToken();
  const csrfCookieName = getCsrfCookieName(training);

  res.cookie(accessName, accessToken, cookieOptions(true, expiresIn * 1000));
  if (refreshName && refreshToken) {
    res.cookie(refreshName, refreshToken, cookieOptions(true, 7 * 24 * 60 * 60 * 1000));
  }
  const csrfLifetime = refreshName ? 7 * 24 * 60 * 60 * 1000 : expiresIn * 1000;
  res.cookie(csrfCookieName, csrfToken, cookieOptions(false, csrfLifetime));

  return csrfToken;
};

const clearSessionCookies = (res, training = false) => {
  const names = training
    ? ['tg_training_access', 'tg_training_csrf']
    : ['tg_access', 'tg_refresh', 'tg_csrf'];
  names.forEach((name) => {
    res.clearCookie(name, {
      httpOnly: name !== 'tg_csrf' && name !== 'tg_training_csrf',
      secure: cookieSecure,
      sameSite,
      path: '/',
      domain: cookieDomain
    });
  });
};

const validateCsrf = (req, training = false) => {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[getCsrfCookieName(training)];
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) return false;

  const [nonce, signature] = cookieToken.split('.');
  if (!nonce || !signature || cookieToken.split('.').length !== 2) return false;
  const expected = crypto.createHmac('sha256', csrfSecret).update(nonce).digest('hex');
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};

module.exports = {
  clearSessionCookies,
  issueSessionCookies,
  parseCookies,
  validateCsrf
};

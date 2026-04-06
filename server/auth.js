/**
 * Optional authentication module.
 * When a users config file exists and contains users, auth is enforced.
 * When no users are configured, auth is bypassed entirely.
 */
import { createHmac, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { debug } from './logging.js';

const log = debug('auth');

/** @type {{ username: string, password: string, role?: string }[]} */
let users = [];

/** JWT secret — generated per server start when no env override */
const JWT_SECRET = process.env.BEADS_UI_JWT_SECRET || randomBytes(32).toString('hex');
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Load users from config file.
 * File path: BEADS_UI_AUTH_FILE env var, or ./beads-ui-users.json in cwd.
 */
export function loadUsers() {
  const filePath = process.env.BEADS_UI_AUTH_FILE || '';
  if (!filePath) {
    users = [];
    return;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    users = Array.isArray(parsed.users) ? parsed.users : [];
    log('loaded %d users from %s', users.length, filePath);
  } catch (err) {
    log('no users file at %s — auth disabled', filePath);
    users = [];
  }
}

/** @returns {boolean} Whether auth is enabled (users configured) */
export function isAuthEnabled() {
  return users.length > 0;
}


/**
 * Create a JWT-like token (HMAC-SHA256 signed).
 * @param {{ username: string, role: string }} payload
 * @returns {string}
 */
function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Date.now(),
    exp: Date.now() + TOKEN_EXPIRY_MS
  })).toString('base64url');
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

/**
 * Verify and decode a token.
 * @param {string} token
 * @returns {{ username: string, role: string } | null}
 */
export function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return { username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

/**
 * Attempt login.
 * @param {string} username
 * @param {string} password
 * @returns {{ ok: true, token: string, user: { username: string, role: string } } | { ok: false, error: string }}
 */
export function login(username, password) {
  const user = users.find(u => u.username === username);
  if (!user) return { ok: false, error: 'Invalid credentials' };
  if (password !== user.password) return { ok: false, error: 'Invalid credentials' };
  const role = user.role || '';
  const token = createToken({ username, role });
  return { ok: true, token, user: { username, role } };
}

/**
 * Express middleware — skips auth if no users configured.
 * Protects all routes except /api/auth/* and static assets.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function authMiddleware(req, res, next) {
  if (!isAuthEnabled()) return next();

  // Allow auth endpoints and health check
  if (req.path.startsWith('/api/auth') || req.path === '/healthz' || req.path === '/api/config') return next();

  // Allow static assets and SPA routes (auth enforced client-side)
  const ext = req.path.split('.').pop();
  if (ext && ['js', 'css', 'html', 'svg', 'png', 'ico', 'woff', 'woff2', 'ttf'].includes(ext)) return next();
  if (!req.path.startsWith('/api/')) return next();

  // Check Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ ok: false, error: 'Invalid token' });
    return;
  }
  /** @type {any} */ (req).user = decoded;
  next();
}

/**
 * Optional authentication module.
 * When a users config file exists and contains users, auth is enforced.
 * When no users are configured, auth is bypassed entirely.
 * Simple session tokens stored in memory — no JWT complexity.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { debug } from './logging.js';

const log = debug('auth');

/** @type {{ username: string, password: string, role?: string }[]} */
let users = [];

/** @type {Map<string, { username: string, role: string }>} */
const sessions = new Map();

/**
 * Load users from config file.
 * @param {string} [filePath] - BEADS_UI_AUTH_FILE env var
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
  } catch {
    log('no users file at %s — auth disabled', filePath);
    users = [];
  }
}

/** @returns {boolean} Whether auth is enabled (users configured) */
export function isAuthEnabled() {
  return users.length > 0;
}

/**
 * Verify a session token.
 * @param {string} token
 * @returns {{ username: string, role: string } | null}
 */
export function verifyToken(token) {
  return sessions.get(token) || null;
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
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { username, role });
  return { ok: true, token, user: { username, role } };
}

/**
 * Express middleware — skips auth if no users configured.
 * Protects API routes only. Static assets and SPA routes pass through.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function authMiddleware(req, res, next) {
  if (!isAuthEnabled()) return next();

  // Allow auth endpoints, health check, and config
  if (req.path.startsWith('/api/auth') || req.path === '/healthz' || req.path === '/api/config') return next();

  // Allow static assets and SPA routes (auth enforced client-side)
  if (!req.path.startsWith('/api/')) return next();

  // Check Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Invalid token' });
    return;
  }
  /** @type {any} */ (req).user = user;
  next();
}

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { findNearestBeadsMetadata } from './db.js';
import { debug } from './logging.js';

const log = debug('dolt-pool');

const DOLT_PORT = 3307;
const DOLT_SOCK = '/tmp/bdui-dolt.sock';

/** @type {import('mysql2/promise').Pool | null} */
let pool = null;

/** @type {import('node:child_process').ChildProcess | null} */
let serverProcess = null;

/** @type {string | null} */
let currentDataDir = null;

/** @type {'embedded' | 'server' | null} */
let currentMode = null;

/**
 * @typedef {{ mode: 'embedded', dataDir: string, database: string }} EmbeddedDoltInfo
 * @typedef {{ mode: 'server', host: string, port: number, user: string, password: string, database: string }} ServerDoltInfo
 * @typedef {EmbeddedDoltInfo | ServerDoltInfo} DoltInfo
 */

/**
 * Resolve Dolt connection info from the workspace root.
 * Walks up from cwd to find .beads/metadata.json, then returns either
 * embedded or server connection info depending on dolt_mode.
 *
 * @param {string} cwd
 * @returns {DoltInfo | null}
 */
export function resolveDoltDir(cwd) {
  const metadataPath = findNearestBeadsMetadata(cwd);
  if (!metadataPath) return null;

  const beadsDir = path.dirname(metadataPath);
  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch {
    return null;
  }

  if (metadata.backend !== 'dolt' && metadata.database !== 'dolt') return null;

  const database = metadata.dolt_database || 'default';

  if (metadata.dolt_mode === 'server') {
    return {
      mode: 'server',
      host: metadata.dolt_server_host || '127.0.0.1',
      port: metadata.dolt_server_port || 3306,
      user: metadata.dolt_server_user || 'root',
      password: process.env.BEADS_DOLT_PASSWORD || '',
      database
    };
  }

  const dataDir = path.join(beadsDir, 'embeddeddolt', database);

  try {
    fs.accessSync(path.join(dataDir, '.dolt'), fs.constants.F_OK);
  } catch {
    return null;
  }

  return { mode: 'embedded', dataDir, database };
}

/**
 * Start the Dolt SQL server and create a connection pool.
 * Idempotent — returns existing pool if already running for the same dataDir.
 *
 * @param {string} cwd - Workspace root directory
 * @returns {Promise<import('mysql2/promise').Pool | null>}
 */
export async function startDoltServer(cwd) {
  const resolved = resolveDoltDir(cwd);
  if (!resolved) {
    log('no Dolt database found for %s', cwd);
    return null;
  }

  // Server mode — connect directly, no child process
  if (resolved.mode === 'server') {
    const { host, port, user, password, database } = resolved;

    // Already connected to this server
    if (pool && currentMode === 'server') {
      return pool;
    }

    await stopDoltServer();

    log('connecting to remote dolt server at %s:%d (database=%s)', host, port, database);
    currentMode = 'server';

    try {
      pool = await createPool({ host, port, user, password, database });
      log('connected to remote dolt server at %s:%d', host, port);
      ensureIndexes(pool).catch((err) => log('ensureIndexes error: %o', err));
      return pool;
    } catch (err) {
      log('failed to connect to remote dolt server: %o', err);
      pool = null;
      currentMode = null;
      return null;
    }
  }

  // Embedded mode — spawn local dolt sql-server
  const { dataDir, database } = resolved;

  // Already running for this data dir
  if (pool && currentDataDir === dataDir && serverProcess && !serverProcess.killed) {
    return pool;
  }

  // Clean up any previous server
  await stopDoltServer();

  log('starting dolt sql-server at %s (database=%s)', dataDir, database);

  // Clean up stale socket
  try { fs.unlinkSync(DOLT_SOCK); } catch { /* ignore */ }

  currentDataDir = dataDir;
  currentMode = 'embedded';

  return new Promise((resolve) => {
    const child = spawn('dolt', [
      'sql-server',
      '-P', String(DOLT_PORT),
      '--socket', DOLT_SOCK,
      '-l', 'warning'
    ], {
      cwd: dataDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    serverProcess = child;

    let resolved_already = false;

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk) => {
      // Log warnings/errors from dolt
      if (chunk.trim()) log('dolt: %s', chunk.trim());
    });

    child.on('error', (err) => {
      log('dolt sql-server spawn error: %o', err);
      if (!resolved_already) {
        resolved_already = true;
        resolve(null);
      }
    });

    child.on('exit', (code) => {
      log('dolt sql-server exited with code %d', code);
      pool = null;
      serverProcess = null;
      currentDataDir = null;
      currentMode = null;
      if (!resolved_already) {
        resolved_already = true;
        resolve(null);
      }
    });

    // Poll for connectivity instead of parsing stdout
    let attempts = 0;
    const maxAttempts = 50; // 50 * 100ms = 5s max
    const pollInterval = setInterval(async () => {
      attempts++;
      if (resolved_already) {
        clearInterval(pollInterval);
        return;
      }
      if (attempts > maxAttempts) {
        clearInterval(pollInterval);
        if (!resolved_already) {
          resolved_already = true;
          log('dolt sql-server start timeout after %d attempts', attempts);
          resolve(null);
        }
        return;
      }
      try {
        const p = await createPool({ host: '127.0.0.1', port: DOLT_PORT, user: 'root', database });
        clearInterval(pollInterval);
        if (!resolved_already) {
          resolved_already = true;
          pool = p;
          log('dolt sql-server ready on port %d (after %d polls)', DOLT_PORT, attempts);
          ensureIndexes(p).catch((err) => log('ensureIndexes error: %o', err));
          resolve(pool);
        } else {
          // Pool created after we already resolved (race); close it
          try { await p.end(); } catch { /* ignore */ }
        }
      } catch (poolErr) {
        // Not ready yet, retry. Clean up any partial pool.
        if (poolErr && typeof /** @type {any} */ (poolErr).pool?.end === 'function') {
          try { await /** @type {any} */ (poolErr).pool.end(); } catch { /* ignore */ }
        }
      }
    }, 100);
  });
}

/**
 * Create a mysql2 connection pool.
 *
 * @param {{ host: string, port: number, user: string, password?: string, database: string }} opts
 * @returns {Promise<import('mysql2/promise').Pool>}
 */
async function createPool(opts) {
  const p = mysql.createPool({
    host: opts.host,
    port: opts.port,
    user: opts.user,
    password: opts.password || undefined,
    database: opts.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 50,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    // Dolt dates come as strings; avoid extra parsing
    dateStrings: true
  });

  // Verify connectivity
  const conn = await p.getConnection();
  conn.release();
  return p;
}

/**
 * Ensure required indexes exist. Idempotent — skips if already present.
 *
 * @param {import('mysql2/promise').Pool} p
 */
async function ensureIndexes(p) {
  const [rows] = await p.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'issues'
       AND index_name = 'idx_ft_issues_title_desc' LIMIT 1`
  );
  if (/** @type {any[]} */ (rows).length > 0) {
    log('FULLTEXT index already exists');
    return;
  }
  log('creating FULLTEXT index on issues(title, description)');
  await p.query(`ALTER TABLE issues ADD FULLTEXT idx_ft_issues_title_desc (title, description)`);
  await p.query(`CALL dolt_commit('-Am', 'add FULLTEXT index on issues(title, description)')`);
  log('FULLTEXT index created');
}

/**
 * Get the current pool, or null if not started.
 *
 * @returns {import('mysql2/promise').Pool | null}
 */
export function getPool() {
  return pool;
}

/**
 * Stop the Dolt SQL server and close the pool.
 */
export async function stopDoltServer() {
  if (pool) {
    try { await pool.end(); } catch { /* ignore */ }
    pool = null;
  }
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
  currentDataDir = null;
  currentMode = null;
}

/**
 * Rebind to a new workspace directory (e.g., after workspace switch).
 *
 * @param {string} cwd
 * @returns {Promise<import('mysql2/promise').Pool | null>}
 */
export async function rebindDoltServer(cwd) {
  const resolved = resolveDoltDir(cwd);
  if (!resolved) {
    await stopDoltServer();
    return null;
  }
  if (resolved.mode === 'server' && pool && currentMode === 'server') {
    return pool;
  }
  if (resolved.mode === 'embedded' && resolved.dataDir === currentDataDir && pool && serverProcess && !serverProcess.killed) {
    return pool;
  }
  return startDoltServer(cwd);
}

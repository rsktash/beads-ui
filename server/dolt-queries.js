/**
 * Direct SQL queries against Dolt, replacing bd CLI subprocess calls.
 * Each query returns data in the same shape as the bd CLI JSON output
 * so callers don't need to change.
 */
import { getPool } from './dolt-pool.js';
import { debug } from './logging.js';

const log = debug('dolt-queries');

// Columns selected for list views (omit large text fields for performance).
// Note: 'parent' is NOT a real column — it's derived from dependencies table.
const LIST_COL_NAMES = [
  'id', 'title', 'status', 'priority', 'issue_type', 'assignee',
  'created_at', 'created_by', 'updated_at', 'closed_at', 'close_reason',
  'description', 'owner', 'estimated_minutes', 'external_ref', 'spec_id',
  'ephemeral', 'pinned', 'is_template', 'mol_type', 'work_type',
  'source_system', 'source_repo'
];

// Prefixed with table alias for JOINed queries
const LIST_COLS_ALIASED = LIST_COL_NAMES.map(c => `i.${c}`).join(', ');
const LIST_COLS = LIST_COL_NAMES.join(', ');

// All columns for detail view (single-issue fetch includes text fields)
const DETAIL_COLS = '*';

/**
 * Check if the Dolt pool is available.
 *
 * @returns {boolean}
 */
export function isDoltPoolReady() {
  return getPool() !== null;
}

/**
 * Normalize a Dolt datetime row to the format bd CLI returns.
 * bd returns ISO strings; Dolt with dateStrings returns 'YYYY-MM-DD HH:MM:SS'.
 *
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
function normalizeRow(row) {
  const out = { ...row };
  for (const key of ['created_at', 'updated_at', 'closed_at', 'last_activity', 'compacted_at', 'due_at', 'defer_until']) {
    if (out[key] && typeof out[key] === 'string') {
      // Convert '2026-04-05 01:50:19' → '2026-04-05T01:50:19Z'
      const v = /** @type {string} */ (out[key]);
      if (v.includes(' ') && !v.includes('T')) {
        out[key] = v.replace(' ', 'T') + 'Z';
      }
    }
  }
  // Ensure boolean fields are numbers (Dolt returns 0/1)
  for (const key of ['ephemeral', 'pinned', 'is_template', 'no_history']) {
    if (key in out) {
      out[key] = out[key] ? 1 : 0;
    }
  }
  return out;
}

/**
 * @typedef {{ limit?: number, offset?: number }} Pagination
 * @typedef {{ ok: true, items: Array<Record<string, unknown>>, total: number }} PaginatedResult
 * @typedef {{ ok: false, error: { code: string, message: string } }} QueryError
 */

/**
 * Build SQL LIMIT/OFFSET clause from pagination params.
 *
 * @param {Pagination} [pagination]
 * @returns {{ limitClause: string }}
 */
function buildPagination(pagination) {
  const limit = pagination?.limit || 0;
  const offset = pagination?.offset || 0;
  const limitClause = limit > 0 ? ` LIMIT ${Number(limit)} OFFSET ${Number(offset)}` : '';
  return { limitClause };
}

/**
 * Fetch total count for a WHERE clause.
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} where - SQL WHERE clause (without WHERE keyword), or empty for all
 * @param {any[]} [params]
 * @returns {Promise<number>}
 */
async function fetchTotal(pool, where, params = []) {
  const sql = where
    ? `SELECT COUNT(*) AS total FROM issues WHERE ${where}`
    : `SELECT COUNT(*) AS total FROM issues`;
  const [rows] = await pool.query(sql, params);
  return /** @type {any[]} */ (rows)[0]?.total || 0;
}

/**
 * Fetch all issues with pagination (for 'all-issues' subscription).
 *
 * @param {Pagination} [pagination]
 * @returns {Promise<PaginatedResult | QueryError>}
 */
export async function queryAllIssues(pagination) {
  const pool = getPool();
  if (!pool) return { ok: false, error: { code: 'no_pool', message: 'Dolt pool not available' } };
  try {
    const total = await fetchTotal(pool, '');
    const { limitClause } = buildPagination(pagination);
    const [rows] = await pool.query(
      `SELECT ${LIST_COLS_ALIASED}, d.depends_on_id AS parent
       FROM issues i
       LEFT JOIN dependencies d ON d.issue_id = i.id AND d.type = 'parent-child'
       ORDER BY i.updated_at DESC${limitClause}`
    );
    return { ok: true, items: /** @type {any[]} */ (rows).map(normalizeRow), total };
  } catch (err) {
    log('queryAllIssues error: %o', err);
    return { ok: false, error: { code: 'db_error', message: String(/** @type {any} */ (err).message) } };
  }
}

/**
 * Fetch epics (for 'epics' subscription).
 *
 * @returns {Promise<{ ok: true, items: Array<Record<string, unknown>> } | { ok: false, error: { code: string, message: string } }>}
 */
/**
 * @param {{ limit?: number, offset?: number }} [pagination]
 * @returns {Promise<PaginatedResult | QueryError>}
 */
export async function queryEpics(pagination) {
  const pool = getPool();
  if (!pool) return { ok: false, error: { code: 'no_pool', message: 'Dolt pool not available' } };
  try {
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM issues WHERE issue_type = 'epic'`);
    const total = /** @type {any[]} */ (countRows)[0]?.total || 0;
    const { limitClause } = buildPagination(pagination);
    const [rows] = await pool.query(
      `SELECT ${LIST_COLS_ALIASED}, d.depends_on_id AS parent
       FROM issues i
       LEFT JOIN dependencies d ON d.issue_id = i.id AND d.type = 'parent-child'
       WHERE i.issue_type = 'epic'
       ORDER BY i.updated_at DESC${limitClause}`
    );
    return { ok: true, items: /** @type {any[]} */ (rows).map(normalizeRow), total };
  } catch (err) {
    log('queryEpics error: %o', err);
    return { ok: false, error: { code: 'db_error', message: String(/** @type {any} */ (err).message) } };
  }
}

/**
 * Fetch blocked issues (for 'blocked-issues' subscription).
 *
 * @returns {Promise<{ ok: true, items: Array<Record<string, unknown>> } | { ok: false, error: { code: string, message: string } }>}
 */
/**
 * @param {Pagination} [pagination]
 * @returns {Promise<PaginatedResult | QueryError>}
 */
export async function queryBlockedIssues(pagination) {
  const pool = getPool();
  if (!pool) return { ok: false, error: { code: 'no_pool', message: 'Dolt pool not available' } };
  try {
    const blockedWhere = `status = 'open' AND id IN (
      SELECT bl.issue_id FROM dependencies bl
      JOIN issues blocker ON bl.depends_on_id = blocker.id
      WHERE bl.type = 'blocks' AND blocker.status != 'closed')`;
    const total = await fetchTotal(pool, blockedWhere);
    const { limitClause } = buildPagination(pagination);
    const [rows] = await pool.query(
      `SELECT ${LIST_COLS_ALIASED}, pc.depends_on_id AS parent
       FROM issues i
       LEFT JOIN dependencies pc ON pc.issue_id = i.id AND pc.type = 'parent-child'
       WHERE i.status = 'open'
         AND i.id IN (
           SELECT bl.issue_id FROM dependencies bl
           JOIN issues blocker ON bl.depends_on_id = blocker.id
           WHERE bl.type = 'blocks' AND blocker.status != 'closed'
         )
       ORDER BY i.updated_at DESC${limitClause}`
    );
    return { ok: true, items: /** @type {any[]} */ (rows).map(normalizeRow), total };
  } catch (err) {
    log('queryBlockedIssues error: %o', err);
    return { ok: false, error: { code: 'db_error', message: String(/** @type {any} */ (err).message) } };
  }
}

/**
 * Fetch ready issues (for 'ready-issues' subscription).
 *
 * @returns {Promise<{ ok: true, items: Array<Record<string, unknown>> } | { ok: false, error: { code: string, message: string } }>}
 */
/**
 * @param {Pagination} [pagination]
 * @returns {Promise<PaginatedResult | QueryError>}
 */
export async function queryReadyIssues(pagination) {
  const pool = getPool();
  if (!pool) return { ok: false, error: { code: 'no_pool', message: 'Dolt pool not available' } };
  try {
    const readyWhere = `status = 'open' AND id NOT IN (
      SELECT bl.issue_id FROM dependencies bl
      JOIN issues blocker ON bl.depends_on_id = blocker.id
      WHERE bl.type = 'blocks' AND blocker.status != 'closed')`;
    const total = await fetchTotal(pool, readyWhere);
    const { limitClause } = buildPagination(pagination);
    const [rows] = await pool.query(
      `SELECT ${LIST_COLS_ALIASED}, pc.depends_on_id AS parent
       FROM issues i
       LEFT JOIN dependencies pc ON pc.issue_id = i.id AND pc.type = 'parent-child'
       WHERE i.status = 'open'
         AND i.id NOT IN (
           SELECT bl.issue_id FROM dependencies bl
           JOIN issues blocker ON bl.depends_on_id = blocker.id
           WHERE bl.type = 'blocks' AND blocker.status != 'closed'
         )
       ORDER BY i.updated_at DESC${limitClause}`
    );
    return { ok: true, items: /** @type {any[]} */ (rows).map(normalizeRow), total };
  } catch (err) {
    log('queryReadyIssues error: %o', err);
    return { ok: false, error: { code: 'db_error', message: String(/** @type {any} */ (err).message) } };
  }
}

/**
 * Fetch issues by status (for 'in-progress-issues', 'closed-issues' subscriptions).
 *
 * @param {string} status
 * @param {number} [limit]
 * @returns {Promise<{ ok: true, items: Array<Record<string, unknown>> } | { ok: false, error: { code: string, message: string } }>}
 */
/**
 * @param {string} status
 * @param {Pagination} [pagination]
 * @returns {Promise<PaginatedResult | QueryError>}
 */
export async function queryIssuesByStatus(status, pagination) {
  const pool = getPool();
  if (!pool) return { ok: false, error: { code: 'no_pool', message: 'Dolt pool not available' } };
  try {
    const total = await fetchTotal(pool, 'status = ?', [status]);
    const { limitClause } = buildPagination(pagination);
    const [rows] = await pool.query(
      `SELECT ${LIST_COLS_ALIASED}, pc.depends_on_id AS parent
       FROM issues i
       LEFT JOIN dependencies pc ON pc.issue_id = i.id AND pc.type = 'parent-child'
       WHERE i.status = ?
       ORDER BY i.updated_at DESC${limitClause}`,
      [status]
    );
    return { ok: true, items: /** @type {any[]} */ (rows).map(normalizeRow), total };
  } catch (err) {
    log('queryIssuesByStatus error: %o', err);
    return { ok: false, error: { code: 'db_error', message: String(/** @type {any} */ (err).message) } };
  }
}

/**
 * Search issues with optional FULLTEXT query and status/type filters.
 *
 * When `query` is non-empty, uses Dolt FULLTEXT MATCH...AGAINST for
 * relevance-ranked results. Falls back to LIKE on id for exact ID matches.
 * Status and type filters narrow results server-side.
 *
 * @param {string} query - Search terms (empty string = no text filter)
 * @param {Pagination & { status?: string, type?: string }} [options]
 * @returns {Promise<PaginatedResult | QueryError>}
 */
export async function querySearchIssues(query, options) {
  const pool = getPool();
  if (!pool) return { ok: false, error: { code: 'no_pool', message: 'Dolt pool not available' } };
  try {
    const conditions = [];
    const params = [];

    // FULLTEXT search on title + description
    if (query.length > 0) {
      // Use MATCH...AGAINST for natural language search, plus LIKE on id for exact ID matches
      conditions.push('(MATCH(i.title, i.description) AGAINST (?) OR i.id LIKE ?)');
      params.push(query, `%${query}%`);
    }

    // Status filter
    if (options?.status && options.status !== 'all') {
      conditions.push('i.status = ?');
      params.push(options.status);
    }

    // Type filter
    if (options?.type && options.type !== 'all') {
      conditions.push('i.issue_type = ?');
      params.push(options.type);
    }

    const where = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM issues i WHERE ${where}`, params
    );
    const total = /** @type {any[]} */ (countRows)[0]?.total || 0;

    const { limitClause } = buildPagination(options);
    const [rows] = await pool.query(
      `SELECT ${LIST_COLS_ALIASED}, pc.depends_on_id AS parent
       FROM issues i
       LEFT JOIN dependencies pc ON pc.issue_id = i.id AND pc.type = 'parent-child'
       WHERE ${where}
       ORDER BY i.updated_at DESC${limitClause}`,
      params
    );
    return { ok: true, items: /** @type {any[]} */ (rows).map(normalizeRow), total };
  } catch (err) {
    log('querySearchIssues error: %o', err);
    return { ok: false, error: { code: 'db_error', message: String(/** @type {any} */ (err).message) } };
  }
}

/**
 * Fetch a single issue with dependencies, labels and parent info
 * (for 'issue-detail' subscription and post-mutation show).
 *
 * @param {string} id
 * @returns {Promise<{ ok: true, item: Record<string, unknown> } | { ok: false, error: { code: string, message: string } }>}
 */
export async function queryIssueDetail(id) {
  const pool = getPool();
  if (!pool) return { ok: false, error: { code: 'no_pool', message: 'Dolt pool not available' } };
  try {
    const [issueRows] = await pool.query(
      `SELECT ${DETAIL_COLS} FROM issues WHERE id = ?`, [id]
    );
    const issues = /** @type {any[]} */ (issueRows);
    if (issues.length === 0) {
      return { ok: false, error: { code: 'not_found', message: `Issue ${id} not found` } };
    }

    const issue = normalizeRow(issues[0]);

    // Fetch dependencies
    const [depRows] = await pool.query(
      `SELECT issue_id, depends_on_id, type, created_at, created_by, metadata
       FROM dependencies WHERE issue_id = ? OR depends_on_id = ?`, [id, id]
    );
    issue.dependencies = /** @type {any[]} */ (depRows).map(normalizeRow);

    // Derive parent from parent-child dependency (with context)
    const parentDep = /** @type {any[]} */ (depRows).find(
      (d) => d.issue_id === id && d.type === 'parent-child'
    );
    if (parentDep) {
      issue.parent_id = parentDep.depends_on_id;
      issue.parent = parentDep.depends_on_id;
      // Fetch parent title/status for sidebar context
      const [parentRows] = await pool.query(
        `SELECT id, title, status, issue_type FROM issues WHERE id = ?`,
        [parentDep.depends_on_id]
      );
      const parentIssues = /** @type {any[]} */ (parentRows);
      if (parentIssues.length > 0) {
        issue.parent_title = parentIssues[0].title;
        issue.parent_status = parentIssues[0].status;
        issue.parent_type = parentIssues[0].issue_type;
      }
    }

    // Derive dependency/dependent counts
    issue.dependency_count = /** @type {any[]} */ (depRows).filter(
      (d) => d.issue_id === id && d.type === 'blocks'
    ).length;
    issue.dependent_count = /** @type {any[]} */ (depRows).filter(
      (d) => d.depends_on_id === id && d.type === 'blocks'
    ).length;

    // Fetch labels
    const [labelRows] = await pool.query(
      `SELECT label FROM labels WHERE issue_id = ?`, [id]
    );
    issue.labels = /** @type {any[]} */ (labelRows).map((r) => r.label);

    // Fetch children (issues that have a parent-child dep pointing to this issue)
    const [childRows] = await pool.query(
      `SELECT i.id, i.title, i.status, i.priority, i.issue_type, i.assignee
       FROM dependencies d
       JOIN issues i ON i.id = d.issue_id
       WHERE d.depends_on_id = ? AND d.type = 'parent-child'
       ORDER BY i.created_at ASC`, [id]
    );
    const children = /** @type {any[]} */ (childRows).map(normalizeRow);
    if (children.length > 0) {
      issue.dependents = children;
      issue.total_children = children.length;
      issue.closed_children = children.filter((c) => c.status === 'closed').length;
    }

    // Fetch comment count
    const [commentRows] = await pool.query(
      `SELECT COUNT(*) as cnt FROM comments WHERE issue_id = ?`, [id]
    );
    issue.comment_count = /** @type {any[]} */ (commentRows)[0]?.cnt || 0;

    return { ok: true, item: issue };
  } catch (err) {
    log('queryIssueDetail error: %o', err);
    return { ok: false, error: { code: 'db_error', message: String(/** @type {any} */ (err).message) } };
  }
}

/**
 * Fetch comments for an issue.
 *
 * @param {string} issueId
 * @returns {Promise<{ ok: true, items: Array<Record<string, unknown>> } | { ok: false, error: { code: string, message: string } }>}
 */
export async function queryComments(issueId) {
  const pool = getPool();
  if (!pool) return { ok: false, error: { code: 'no_pool', message: 'Dolt pool not available' } };
  try {
    const [rows] = await pool.query(
      `SELECT id, issue_id, author, text, created_at FROM comments
       WHERE issue_id = ? ORDER BY created_at ASC`, [issueId]
    );
    return { ok: true, items: /** @type {any[]} */ (rows).map(normalizeRow) };
  } catch (err) {
    log('queryComments error: %o', err);
    return { ok: false, error: { code: 'db_error', message: String(/** @type {any} */ (err).message) } };
  }
}

/**
 * Update a single field on an issue.
 *
 * @param {string} id
 * @param {string} field - SQL column name
 * @param {string | number | null} value
 * @returns {Promise<{ ok: true } | { ok: false, error: { code: string, message: string } }>}
 */
export async function updateIssueField(id, field, value) {
  const pool = getPool();
  if (!pool) return { ok: false, error: { code: 'no_pool', message: 'Dolt pool not available' } };

  // Whitelist allowed columns to prevent SQL injection
  const ALLOWED_FIELDS = new Set([
    'title', 'description', 'design', 'acceptance_criteria', 'notes',
    'status', 'priority', 'assignee', 'issue_type'
  ]);
  if (!ALLOWED_FIELDS.has(field)) {
    return { ok: false, error: { code: 'bad_request', message: `Field '${field}' not allowed` } };
  }

  try {
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    // Handle status=closed → set closed_at
    if (field === 'status' && value === 'closed') {
      await pool.query(
        `UPDATE issues SET status = 'closed', closed_at = ?, updated_at = ? WHERE id = ?`,
        [now, now, id]
      );
    } else if (field === 'status' && value !== 'closed') {
      // Reopening: clear closed_at
      await pool.query(
        `UPDATE issues SET status = ?, closed_at = NULL, updated_at = ? WHERE id = ?`,
        [value, now, id]
      );
    } else {
      await pool.query(
        `UPDATE issues SET \`${field}\` = ?, updated_at = ? WHERE id = ?`,
        [value, now, id]
      );
    }
    await doltCommit(pool, `update ${field} on ${id}`);
    return { ok: true };
  } catch (err) {
    log('updateIssueField error: %o', err);
    return { ok: false, error: { code: 'db_error', message: String(/** @type {any} */ (err).message) } };
  }
}

/**
 * Add a comment to an issue.
 *
 * @param {string} issueId
 * @param {string} text
 * @param {string} author
 * @returns {Promise<{ ok: true } | { ok: false, error: { code: string, message: string } }>}
 */
export async function addComment(issueId, text, author) {
  const pool = getPool();
  if (!pool) return { ok: false, error: { code: 'no_pool', message: 'Dolt pool not available' } };
  try {
    await pool.query(
      `INSERT INTO comments (issue_id, author, text) VALUES (?, ?, ?)`,
      [issueId, author, text]
    );
    await doltCommit(pool, `add comment on ${issueId}`);
    return { ok: true };
  } catch (err) {
    log('addComment error: %o', err);
    return { ok: false, error: { code: 'db_error', message: String(/** @type {any} */ (err).message) } };
  }
}

/**
 * Add a dependency.
 *
 * @param {string} issueId
 * @param {string} dependsOnId
 * @param {string} [createdBy]
 * @returns {Promise<{ ok: true } | { ok: false, error: { code: string, message: string } }>}
 */
export async function addDependency(issueId, dependsOnId, createdBy = '') {
  const pool = getPool();
  if (!pool) return { ok: false, error: { code: 'no_pool', message: 'Dolt pool not available' } };
  try {
    await pool.query(
      `INSERT IGNORE INTO dependencies (issue_id, depends_on_id, type, created_by)
       VALUES (?, ?, 'blocks', ?)`,
      [issueId, dependsOnId, createdBy]
    );
    await doltCommit(pool, `add dep ${issueId} → ${dependsOnId}`);
    return { ok: true };
  } catch (err) {
    log('addDependency error: %o', err);
    return { ok: false, error: { code: 'db_error', message: String(/** @type {any} */ (err).message) } };
  }
}

/**
 * Remove a dependency.
 *
 * @param {string} issueId
 * @param {string} dependsOnId
 * @returns {Promise<{ ok: true } | { ok: false, error: { code: string, message: string } }>}
 */
export async function removeDependency(issueId, dependsOnId) {
  const pool = getPool();
  if (!pool) return { ok: false, error: { code: 'no_pool', message: 'Dolt pool not available' } };
  try {
    await pool.query(
      `DELETE FROM dependencies WHERE issue_id = ? AND depends_on_id = ? AND type = 'blocks'`,
      [issueId, dependsOnId]
    );
    await doltCommit(pool, `remove dep ${issueId} → ${dependsOnId}`);
    return { ok: true };
  } catch (err) {
    log('removeDependency error: %o', err);
    return { ok: false, error: { code: 'db_error', message: String(/** @type {any} */ (err).message) } };
  }
}

/**
 * Add a label to an issue.
 *
 * @param {string} issueId
 * @param {string} label
 * @returns {Promise<{ ok: true } | { ok: false, error: { code: string, message: string } }>}
 */
export async function addLabel(issueId, label) {
  const pool = getPool();
  if (!pool) return { ok: false, error: { code: 'no_pool', message: 'Dolt pool not available' } };
  try {
    await pool.query(
      `INSERT IGNORE INTO labels (issue_id, label) VALUES (?, ?)`,
      [issueId, label]
    );
    await doltCommit(pool, `add label '${label}' on ${issueId}`);
    return { ok: true };
  } catch (err) {
    log('addLabel error: %o', err);
    return { ok: false, error: { code: 'db_error', message: String(/** @type {any} */ (err).message) } };
  }
}

/**
 * Remove a label from an issue.
 *
 * @param {string} issueId
 * @param {string} label
 * @returns {Promise<{ ok: true } | { ok: false, error: { code: string, message: string } }>}
 */
export async function removeLabel(issueId, label) {
  const pool = getPool();
  if (!pool) return { ok: false, error: { code: 'no_pool', message: 'Dolt pool not available' } };
  try {
    await pool.query(
      `DELETE FROM labels WHERE issue_id = ? AND label = ?`,
      [issueId, label]
    );
    await doltCommit(pool, `remove label '${label}' from ${issueId}`);
    return { ok: true };
  } catch (err) {
    log('removeLabel error: %o', err);
    return { ok: false, error: { code: 'db_error', message: String(/** @type {any} */ (err).message) } };
  }
}

/**
 * Delete an issue.
 *
 * @param {string} id
 * @returns {Promise<{ ok: true } | { ok: false, error: { code: string, message: string } }>}
 */
export async function deleteIssue(id) {
  const pool = getPool();
  if (!pool) return { ok: false, error: { code: 'no_pool', message: 'Dolt pool not available' } };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM comments WHERE issue_id = ?`, [id]);
    await conn.query(`DELETE FROM labels WHERE issue_id = ?`, [id]);
    await conn.query(`DELETE FROM dependencies WHERE issue_id = ? OR depends_on_id = ?`, [id, id]);
    await conn.query(`DELETE FROM issues WHERE id = ?`, [id]);
    await conn.commit();
    conn.release();
    await doltCommit(pool, `delete issue ${id}`);
    return { ok: true };
  } catch (err) {
    try { await conn.rollback(); } catch { /* ignore */ }
    conn.release();
    log('deleteIssue error: %o', err);
    return { ok: false, error: { code: 'db_error', message: String(/** @type {any} */ (err).message) } };
  }
}

/**
 * Dolt commit (auto-commit to working set).
 * Uses CALL dolt_commit() to persist changes to the Dolt commit graph.
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} message
 */
async function doltCommit(pool, message) {
  try {
    await pool.query(`CALL dolt_commit('-Am', ?)`, [message]);
  } catch (err) {
    // If nothing to commit, that's fine
    const msg = /** @type {any} */ (err).message || '';
    if (!msg.includes('nothing to commit')) {
      log('dolt_commit warning: %s', msg);
    }
  }
}

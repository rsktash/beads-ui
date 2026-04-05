import { runBdJson } from './bd.js';
import {
  isDoltPoolReady,
  queryAllIssues,
  queryBlockedIssues,
  queryEpics,
  queryIssueDetail,
  queryIssuesByStatus,
  queryReadyIssues,
  querySearchIssues
} from './dolt-queries.js';
import { debug } from './logging.js';

const log = debug('list-adapters');

/**
 * Build concrete `bd` CLI args for a subscription type + params.
 * Always includes `--json` for parseable output.
 *
 * @param {{ type: string, params?: Record<string, string | number | boolean> }} spec
 * @returns {string[]}
 */
export function mapSubscriptionToBdArgs(spec) {
  const t = String(spec.type);
  switch (t) {
    case 'all-issues': {
      return ['list', '--json', '--tree=false', '--all'];
    }
    case 'epics': {
      return ['list', '--json', '--tree=false', '--type=epic', '--all'];
    }
    case 'blocked-issues': {
      return ['blocked', '--json'];
    }
    case 'ready-issues': {
      return ['ready', '--limit', '1000', '--json'];
    }
    case 'in-progress-issues': {
      return ['list', '--json', '--tree=false', '--status', 'in_progress'];
    }
    case 'closed-issues': {
      return [
        'list',
        '--json',
        '--tree=false',
        '--status',
        'closed',
        '--limit',
        '1000'
      ];
    }
    case 'search-issues': {
      const p = spec.params || {};
      const q = String(p.q || '').trim();
      const args = ['list', '--json', '--tree=false', '--all'];
      // bd CLI doesn't support FULLTEXT — use list with status/type flags
      if (p.status && p.status !== 'all') args.push('--status', String(p.status));
      if (p.type && p.type !== 'all') args.push('--type', String(p.type));
      // When there's a query term, use `bd search` (limited but best we can do via CLI)
      if (q.length > 0) return ['search', q, '--json'];
      return args;
    }
    case 'issue-detail': {
      const p = spec.params || {};
      const id = String(p.id || '').trim();
      if (id.length === 0) {
        throw badRequest('Missing param: params.id');
      }
      return ['show', id, '--json'];
    }
    default: {
      throw badRequest(`Unknown subscription type: ${t}`);
    }
  }
}

/**
 * Normalize bd list output to minimal Issue shape used by the registry.
 * - Ensures `id` is a string.
 * - Coerces timestamps to numbers.
 * - `closed_at` defaults to null when missing or invalid.
 *
 * @param {unknown} value
 * @returns {Array<{ id: string, created_at: number, updated_at: number, closed_at: number | null } & Record<string, unknown>>}
 */
export function normalizeIssueList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  /** @type {Array<{ id: string, created_at: number, updated_at: number, closed_at: number | null } & Record<string, unknown>>} */
  const out = [];
  for (const it of value) {
    const id = String(it.id ?? '');
    if (id.length === 0) {
      continue;
    }
    const created_at = parseTimestamp(/** @type {any} */ (it).created_at);
    const updated_at = parseTimestamp(it.updated_at);
    const closed_raw = it.closed_at;
    /** @type {number | null} */
    let closed_at = null;
    if (closed_raw !== undefined && closed_raw !== null) {
      const n = parseTimestamp(closed_raw);
      closed_at = Number.isFinite(n) ? n : null;
    }
    out.push({
      ...it,
      id,
      created_at: Number.isFinite(created_at) ? created_at : 0,
      updated_at: Number.isFinite(updated_at) ? updated_at : 0,
      closed_at
    });
  }
  return out;
}

/**
 * @typedef {Object} FetchListResultSuccess
 * @property {true} ok
 * @property {Array<{ id: string, updated_at: number, closed_at: number | null } & Record<string, unknown>>} items
 * @property {number} [total] - Total count for paginated queries
 */

/**
 * @typedef {Object} FetchListResultFailure
 * @property {false} ok
 * @property {{ code: string, message: string, details?: Record<string, unknown> }} error
 */

/**
 * Execute the mapped `bd` command for a subscription spec and return normalized items.
 * Errors do not throw; they are surfaced as a structured object.
 *
 * @param {{ type: string, params?: Record<string, string | number | boolean> }} spec
 * @param {{ cwd?: string }} [options] - Optional working directory for bd command
 * @returns {Promise<FetchListResultSuccess | FetchListResultFailure>}
 */
export async function fetchListForSubscription(spec, options = {}) {
  if (isDoltPoolReady()) {
    log('using SQL fast path for %s', spec.type);
    try {
      return await fetchViaSQL(spec);
    } catch (err) {
      log('SQL fast path failed for %s: %o', spec.type, err);
      // Don't fall back to bd CLI — sql-server holds the lock
      return {
        ok: false,
        error: {
          code: 'db_error',
          message: (err && /** @type {any} */ (err).message) || 'SQL query failed'
        }
      };
    }
  }

  log('using bd CLI fallback for %s', spec.type);
  return fetchViaBdCli(spec, options);
}

/**
 * Hydrate parent context for a single detail item.
 * `bd show --json` can include the parent id without the parent's display fields.
 *
 * @param {Record<string, unknown>} item
 * @param {{ cwd?: string }} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function enrichIssueDetailParentContext(item, options = {}) {
  const parentIdRaw = item.parent_id ?? item.parent;
  const parentId =
    typeof parentIdRaw === 'string'
      ? parentIdRaw.trim()
      : parentIdRaw === undefined || parentIdRaw === null
        ? ''
        : String(parentIdRaw).trim();

  if (parentId.length === 0) {
    return item;
  }

  const enriched = {
    ...item,
    parent_id: parentId,
    parent: parentId
  };

  if (
    typeof enriched.parent_title === 'string' &&
    typeof enriched.parent_status === 'string' &&
    typeof enriched.parent_type === 'string'
  ) {
    return enriched;
  }

  const res = await runBdJson(['show', parentId, '--json'], { cwd: options.cwd });
  if (
    !res ||
    res.code !== 0 ||
    !res.stdoutJson ||
    typeof res.stdoutJson !== 'object'
  ) {
    return enriched;
  }

  // bd show --json may return an array or a single object
  const parent = /** @type {Record<string, unknown>} */ (
    Array.isArray(res.stdoutJson) ? res.stdoutJson[0] : res.stdoutJson
  );
  if (!parent) return enriched;
  if (typeof parent.title === 'string') {
    enriched.parent_title = parent.title;
  }
  if (typeof parent.status === 'string') {
    enriched.parent_status = parent.status;
  }
  if (typeof parent.issue_type === 'string') {
    enriched.parent_type = parent.issue_type;
  }
  return enriched;
}

/**
 * @param {{ type: string, params?: Record<string, string | number | boolean> }} spec
 * @returns {Promise<FetchListResultSuccess | FetchListResultFailure>}
 */
async function fetchViaSQL(spec) {
  const t = String(spec.type);
  const p = spec.params || {};
  const pagination = {
    limit: typeof p.limit === 'number' ? p.limit : 0,
    offset: typeof p.offset === 'number' ? p.offset : 0
  };

  /**
   * @param {{ ok: true, items: any[], total: number }} res
   * @returns {FetchListResultSuccess}
   */
  const withTotal = (res) => ({ ok: true, items: normalizeIssueList(res.items), total: res.total });

  /** @param {() => Promise<any>} queryFn */
  const run = async (queryFn) => {
    const res = await queryFn();
    if (!res.ok) return { ok: false, error: res.error };
    return withTotal(res);
  };

  switch (t) {
    case 'all-issues':
      return run(() => queryAllIssues(pagination));
    case 'epics':
      return run(() => queryEpics(pagination));
    case 'blocked-issues':
      return run(() => queryBlockedIssues(pagination));
    case 'ready-issues':
      return run(() => queryReadyIssues(pagination));
    case 'in-progress-issues':
      return run(() => queryIssuesByStatus('in_progress', pagination));
    case 'closed-issues':
      return run(() => queryIssuesByStatus('closed', pagination.limit ? pagination : { limit: 1000, offset: 0 }));
    case 'search-issues': {
      const q = String(p.q || '').trim();
      const status = typeof p.status === 'string' ? p.status : undefined;
      const type = typeof p.type === 'string' ? p.type : undefined;
      // Always use querySearchIssues — it handles empty q with status/type filters
      return run(() => querySearchIssues(q, { ...pagination, status, type }));
    }
    case 'issue-detail': {
      const id = String(p.id || '').trim();
      if (id.length === 0) {
        return { ok: false, error: { code: 'bad_request', message: 'Missing param: params.id' } };
      }
      const res = await queryIssueDetail(id);
      if (!res.ok) return { ok: false, error: res.error };
      return { ok: true, items: normalizeIssueList([res.item]), total: 1 };
    }
    default:
      return { ok: false, error: { code: 'bad_request', message: `Unknown subscription type: ${t}` } };
  }
}

/**
 * Slow fallback: spawn bd CLI subprocess.
 *
 * @param {{ type: string, params?: Record<string, string | number | boolean> }} spec
 * @param {{ cwd?: string }} options
 * @returns {Promise<FetchListResultSuccess | FetchListResultFailure>}
 */
async function fetchViaBdCli(spec, options) {
  /** @type {string[]} */
  let args;
  try {
    args = mapSubscriptionToBdArgs(spec);
  } catch (err) {
    // Surface bad requests (e.g., missing params)
    log('mapSubscriptionToBdArgs failed for %o: %o', spec, err);
    const e = toErrorObject(err);
    return { ok: false, error: e };
  }

  try {
    const res = await runBdJson(args, { cwd: options.cwd });
    if (!res || res.code !== 0 || !('stdoutJson' in res)) {
      log(
        'bd failed for %o (args=%o) code=%s stderr=%s',
        spec,
        args,
        res?.code,
        res?.stderr || ''
      );
      return {
        ok: false,
        error: {
          code: 'bd_error',
          message: String(res?.stderr || 'bd failed'),
          details: { exit_code: res?.code ?? -1 }
        }
      };
    }
    // bd show may return a single object; normalize to an array first
    let raw = Array.isArray(res.stdoutJson)
      ? res.stdoutJson
      : res.stdoutJson && typeof res.stdoutJson === 'object'
        ? [res.stdoutJson]
        : [];

    let items = normalizeIssueList(raw);
    if (String(spec.type) === 'issue-detail') {
      items = await Promise.all(
        items.map((item) => enrichIssueDetailParentContext(item, options))
      );
    }
    return { ok: true, items };
  } catch (err) {
    log('bd invocation failed for %o (args=%o): %o', spec, args, err);
    return {
      ok: false,
      error: {
        code: 'bd_error',
        message:
          (err && /** @type {any} */ (err).message) || 'bd invocation failed'
      }
    };
  }
}

/**
 * Create a `bad_request` error object.
 *
 * @param {string} message
 */
function badRequest(message) {
  const e = new Error(message);
  // @ts-expect-error add code
  e.code = 'bad_request';
  return e;
}

/**
 * Normalize arbitrary thrown values to a structured error object.
 *
 * @param {unknown} err
 * @returns {FetchListResultFailure['error']}
 */
function toErrorObject(err) {
  if (err && typeof err === 'object') {
    const any = /** @type {{ code?: unknown, message?: unknown }} */ (err);
    const code = typeof any.code === 'string' ? any.code : 'bad_request';
    const message =
      typeof any.message === 'string' ? any.message : 'Request error';
    return { code, message };
  }
  return { code: 'bad_request', message: 'Request error' };
}

/**
 * Parse a bd timestamp string to epoch ms using Date.parse.
 * Falls back to numeric coercion when parsing fails.
 *
 * @param {unknown} v
 * @returns {number}
 */
function parseTimestamp(v) {
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    if (Number.isFinite(ms)) {
      return ms;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : 0;
  }
  return 0;
}

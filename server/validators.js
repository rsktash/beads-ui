/**
 * Validation helpers for protocol payloads.
 *
 * Provides schema checks for subscription specs and selected mutations.
 */

/**
 * Known subscription types supported by the server.
 *
 * @type {Set<string>}
 */
const SUBSCRIPTION_TYPES = new Set([
  'all-issues',
  'epics',
  'blocked-issues',
  'ready-issues',
  'in-progress-issues',
  'closed-issues',
  'search-issues',
  'issue-detail'
]);

/**
 * Validate a subscribe-list payload and normalize to a SubscriptionSpec.
 *
 * @param {unknown} payload
 * @returns {{ ok: true, id: string, spec: { type: string, params?: Record<string, string|number|boolean> } } | { ok: false, code: 'bad_request', message: string }}
 */
export function validateSubscribeListPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      code: 'bad_request',
      message: 'payload must be an object'
    };
  }
  const any =
    /** @type {{ id?: unknown, type?: unknown, params?: unknown }} */ (payload);

  const id = typeof any.id === 'string' ? any.id : '';
  if (id.length === 0) {
    return {
      ok: false,
      code: 'bad_request',
      message: 'payload.id must be a non-empty string'
    };
  }

  const type = typeof any.type === 'string' ? any.type : '';
  if (type.length === 0 || !SUBSCRIPTION_TYPES.has(type)) {
    return {
      ok: false,
      code: 'bad_request',
      message: `payload.type must be one of: ${Array.from(SUBSCRIPTION_TYPES).join(', ')}`
    };
  }

  /** @type {Record<string, string|number|boolean> | undefined} */
  let params;
  if (any.params !== undefined) {
    if (
      !any.params ||
      typeof any.params !== 'object' ||
      Array.isArray(any.params)
    ) {
      return {
        ok: false,
        code: 'bad_request',
        message: 'payload.params must be an object when provided'
      };
    }
    params = /** @type {Record<string, string|number|boolean>} */ (any.params);
  }

  // Per-type param schemas
  if (type === 'issue-detail') {
    const id = String(params?.id ?? '').trim();
    if (id.length === 0) {
      return {
        ok: false,
        code: 'bad_request',
        message: 'params.id must be a non-empty string'
      };
    }
    params = { id };
  } else if (type === 'search-issues') {
    /** @type {Record<string, string|number|boolean>} */
    const cleaned = {};
    if (params && typeof params.q === 'string') cleaned.q = params.q;
    if (params && typeof params.status === 'string') cleaned.status = params.status;
    if (params && typeof params.type === 'string') cleaned.type = params.type;
    if (params && typeof params.limit === 'number') cleaned.limit = params.limit;
    if (params && typeof params.offset === 'number') cleaned.offset = params.offset;
    params = Object.keys(cleaned).length > 0 ? cleaned : undefined;
  } else if (type === 'closed-issues') {
    /** @type {Record<string, string|number|boolean>} */
    const cleaned = {};
    if (params && 'since' in params) {
      const since = params.since;
      const n = typeof since === 'number' ? since : Number.NaN;
      if (!Number.isFinite(n) || n < 0) {
        return {
          ok: false,
          code: 'bad_request',
          message: 'params.since must be a non-negative number (epoch ms)'
        };
      }
      cleaned.since = n;
    }
    // Allow pagination params
    if (params && typeof params.limit === 'number') cleaned.limit = params.limit;
    if (params && typeof params.offset === 'number') cleaned.offset = params.offset;
    params = Object.keys(cleaned).length > 0 ? cleaned : undefined;
  } else {
    // Allow pagination params (limit, offset) for all list types
    /** @type {Record<string, string|number|boolean>} */
    const cleaned = {};
    if (params && typeof params.limit === 'number') cleaned.limit = params.limit;
    if (params && typeof params.offset === 'number') cleaned.offset = params.offset;
    params = Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  return { ok: true, id, spec: { type, params } };
}

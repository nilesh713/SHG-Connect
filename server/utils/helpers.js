// Small shared helpers for controllers.

class AppError extends Error {
  constructor(message, status = 400, errors) {
    super(message);
    this.status = status;
    if (errors) this.errors = errors;
  }
}

// Wrap async route handlers so rejected promises reach the error handler
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Escape user text before using it inside a RegExp (prevents ReDoS / regex injection)
const escapeRegex = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Read pagination params safely
function getPagination(query, defaultLimit = 12, maxLimit = 50) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

function paginationMeta(total, page, limit) {
  return { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

// Resolve a named date range (today / week / month / custom) into {from, to}
function resolveDateRange({ range, from, to }) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  switch (range) {
    case 'today':
      return { from: start, to: now };
    case 'week': {
      start.setDate(start.getDate() - 6);
      return { from: start, to: now };
    }
    case 'month': {
      start.setDate(start.getDate() - 29);
      return { from: start, to: now };
    }
    case 'custom': {
      const f = from ? new Date(from) : null;
      const t = to ? new Date(to) : null;
      if (!f || isNaN(f) || !t || isNaN(t)) throw new AppError('Please choose a valid start and end date', 400);
      t.setHours(23, 59, 59, 999);
      if (f > t) throw new AppError('Start date must be before end date', 400);
      return { from: f, to: t };
    }
    default: {
      // "all" – last 365 days keeps charts readable
      start.setDate(start.getDate() - 364);
      return { from: start, to: now };
    }
  }
}

module.exports = { AppError, asyncHandler, escapeRegex, getPagination, paginationMeta, resolveDateRange };

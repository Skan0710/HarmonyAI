import { Types } from 'mongoose';

/**
 * Validate and sanitize an array of string IDs as Mongoose ObjectIds.
 * Returns only the IDs that pass validation.
 */
export function validateObjectIds(ids: unknown[]): string[] {
  if (!Array.isArray(ids)) return [];

  const valid: string[] = [];
  for (const id of ids) {
    if (typeof id === 'string' && Types.ObjectId.isValid(id.trim())) {
      valid.push(id.trim());
    }
  }
  return valid;
}

/**
 * Validate that a single string is a valid Mongoose ObjectId.
 */
export function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && Types.ObjectId.isValid(id.trim());
}

/**
 * Validate and trim a string input, returning undefined if empty.
 */
export function sanitizeString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return undefined;
}

/**
 * Validate and clamp a numeric input within optional bounds.
 */
export function sanitizeNumber(
  value: unknown,
  opts: { min?: number; max?: number; default?: number } = {}
): number | undefined {
  const num = typeof value === 'number' ? value : undefined;
  if (num === undefined || isNaN(num)) return opts.default;

  let result = num;
  if (opts.min !== undefined) result = Math.max(opts.min, result);
  if (opts.max !== undefined) result = Math.min(opts.max, result);
  return result;
}

/**
 * Extract and coerce query parameters from an Express request based on a schema.
 *
 * Example:
 *   extractQueryParams(req, {
 *     search: 'string',
 *     page: 'int',
 *     limit: 'int',
 *     minBpm: 'number',
 *   });
 */
export function extractQueryParams<T extends Record<string, any>>(
  req: { query: Record<string, unknown> },
  schema: Record<string, 'string' | 'number' | 'int'>
): T {
  const result = {} as Record<string, any>;

  for (const [key, type] of Object.entries(schema)) {
    const raw = req.query[key];
    if (raw === undefined || raw === null || raw === '') continue;

    switch (type) {
      case 'string':
        result[key] = String(raw);
        break;
      case 'int':
        result[key] = parseInt(String(raw), 10);
        break;
      case 'number':
        result[key] = parseFloat(String(raw));
        break;
    }
  }

  return result as T;
}

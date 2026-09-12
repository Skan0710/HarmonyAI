/**
 * PostgREST's `.or()`/`.and()` filter strings are parsed by splitting on
 * unescaped `,`, `(`, `)`. A raw user-controlled value spliced into one of
 * these (e.g. `%${query}%`) lets an attacker inject extra filter clauses
 * instead of just matching text. Quoting the value and escaping embedded
 * `"`/`\` neutralizes that per PostgREST's own escaping rules.
 */
export const escapePostgrestFilterValue = (value: string): string => {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
};

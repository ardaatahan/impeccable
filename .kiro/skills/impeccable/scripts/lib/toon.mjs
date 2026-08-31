/**
 * TOON (Token-Oriented Object Notation) emitter for the agent-facing CLI
 * surface (AXI spec axi/1.0-2026-07, principle 1: token-efficient output).
 *
 * Every structured stdout line the CLI prints for agents flows through this
 * module so the format stays consistent: `key: value` scalars, table headers
 * shaped `name[N]{field,...}:` with indented comma-separated rows, and named
 * blocks of pre-formatted lines like `help[2]:`.
 *
 * Shared by cli/bin (router, subcommands) and cli/engine (detect usage
 * errors), like impeccable-config.mjs.
 */

/** Quote a table cell when it contains a comma, quote, or newline. */
export function toonValue(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** `name[N]{field,...}:` header plus one indented row per entry. */
export function toonTable(name, fields, rows) {
  const header = `${name}[${rows.length}]{${fields.join(',')}}:`;
  const lines = rows.map((row) => '  ' + fields.map((f) => toonValue(row[f])).join(','));
  return [header, ...lines].join('\n');
}

/** A named block of pre-formatted lines, e.g. `help[2]:` suggestions. */
export function toonBlock(name, lines) {
  return [`${name}[${lines.length}]:`, ...lines.map((l) => '  ' + l)].join('\n');
}

/** `key: value` scalar lines. */
export function toonKV(pairs) {
  return pairs.map(([k, v]) => `${k}: ${v ?? ''}`.trimEnd()).join('\n');
}

/**
 * A usage error: the caller got the invocation wrong (unknown flag, unknown
 * command, missing argument) and can self-correct from the message alone.
 * Rendered by printUsageError as structured stdout, exit code 2 -- distinct
 * from runtime failures (exit 1) so agents can tell "fix the call" from
 * "the operation failed" (AXI principle 6).
 */
export class UsageError extends Error {
  constructor(message, suggestion = '') {
    super(message);
    this.name = 'UsageError';
    this.code = 'IMPECCABLE_USAGE';
    this.suggestion = suggestion;
  }
}

/**
 * Print a usage error to stdout in the same structured format as data.
 * Does not exit; callers own the `process.exit(2)`.
 */
export function printUsageError(error) {
  const lines = [`error: ${error.message}`];
  if (error.suggestion) lines.push(`suggestion: ${error.suggestion}`);
  console.log(lines.join('\n'));
}

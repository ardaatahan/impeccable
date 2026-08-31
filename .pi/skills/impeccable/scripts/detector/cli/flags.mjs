/**
 * The detect command's flag vocabulary, split out so the bin router can route
 * a leading detect flag (the `npx impeccable --json src/` shorthand) without
 * importing the scan engines, and so detectCli can reject unknown flags with
 * the valid set inline before any scanning starts.
 */

// Flags that stand alone. Includes deprecated spellings still accepted for
// back-compat (--fast, --gpt, --gemini and the single-dash -json / -fast).
export const DETECT_BOOLEAN_FLAGS = new Set([
  '--json', '-json', '--quiet', '--no-config', '--no-inline-ignores',
  '--no-design-system', '--no-advisory', '--fast', '-fast', '--gpt',
  '--gemini', '--help',
]);

// Flags that take a value, as `--flag value` or `--flag=value`.
export const DETECT_VALUE_FLAGS = new Set(['--scope', '--viewport']);

// The advertised set, for usage errors. Deprecated spellings stay out.
export const DETECT_FLAG_SUMMARY = '--json, --quiet, --scope, --viewport, --no-config, --no-inline-ignores, --no-design-system, --no-advisory, --help';

export function isKnownDetectFlag(arg) {
  const bare = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
  return DETECT_BOOLEAN_FLAGS.has(bare) || DETECT_VALUE_FLAGS.has(bare);
}

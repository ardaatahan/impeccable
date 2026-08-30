/**
 * Agent-facing CLI surface (AXI spec axi/1.0-2026-07).
 *
 * One registry describes every top-level command: its summary for the
 * commands table, its flags with defaults, and 2-3 runnable examples. The
 * router renders the home view, the root help, and per-command help from this
 * registry, and validates flags against it before dispatching, so unknown
 * flags fail fast with exit 2 and the valid set inline (AXI principles 6, 8,
 * 9, 10). The generated skills/impeccable-cli/SKILL.md is rendered from the
 * same data (scripts/generate-cli-skill.mjs), so it cannot drift from the CLI.
 *
 * detect and ignores parse rich positional grammars, so they validate their
 * own flags in their own modules; their registry entries carry `ownHelp` and
 * the router forwards `--help` to them.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { toonBlock, toonKV, toonTable, UsageError } from '../lib/toon.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const CLI_SUMMARY = 'design skills and anti-pattern detection for AI coding agents';

// Scope spellings shared by install and update. The long tail of aliases
// (--home, --local, ...) is accepted by getInstallScopeValue; only the
// canonical forms are advertised.
const SCOPE_FLAG_ROWS = [
  { flag: '--scope <project|user>', default: 'auto', description: 'Target the project checkout or the user home (also --project / --user)' },
];
const SCOPE_FLAG_ALIASES = ['--scope', '--install-scope', '--project', '--local', '--user', '--home', '--global'];

/**
 * The command registry. `flags` rows render in help; `accepts` is the full
 * whitelist for validation (advertised spellings plus accepted aliases).
 * `--help` / `-h` are always accepted and never listed per command.
 */
export const CLI_COMMANDS = [
  {
    name: 'detect',
    summary: 'Scan files or URLs for UI anti-patterns and design quality issues',
    ownHelp: true,
    homeSuggestion: 'impeccable detect <path-or-url>',
  },
  {
    name: 'ignores',
    summary: 'Manage detector ignore rules, files, and values',
    ownHelp: true,
    homeSuggestion: 'impeccable ignores list',
  },
  {
    name: 'install',
    summary: 'Install impeccable skills into your project or global harness',
    homeSuggestion: 'impeccable install -y',
    flags: [
      { flag: '-y, --yes', default: '', description: 'Skip prompts and accept defaults' },
      { flag: '--providers <names>', default: 'detected', description: 'Comma-separated harness list, e.g. claude,cursor' },
      ...SCOPE_FLAG_ROWS,
      { flag: '--force', default: '', description: 'Reinstall even when skills are already present' },
      { flag: '--no-hooks', default: '', description: 'Skip installing the design hook' },
    ],
    accepts: ['-y', '--yes', '--providers', '--force', '--no-hooks', ...SCOPE_FLAG_ALIASES],
    examples: [
      'impeccable install -y',
      'impeccable install --providers=claude,cursor --scope=project',
    ],
  },
  {
    name: 'link',
    summary: 'Symlink skills from a local checkout or submodule',
    flags: [
      { flag: '--source <path>', default: '.impeccable', description: 'Checkout or submodule holding compiled skills' },
      { flag: '--providers <names>', default: 'detected', description: 'Comma-separated harness list, e.g. claude,cursor' },
      { flag: '--force', default: '', description: 'Replace existing skill folders with links' },
      { flag: '-y, --yes', default: '', description: 'Skip prompts and accept defaults' },
    ],
    accepts: ['--source', '--providers', '--force', '-y', '--yes'],
    examples: [
      'impeccable link --source=.impeccable',
      'impeccable link --source=../impeccable --providers=claude -y',
    ],
  },
  {
    name: 'update',
    summary: 'Update installed skills to the latest version',
    flags: [
      { flag: '-y, --yes', default: '', description: 'Skip prompts and accept defaults' },
      ...SCOPE_FLAG_ROWS,
      { flag: '--force', default: '', description: 'Refresh hook files even when up to date' },
      { flag: '--no-hooks', default: '', description: 'Skip installing the design hook' },
    ],
    accepts: ['-y', '--yes', '--force', '--no-hooks', ...SCOPE_FLAG_ALIASES],
    examples: [
      'impeccable update -y',
      'impeccable update --user',
    ],
  },
  {
    name: 'check',
    summary: 'Check if skill updates are available',
    flags: [],
    accepts: [],
    examples: [
      'impeccable check',
    ],
  },
  {
    name: 'help',
    summary: 'List the /impeccable agent commands from impeccable.style',
    flags: [],
    accepts: [],
    examples: [
      'impeccable help',
    ],
  },
];

export function getCliCommand(name) {
  return CLI_COMMANDS.find((c) => c.name === name) || null;
}

function readCliVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));
    return pkg.version || '';
  } catch {
    return '';
  }
}

function formatBinPath(binPath, home = homedir()) {
  if (home && binPath.startsWith(home)) return `~${binPath.slice(home.length)}`;
  return binPath;
}

const HOME_SUGGESTIONS = CLI_COMMANDS
  .filter((c) => c.homeSuggestion)
  .map((c) => c.homeSuggestion)
  .concat(['impeccable check']);

/**
 * Home view: live, decision-relevant state, not a usage manual (AXI
 * principle 8). Shows which harnesses hold an impeccable skill install (and
 * at which version), the detector ignore counts for this project, and the
 * next commands that follow from that state. Local filesystem reads only.
 */
export async function printHome(binPath) {
  // Loaded lazily: the install-state helpers live in the skills module, which
  // pulls in the whole install/update machinery.
  const { findImpeccableProviders, findProjectRoot, getSkillsVersion, isHomeDir } = await import('./commands/skills.mjs');
  const { readDetectionConfig } = await import('../lib/impeccable-config.mjs');

  const projectRoot = findProjectRoot();
  const home = homedir();
  const rows = [];
  if (!isHomeDir(projectRoot)) {
    for (const provider of findImpeccableProviders(projectRoot, 'project')) {
      rows.push({ provider, scope: 'project', version: getSkillsVersion(projectRoot, 'project') || '' });
    }
  }
  for (const provider of findImpeccableProviders(home, 'user')) {
    rows.push({ provider, scope: 'user', version: getSkillsVersion(home, 'user') || '' });
  }

  const config = readDetectionConfig(process.cwd());
  const ignoreCount = config.ignoreRules.length + config.ignoreFiles.length + config.ignoreValues.length;
  const ignoresLine = ignoreCount === 0
    ? 'ignores: 0 detector ignores configured in this project'
    : `ignores: ${config.ignoreRules.length} rules, ${config.ignoreFiles.length} files, ${config.ignoreValues.length} values (.impeccable detector config)`;

  const lines = [
    toonKV([
      ['impeccable', `${formatBinPath(binPath)} - ${CLI_SUMMARY}`],
      ['version', readCliVersion()],
    ]),
    toonTable('skills', ['provider', 'scope', 'version'], rows),
  ];
  if (rows.length === 0) {
    lines.push('note: 0 impeccable skill installs found in this project or at the user level');
  }
  lines.push(ignoresLine);
  lines.push(toonBlock('help', HOME_SUGGESTIONS));
  console.log(lines.join('\n'));
}

/** Root help: the commands table, global flags, and runnable examples. */
export function printRootHelp() {
  console.log([
    toonKV([
      ['command', 'impeccable'],
      ['summary', CLI_SUMMARY],
    ]),
    toonTable('commands', ['command', 'summary'], CLI_COMMANDS.map((c) => ({ command: c.name, summary: c.summary }))),
    toonTable('flags', ['flag', 'description'], [
      { flag: '--help', description: 'Show help for the CLI or a command' },
      { flag: '--version', description: 'Print the CLI version' },
    ]),
    toonBlock('examples', [
      'impeccable detect src/',
      'impeccable install -y',
      'impeccable ignores add-file "src/legacy/**"',
    ]),
    'compat: the legacy `impeccable skills <command>` namespace is still supported',
  ].join('\n'));
}

/** Per-command help: flags with defaults plus examples, scoped to that command. */
export function printCommandHelp(name) {
  const cmd = getCliCommand(name);
  const lines = [
    toonKV([
      ['command', `impeccable ${name}`],
      ['summary', cmd.summary],
    ]),
    toonTable('flags', ['flag', 'default', 'description'], cmd.flags),
    toonBlock('examples', cmd.examples),
  ];
  console.log(lines.join('\n'));
}

/**
 * Reject unknown flags before any dependency call (AXI principle 6): exit 2
 * with the valid set inline so an agent self-corrects in one turn. Positional
 * arguments pass through untouched.
 */
export function assertKnownFlags(name, args) {
  const cmd = getCliCommand(name);
  if (!cmd || cmd.ownHelp) return;
  const known = new Set([...cmd.accepts, '--help', '-h']);
  for (const arg of args) {
    if (!arg.startsWith('-')) continue;
    const bare = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    if (!known.has(bare)) {
      const valid = cmd.accepts.length > 0 ? [...cmd.accepts, '--help'].join(', ') : '--help';
      throw new UsageError(
        `unknown flag ${bare} for 'impeccable ${name}'`,
        `valid flags for 'impeccable ${name}': ${valid}`,
      );
    }
  }
}

/**
 * Static SKILL.md content generated from the same registry as the home view,
 * with commands rewritten for zero-install execution (AXI principle 7).
 * scripts/generate-cli-skill.mjs writes and checks the committed copy.
 */
export function renderSkillMd() {
  const zeroInstall = (s) => s.replace(/^impeccable /, 'npx -y impeccable ');
  return [
    '---',
    'name: impeccable-cli',
    'description: Run the impeccable CLI to scan HTML, CSS, and component files or live URLs for UI anti-patterns, and to install, link, or update the impeccable design skills for AI coding agents.',
    '---',
    '',
    `impeccable: run with \`npx -y impeccable\` - ${CLI_SUMMARY}`,
    toonTable('commands', ['command', 'summary'], CLI_COMMANDS.map((c) => ({ command: c.name, summary: c.summary }))),
    toonBlock('help', HOME_SUGGESTIONS.map(zeroInstall)),
    '',
    'Structured TOON output on stdout; errors are structured too. Exit codes: 0 success or no-op, 1 runtime error, 2 usage error (and, for `detect`, 2 also means findings were reported). Every command answers `--help` with flags and examples.',
    '',
  ].join('\n');
}

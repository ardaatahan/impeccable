#!/usr/bin/env node

/**
 * Impeccable CLI
 *
 * Usage:
 *   npx impeccable                    Home view: install state, ignores, next steps
 *   npx impeccable detect [file-or-dir-or-url...]
 *   npx impeccable ignores <list|add-file|add-value|remove-...>
 *   npx impeccable help|install|link|update|check
 *   npx impeccable --help
 *
 * The agent-facing surface (home view, help, structured usage errors) follows
 * the AXI spec (axi/1.0-2026-07): TOON on stdout, exit 0 success / 1 error /
 * 2 usage error, and every command answers --help. See cli/bin/surface.mjs.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isKnownDetectFlag } from '../engine/cli/flags.mjs';
import { UsageError, printUsageError } from '../lib/toon.mjs';
import { assertKnownFlags, getCliCommand, printCommandHelp, printHome, printRootHelp } from './surface.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_COMMANDS = new Set(['help', 'install', 'link', 'update', 'check']);

// Is this a detect target (the `npx impeccable src/` shorthand) or a mistyped
// command? URLs, path-shaped args, and real files/dirs (e.g. an extension-less
// `Dockerfile`) are targets; anything else is an unknown command. Flags route
// through the detect-flag whitelist before reaching this.
function looksLikeDetectTarget(arg) {
  const isUrl = /^https?:\/\//i.test(arg);
  const isPathShaped = arg.includes('/') || arg.includes('\\') || arg.includes('.');
  const isExistingPath = existsSync(resolve(arg));
  return isUrl || isPathShaped || isExistingPath;
}

async function runDetect(detectArgs) {
  process.argv = [process.argv[0], process.argv[1], ...detectArgs];
  const { detectCli } = await import('../engine/cli/main.mjs');
  await detectCli();
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Content first (AXI principle 8): the bare invocation shows live state,
  // usage lives behind --help.
  if (!command) {
    await printHome(process.argv[1]);
    process.exit(0);
  }

  if (command === '--help' || command === '-h') {
    printRootHelp();
    process.exit(0);
  }

  if (command === '--version' || command === '-v') {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));
    console.log(pkg.version);
    process.exit(0);
  }

  if (command === 'detect') {
    await runDetect(args.slice(1));
  } else if (command === 'ignores' || command === 'ignore') {
    const { run } = await import('./commands/ignores.mjs');
    await run(args.slice(1));
  } else if (command === 'skills' || SKILL_COMMANDS.has(command)) {
    // The legacy `skills <command>` namespace resolves to the same top-level
    // commands; `impeccable skills` alone lists commands like `impeccable help`.
    const name = command === 'skills' ? (args[1] ?? 'help') : command;
    const rest = command === 'skills' ? args.slice(2) : args.slice(1);
    if (name === '--help' || name === '-h') {
      printRootHelp();
      process.exit(0);
    }
    if (getCliCommand(name) && (rest.includes('--help') || rest.includes('-h'))) {
      printCommandHelp(name);
      process.exit(0);
    }
    assertKnownFlags(name, rest);
    const { run } = await import('./commands/skills.mjs');
    await run([name, ...rest]);
  } else if (command.startsWith('-')) {
    // Leading detect flags keep the `npx impeccable --json src/` shorthand;
    // anything else is an unknown flag and fails fast with the valid set.
    if (!isKnownDetectFlag(command)) {
      throw new UsageError(
        `unknown flag ${command}`,
        'valid flags: --help, --version; detect flags such as --json or --scope apply when scanning, e.g. impeccable --json src/',
      );
    }
    await runDetect(args);
  } else if (looksLikeDetectTarget(command)) {
    // Default: treat as detect arguments (allow `npx impeccable src/` shorthand)
    await runDetect(args);
  } else if (command === 'init') {
    // The follow-up mistake from issue #472: `/impeccable init` belongs in an AI
    // coding agent's chat, and a user who typed it into their shell is likely to
    // retry it here as `npx impeccable init`.
    throw new UsageError(
      '"init" is not a CLI command',
      "type /impeccable init in your AI coding agent's chat (Claude Code, Cursor, Codex, ...), not in this terminal",
    );
  } else {
    // An unknown bareword: a mistyped command (or an old cached version run
    // against newer docs). Fail loudly instead of silently statting it as a path.
    throw new UsageError(
      `unknown command "${command}"`,
      'valid commands: detect, ignores, install, link, update, check, help',
    );
  }
}

main().catch(error => {
  if (error?.code === 'IMPECCABLE_PROMPT_ABORT') {
    console.log('\nAborted.');
    process.exit(130);
  }

  // Usage errors are agent-consumed output: structured stdout, exit 2.
  if (error?.code === 'IMPECCABLE_USAGE') {
    printUsageError(error);
    process.exit(2);
  }

  console.error(error?.message || error);
  process.exit(1);
});

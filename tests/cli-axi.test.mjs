/**
 * Agent-ergonomics contract for the CLI surface (AXI spec axi/1.0-2026-07).
 *
 * Pins the behaviors `axi-axi validate --strict` probes so a regression shows
 * up here without the validator installed: the bare invocation is a live home
 * view (not a usage dump), every advertised subcommand answers --help with
 * exit 0, unknown flags and commands are structured stdout usage errors with
 * exit 2, and the generated skills/impeccable-cli/SKILL.md stays fresh.
 *
 * Run with: node --test tests/cli-axi.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../cli/bin/cli.js', import.meta.url));
const SKILL_GEN = fileURLToPath(new URL('../scripts/generate-cli-skill.mjs', import.meta.url));

// The subcommands advertised by the root help commands table. The AXI
// validator discovers and probes exactly these.
const SUBCOMMANDS = ['detect', 'ignores', 'install', 'link', 'update', 'check', 'help'];

function runCli(args, opts = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', ...opts });
  if (result.error) throw result.error;
  return result;
}

/** Run in an empty temp dir with an empty temp HOME, so state is deterministic. */
function runIsolated(args) {
  const cwd = mkdtempSync(join(tmpdir(), 'imp-axi-cwd-'));
  const home = mkdtempSync(join(tmpdir(), 'imp-axi-home-'));
  try {
    return runCli(args, { cwd, env: { ...process.env, HOME: home } });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
}

describe('home view (bare invocation)', () => {
  it('shows live content with count headers and suggestions, not a usage dump', () => {
    const r = runIsolated([]);
    assert.equal(r.status, 0);
    assert.equal(r.stderr, '');
    assert.doesNotMatch(r.stdout, /^\s*usage[:\s]/i);
    assert.match(r.stdout, /^impeccable: /);
    assert.match(r.stdout, /skills\[\d+\]\{provider,scope,version\}:/);
    assert.match(r.stdout, /(^|\n)help\[\d+\]:/);
  });

  it('names the searched context when nothing is installed', () => {
    const r = runIsolated([]);
    assert.match(r.stdout, /0 impeccable skill installs found/);
    assert.match(r.stdout, /ignores: 0 detector ignores configured/);
  });
});

describe('root help', () => {
  it('lists commands, flags, and examples with exit 0', () => {
    const r = runIsolated(['--help']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /commands\[\d+\]\{command,summary\}:/);
    assert.match(r.stdout, /examples\[\d+\]:/);
    assert.match(r.stdout, /--version/);
  });
});

describe('subcommand help', () => {
  for (const sub of SUBCOMMANDS) {
    it(`\`${sub} --help\` exits 0 without side effects`, () => {
      const r = runIsolated([sub, '--help']);
      assert.equal(r.status, 0, `${sub} --help exited ${r.status}: ${r.stdout}${r.stderr}`);
      assert.notEqual(r.stdout.trim(), '');
    });
  }

  it('answers through the legacy skills namespace too', () => {
    assert.equal(runIsolated(['skills', '--help']).status, 0);
    assert.equal(runIsolated(['skills', 'install', '--help']).status, 0);
  });
});

describe('usage errors: structured stdout, exit 2', () => {
  it('rejects an unknown top-level flag and lists valid flags', () => {
    const r = runIsolated(['--definitely-not-a-flag']);
    assert.equal(r.status, 2);
    assert.match(r.stdout, /^error: unknown flag --definitely-not-a-flag/);
    assert.match(r.stdout, /suggestion: .*--help/);
  });

  it('rejects an unknown command and names the valid ones', () => {
    const r = runIsolated(['frobnicate']);
    assert.equal(r.status, 2);
    assert.match(r.stdout, /^error: unknown command "frobnicate"/);
    assert.match(r.stdout, /valid commands: detect, ignores, install/);
  });

  it('rejects an unknown detect flag before scanning anything', () => {
    const r = runIsolated(['detect', '--definitely-not-a-flag']);
    assert.equal(r.status, 2);
    assert.match(r.stdout, /valid flags for 'impeccable detect': .*--json/);
  });

  it('rejects an unknown install flag without prompting or downloading', () => {
    const r = runIsolated(['install', '--definitely-not-a-flag']);
    assert.equal(r.status, 2);
    assert.match(r.stdout, /valid flags for 'impeccable install': .*--providers/);
  });

  it('rejects an unknown ignores action with the valid action list', () => {
    const r = runIsolated(['ignores', 'frobnicate']);
    assert.equal(r.status, 2);
    assert.match(r.stdout, /valid actions for 'impeccable ignores': list, add-rule/);
  });

  it('still routes known detect flags through the top-level shorthand', () => {
    const r = runIsolated(['--json']);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '[]');
  });
});

describe('generated SKILL.md', () => {
  it('skill:check confirms the committed copy matches the registry', () => {
    const r = spawnSync(process.execPath, [SKILL_GEN, '--check'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });
});

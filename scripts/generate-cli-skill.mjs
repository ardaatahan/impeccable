#!/usr/bin/env node

/**
 * Generate skills/impeccable-cli/SKILL.md from the CLI command registry
 * (cli/bin/surface.mjs), with commands rewritten for zero-install execution
 * (AXI principle 7: session context). The committed copy can never drift from
 * the CLI surface because `npm run skill:check` regenerates and compares.
 *
 * Usage:
 *   node scripts/generate-cli-skill.mjs           # write skills/impeccable-cli/SKILL.md
 *   node scripts/generate-cli-skill.mjs --check   # verify the committed copy is fresh
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderSkillMd } from '../cli/bin/surface.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'skills', 'impeccable-cli', 'SKILL.md');
const relPath = relative(root, outPath);
const content = renderSkillMd();

if (process.argv.includes('--check')) {
  let committed = null;
  try {
    committed = readFileSync(outPath, 'utf8');
  } catch {}
  if (committed !== content) {
    console.error(`${relPath} is stale. Run \`npm run skill:gen\` and commit the result.`);
    process.exit(1);
  }
  console.log(`${relPath} is fresh.`);
} else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content);
  console.log(`Wrote ${relPath}.`);
}

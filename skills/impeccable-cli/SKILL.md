---
name: impeccable-cli
description: Run the impeccable CLI to scan HTML, CSS, and component files or live URLs for UI anti-patterns, and to install, link, or update the impeccable design skills for AI coding agents.
---

impeccable: run with `npx -y impeccable` - design skills and anti-pattern detection for AI coding agents
commands[7]{command,summary}:
  detect,Scan files or URLs for UI anti-patterns and design quality issues
  ignores,"Manage detector ignore rules, files, and values"
  install,Install impeccable skills into your project or global harness
  link,Symlink skills from a local checkout or submodule
  update,Update installed skills to the latest version
  check,Check if skill updates are available
  help,List the /impeccable agent commands from impeccable.style
help[4]:
  npx -y impeccable detect <path-or-url>
  npx -y impeccable ignores list
  npx -y impeccable install -y
  npx -y impeccable check

Structured TOON output on stdout; errors are structured too. Exit codes: 0 success or no-op, 1 runtime error, 2 usage error (and, for `detect`, 2 also means findings were reported). Every command answers `--help` with flags and examples.

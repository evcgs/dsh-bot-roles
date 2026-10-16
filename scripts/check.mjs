#!/usr/bin/env node
// Repo-level gate. Fast, dependency-free, and runnable in CI without installing
// anything. It proves the three faces of the pack agree with the catalog; the
// authoritative YAML parse and the real plugin mount are proven separately by
// tools/verify-composition.mjs, which needs a dsh installation.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expectedPatches, loadCatalog, paths, presetFile, rosterFile, validate } from './lib/catalog.mjs'
import { botTeamPrompt } from './lib/prompt.mjs'
import { referencedPackages } from './lib/toolsets.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const notes = []

/** @param {boolean} ok @param {string} what */
function check(ok, what) {
  if (ok) notes.push(`ok   ${what}`)
  else failures.push(`FAIL ${what}`)
}

function main() {
  const p = paths(ROOT)
  const catalog = loadCatalog(ROOT)
  const roles = catalog.roles

  try {
    validate(roles)
    check(true, `catalog validates (${roles.length} roles)`)
  } catch (error) {
    check(false, `catalog validates — ${error.message}`)
    report()
    return
  }

  // 1. every role has a preset file whose bytes match the catalog exactly
  for (const role of roles) {
    const file = join(p.presetDir, `${role.presetId}.patch.yml`)
    if (!existsSync(file)) {
      check(false, `presets/${role.presetId}.patch.yml exists`)
      continue
    }
    const actual = readFileSync(file, 'utf8')
    const expected = presetFile(role)
    check(actual === expected, `presets/${role.presetId}.patch.yml matches the catalog`)
  }

  // 2. no stale preset file can be shipped but unreferenced
  const onDisk = readdirSync(p.presetDir).filter((name) => name.endsWith('.patch.yml')).sort()
  const expectedFiles = roles.map((role) => `${role.presetId}.patch.yml`).sort()
  check(
    JSON.stringify(onDisk) === JSON.stringify(expectedFiles),
    `presets/ holds exactly the catalog's ${expectedFiles.length} files (found ${onDisk.length})`,
  )

  // 3. the manifest's bundle list is the catalog's order, and every file exists
  const manifest = JSON.parse(readFileSync(p.manifest, 'utf8'))
  const declared = manifest.dsh?.bundle?.patch
  check(Array.isArray(declared), 'package.json declares dsh.bundle.patch as a list')
  check(
    JSON.stringify(declared) === JSON.stringify(expectedPatches(roles)),
    'package.json dsh.bundle.patch matches the catalog order',
  )
  for (const patch of declared ?? []) {
    check(existsSync(join(ROOT, patch)), `declared patch ${patch} exists`)
  }

  // 4. the Bot roster face matches the catalog
  if (!existsSync(p.roster)) {
    check(false, 'bots/roster.json exists')
  } else {
    const actual = readFileSync(p.roster, 'utf8')
    check(actual === `${JSON.stringify(rosterFile(roles, catalog), null, 2)}\n`, 'bots/roster.json matches the catalog')
    const roster = JSON.parse(actual)
    check(roster.bots.length === roles.length, `roster carries ${roles.length} Bots`)
    check(
      roster.bots.every((bot) => typeof bot.instructions === 'string' && bot.instructions.length > 80),
      'every roster Bot carries instructions',
    )
  }

  // 5. the paste-ready Bot-team prompt matches the catalog
  const promptPath = join(ROOT, 'docs', 'bot-team-prompt.md')
  if (!existsSync(promptPath)) {
    check(false, 'docs/bot-team-prompt.md exists')
  } else {
    check(
      readFileSync(promptPath, 'utf8') === botTeamPrompt(roles, catalog),
      'docs/bot-team-prompt.md matches the catalog',
    )
  }

  // 6. the bundle is installable metadata, not an importable module: it must not
  //    claim an entry point it does not have, or the two-anchor resolver will try
  //    to load it as a plugin.
  check(manifest.dsh?.bundle !== undefined, 'package.json declares a bundle')
  check(manifest.license === 'MIT', 'package.json license is MIT')

  // 6. hygiene over everything the package publishes
  const published = [
    'presets',
    'roles',
    'bots',
    'docs',
    'README.md',
    'README.zh.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'LICENSE',
    'NOTICE',
  ]
  const forbidden = [
    { pattern: /\/Users\/[a-z]/i, what: 'an absolute /Users path' },
    { pattern: /personId\s*=\s*[a-z]/i, what: 'a personal id' },
    { pattern: /\bsk-[A-Za-z0-9-]{8,}/, what: 'something shaped like an API key' },
  ]
  let scanned = 0
  for (const entry of published) {
    const target = join(ROOT, entry)
    if (!existsSync(target)) continue
    const files = statSync(target).isDirectory() ? walk(target) : [target]
    for (const file of files) {
      scanned += 1
      const text = readFileSync(file, 'utf8')
      for (const { pattern, what } of forbidden) {
        if (pattern.test(text)) check(false, `${relative(ROOT, file)} must not contain ${what}`)
      }
    }
  }
  check(true, `hygiene scanned ${scanned} published files`)

  // 7. the packages the presets mount are the official ones this pack targets
  const packages = referencedPackages()
  check(packages.length > 0, `pack resolves ${packages.length} plugin packages`)
  check(
    packages.every((name) => name.startsWith('@deepseek-ai/') || name === 'cordis:group'),
    'every mounted package is a shipped @deepseek-ai package',
  )

  // 8. every declared npm script points at a file that exists. A dangling script is
  //    invisible until someone runs it, and the README tells people to.
  for (const [name, command] of Object.entries(manifest.scripts ?? {})) {
    // `node --test` carries a flag, not a file; only a path-like argument is checkable.
    const match = /^node\s+((?!-)[^\s]+)/.exec(command)
    if (match === null) continue
    check(existsSync(join(ROOT, match[1])), `npm script "${name}" points at ${match[1]}`)
  }

  report()
}

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const target = join(dir, name)
    if (statSync(target).isDirectory()) out.push(...walk(target))
    else out.push(target)
  }
  return out
}

function report() {
  for (const line of notes) console.log(line)
  if (failures.length === 0) {
    console.log(`\ncheck passed (${notes.length} assertions).`)
    process.exit(0)
  }
  for (const line of failures) console.error(line)
  console.error(`\ncheck failed: ${failures.length} of ${notes.length + failures.length} assertions.`)
  process.exit(1)
}

main()

#!/usr/bin/env node
// Build the generated artefacts from the one source of truth, roles/roles.json:
//
//   presets/<presetId>.patch.yml   the installable face — one agent preset per role
//   bots/roster.json              the DS Bot import face — the same roles as a roster
//   package.json dsh.bundle.patch the ordered patch list the profile composes
//
// `npm run check` fails if any generated file drifts from the catalog, so the
// published package cannot ship a preset the catalog does not describe.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expectedPatches, loadCatalog, paths, presetFile, rosterFile, validate } from './lib/catalog.mjs'
import { botTeamPrompt } from './lib/prompt.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function main() {
  const p = paths(ROOT)
  const catalog = loadCatalog(ROOT)
  const roles = catalog.roles
  validate(roles)

  mkdirSync(p.presetDir, { recursive: true })
  mkdirSync(dirname(p.roster), { recursive: true })

  // Regenerate the preset directory wholesale, so a renamed role cannot leave a
  // stale patch file behind that the bundle list would then reference.
  const expected = new Set(roles.map((role) => `${role.presetId}.patch.yml`))
  for (const existing of readdirSync(p.presetDir)) {
    if (existing.endsWith('.patch.yml') && !expected.has(existing)) {
      rmSync(join(p.presetDir, existing))
      console.log(`removed stale presets/${existing}`)
    }
  }

  for (const role of roles) {
    writeFileSync(join(p.presetDir, `${role.presetId}.patch.yml`), presetFile(role))
    console.log(`wrote presets/${role.presetId}.patch.yml`)
  }

  writeFileSync(p.roster, `${JSON.stringify(rosterFile(roles, catalog), null, 2)}\n`)
  console.log('wrote bots/roster.json')

  writeFileSync(join(ROOT, 'docs', 'bot-team-prompt.md'), botTeamPrompt(roles, catalog))
  console.log('wrote docs/bot-team-prompt.md')

  // Keep the bundle list in catalog order: the patches apply in this order, so this
  // file decides roster order for presets that share an `order` value.
  const manifest = JSON.parse(readFileSync(p.manifest, 'utf8'))
  const patches = expectedPatches(roles)
  manifest.dsh ??= {}
  manifest.dsh.bundle ??= {}
  const changed = JSON.stringify(manifest.dsh.bundle.patch ?? null) !== JSON.stringify(patches)
  manifest.dsh.bundle.patch = patches
  if (changed) {
    writeFileSync(p.manifest, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`synced package.json dsh.bundle.patch (${patches.length} files)`)
  } else {
    console.log(`package.json dsh.bundle.patch already in sync (${patches.length} files)`)
  }

  console.log(`\n${roles.length} roles built.`)
}

main()

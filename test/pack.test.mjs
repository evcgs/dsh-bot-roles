// The pack has three faces that must agree: the catalog, the shipped preset files,
// and the manifest's bundle list. These tests fail the moment one is edited alone.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expectedPatches, loadCatalog, paths, presetFile, rosterFile } from '../scripts/lib/catalog.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const P = paths(ROOT)
const catalog = loadCatalog(ROOT)
const manifest = JSON.parse(readFileSync(P.manifest, 'utf8'))

test('the bundle is a patch-only bundle: no entry point to resolve as a plugin', () => {
  assert.equal(manifest.dsh.bundle.patch.length, catalog.roles.length)
  assert.equal(manifest.main, undefined)
  assert.equal(manifest.peerDependencies, undefined, 'a declared peer would make the installer resolve a version this pack does not import')
})

test('every preset file is byte-identical to what the catalog generates', () => {
  for (const role of catalog.roles) {
    const onDisk = readFileSync(join(P.presetDir, `${role.presetId}.patch.yml`), 'utf8')
    assert.equal(onDisk, presetFile(role), `${role.presetId} has drifted; run npm run build`)
  }
})

test('presets/ holds no stale or extra patch file', () => {
  const onDisk = readdirSync(P.presetDir).filter((name) => name.endsWith('.patch.yml')).sort()
  assert.deepEqual(onDisk, catalog.roles.map((role) => `${role.presetId}.patch.yml`).sort())
})

test('the manifest bundle list is the catalog order', () => {
  assert.deepEqual(manifest.dsh.bundle.patch, expectedPatches(catalog.roles))
})

test('each preset inserts exactly one preset row with its own id', () => {
  for (const role of catalog.roles) {
    const text = presetFile(role)
    assert.equal(text.match(/dsh-agent-preset'/g)?.length, 1)
    assert.match(text, new RegExp(`id: 'preset-${role.presetId}'`))
    assert.match(text, new RegExp(`id: '${role.presetId}'`))
    assert.match(text, /name: '@deepseek-ai\/dsh-persona'/)
  }
})

test('no two presets would collide in a deployment roster', () => {
  const ids = catalog.roles.map((role) => role.presetId)
  assert.equal(new Set(ids).size, ids.length)
  // Shipped preset ids are unprefixed words (standard, ptc, minimal, cordis).
  for (const id of ids) assert.ok(id.startsWith('bot-'), `${id} could shadow a shipped preset`)
})

test('the Bot roster face mirrors the catalog, notes included', () => {
  const onDisk = JSON.parse(readFileSync(P.roster, 'utf8'))
  assert.deepEqual(onDisk, rosterFile(catalog.roles, catalog))
  for (const [index, bot] of onDisk.bots.entries()) {
    const role = catalog.roles[index]
    assert.equal(bot.name, role.name)
    assert.equal(bot.role, role.roleLabel)
    assert.equal(bot.color, role.color)
    if (role.localNotes) assert.ok(bot.instructions.includes(role.localNotes), `${bot.name} dropped its local notes`)
  }
})

test('the published roster carries no private path or id', () => {
  const text = readFileSync(P.roster, 'utf8')
  assert.ok(!/\/Users\//.test(text))
  assert.ok(!/personId\s*=\s*[a-z]/i.test(text))
  assert.match(text, /\{\{cwd\}\}/)
})

test('medical roles do not get outbound web search', () => {
  const byId = new Map(catalog.roles.map((role) => [role.presetId, role]))
  assert.equal(byId.get('bot-health-record').tools.web, false)
  assert.equal(byId.get('bot-stroke-consult').tools.web, false)
  for (const role of catalog.roles) {
    if (role.presetId.startsWith('bot-health') || role.presetId.startsWith('bot-stroke')) continue
    assert.equal(role.tools.web, true, `${role.presetId} should have web search`)
  }
})

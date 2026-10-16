// Catalog validation is the gate that keeps a broken role from ever reaching a
// preset file, so each rejection below stands for a failure mode that would
// otherwise surface as a silent mount error in someone else's deployment.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadCatalog, validate } from '../scripts/lib/catalog.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** @returns {Record<string, any>} a role that passes validation, for mutation in tests. */
function role(overrides = {}) {
  return {
    presetId: 'bot-sample',
    name: 'Sample',
    roleLabel: 'SMP',
    color: 'blue',
    order: 100,
    description: 'A sample role.',
    instructions: 'You are the sample role. '.repeat(6).trim(),
    ...overrides,
  }
}

test('the shipped catalog validates', () => {
  const catalog = loadCatalog(ROOT)
  assert.doesNotThrow(() => validate(catalog.roles))
  assert.equal(catalog.roles.length, 13)
})

test('preset ids are namespaced so they cannot collide with a shipped preset', () => {
  for (const entry of loadCatalog(ROOT).roles) {
    assert.match(entry.presetId, /^bot-[a-z0-9-]+$/)
  }
})

test('every shipped role carries the workspace token instead of a real path', () => {
  for (const entry of loadCatalog(ROOT).roles) {
    assert.ok(!entry.instructions.includes('/Users/'), `${entry.name} leaks a path`)
    assert.match(entry.instructions, /\{\{cwd\}\}/, `${entry.name} lost its workspace token`)
  }
})

test('rejects duplicate preset ids, names and orders', () => {
  assert.throws(() => validate([role(), role({ name: 'Other' })]), /duplicate presetId/)
  assert.throws(() => validate([role(), role({ presetId: 'bot-other' })]), /duplicate role name/)
  assert.throws(() => validate([role(), role({ presetId: 'bot-other', name: 'Other' })]), /duplicate order/)
})

test('rejects a preset id that is not namespaced', () => {
  assert.throws(() => validate([role({ presetId: 'engineering' })]), /presetId must match/)
})

test('rejects prose YAML cannot emit as a block scalar', () => {
  assert.throws(() => validate([role({ instructions: `line one\n  indented continuation ${'x'.repeat(60)}` })]), /indented/)
  // The blank-space line must not be the last one, or the leading/trailing check
  // fires first and the assertion would pass for the wrong reason.
  assert.throws(() => validate([role({ instructions: `${'x'.repeat(90)}\nmiddle   \nend of prose` })]), /trailing whitespace/)
  assert.throws(() => validate([role({ instructions: `${'x'.repeat(90)}\n\ttabbed` })]), /tabs/)
})

test('rejects a role that would publish private data', () => {
  assert.throws(() => validate([role({ instructions: `based at /Users/someone/work ${'x'.repeat(70)}` })]), /absolute home path/)
  assert.throws(() => validate([role({ instructions: `the archive default personId = abcd ${'x'.repeat(60)}` })]), /personal id/)
})

test('rejects an empty or trivially short role', () => {
  assert.throws(() => validate([]), /non-empty array/)
  assert.throws(() => validate([role({ instructions: 'too short' })]), /too short/)
  assert.throws(() => validate([role({ description: '' })]), /description is required/)
  assert.throws(() => validate([role({ roleLabel: '  ' })]), /roleLabel is required/)
  assert.throws(() => validate([role({ order: 1.5 })]), /order must be an integer/)
  assert.throws(() => validate([role({ tools: { web: 'yes' } })]), /must be a boolean/)
})

test('the catalog records provenance for every role', () => {
  const catalog = loadCatalog(ROOT)
  for (const entry of catalog.roles) {
    assert.ok(entry.name in catalog.exportedModels, `${entry.name} has no exported model recorded`)
  }
  assert.match(readFileSync(join(ROOT, 'roles', 'roles.json'), 'utf8'), /generatedFrom/)
})

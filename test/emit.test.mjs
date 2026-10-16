// The emitter replaces a YAML serializer so the published package has no
// dependencies. That trade is only safe if its two hard cases are pinned: the
// `!!js` platform gate must stay a scalar (emitted as a mapping it silently
// becomes an object), and block scalars must never be asked to carry indented
// prose (emitted anyway it mis-parses downstream).
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { toYaml } from '../scripts/lib/yaml.mjs'
import { pluginsFor, referencedPackages } from '../scripts/lib/toolsets.mjs'

test('emits a js-tagged scalar, not a mapping', () => {
  const yaml = toYaml([{ insert: [{ id: 'row', name: '@x/y', disabled: { js: "process.platform === 'win32'" } }] }])
  assert.match(yaml, /^\s*disabled: !!js process\.platform === 'win32'$/m)
  assert.ok(!/disabled:\n/.test(yaml), 'disabled must not become a nested mapping')
})

test('emits multi-line prose as a flush-left block scalar', () => {
  // The block body sits at keyColumn + 2: `- prefix:` starts the key at column 4,
  // so the prose lands at column 8.
  const yaml = toYaml([{ insert: [{ prefix: 'line one\n\nline two' }] }])
  assert.match(yaml, /prefix: \|-\n {8}line one\n\n {8}line two\n$/)
})

test('refuses prose it cannot express', () => {
  assert.throws(() => toYaml([{ a: 'x\n  indented' }]), /indented/)
  assert.throws(() => toYaml([{ a: `x\ntrailing ` }]), /trailing whitespace/)
  assert.throws(() => toYaml([{ a: 'x\n\ttab' }]), /tabs/)
  assert.throws(() => toYaml([{ a: '\nleading blank' }]), /start with a blank line/)
  assert.throws(() => toYaml([{ a: 'trailing newline\n' }]), /end with a newline/)
  assert.throws(() => toYaml([{ a: null }]), /null/)
})

test('quotes scalars so no plain scalar can change meaning', () => {
  const yaml = toYaml([{ a: 'true', b: '08:30', c: "it's", d: 12 }])
  assert.match(yaml, /a: 'true'/)
  assert.match(yaml, /b: '08:30'/)
  assert.match(yaml, /c: 'it''s'/)
  assert.match(yaml, /d: 12/)
})

test('nests lists under keys at the right columns', () => {
  const yaml = toYaml([
    { id: 'group', name: 'cordis:group', group: true, isolate: { a: true }, config: [{ id: 'child', name: '@x/y' }] },
  ])
  assert.equal(
    yaml,
    ["- id: 'group'", "  name: 'cordis:group'", '  group: true', '  isolate:', '    a: true', '  config:', "    - id: 'child'", "      name: '@x/y'", ''].join('\n'),
  )
})

test('every role composes persona first and a compaction group last', () => {
  for (const web of [true, false]) {
    const rows = pluginsFor({ instructions: 'x', tools: { web } })
    assert.equal(rows[0].id, 'persona')
    assert.equal(rows[0].config.prefix, 'x')
    assert.equal(rows.at(-1).id, 'compaction')
    assert.deepEqual(rows.at(-1).isolate, { compaction: true, toolResultPruner: true })
    const webRows = rows.filter((row) => row.id === 'tool-web')
    assert.equal(webRows.length, web ? 1 : 0)
  }
})

test('the todo row carries its required field', () => {
  const todo = pluginsFor({ instructions: 'x' }).find((row) => row.id === 'tool-todo')
  assert.deepEqual(todo.config, { allowParallelInProgress: true })
})

test('only shipped @deepseek-ai packages are mounted', () => {
  for (const name of referencedPackages()) {
    assert.ok(name.startsWith('@deepseek-ai/'), `${name} is not a shipped package`)
  }
})

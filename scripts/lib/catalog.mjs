// Shared catalog logic: the one place that knows how a role becomes a preset file.
// `scripts/build.mjs` writes from it; `scripts/check.mjs` and the test suite read
// through it, so "generated file matches the catalog" is a single definition
// rather than two implementations that can disagree.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { pluginsFor } from './toolsets.mjs'
import { toYaml } from './yaml.mjs'

/** Absolute paths this project reads and writes. */
export function paths(root) {
  return {
    root,
    catalog: join(root, 'roles', 'roles.json'),
    presetDir: join(root, 'presets'),
    roster: join(root, 'bots', 'roster.json'),
    manifest: join(root, 'package.json'),
  }
}

/**
 * @param {string} root
 * @returns {Record<string, any>}
 */
export function loadCatalog(root) {
  return JSON.parse(readFileSync(paths(root).catalog, 'utf8'))
}

/**
 * @param {unknown} condition
 * @param {string} what
 */
function assert(condition, what) {
  if (!condition) throw new Error(`catalog invalid: ${what}`)
}

/**
 * Reject a catalog the build could not turn into a working preset. Every check
 * here exists because the corresponding failure is silent in YAML but fatal at
 * mount time (or leaks private paths into a published package).
 * @param {Array<Record<string, any>>} roles
 */
export function validate(roles) {
  assert(Array.isArray(roles) && roles.length > 0, 'roles must be a non-empty array')
  const seenIds = new Set()
  const seenNames = new Set()
  const seenOrders = new Set()
  for (const role of roles) {
    const where = role?.presetId ?? role?.name ?? '(unnamed role)'
    assert(typeof role.presetId === 'string' && /^bot-[a-z0-9-]+$/.test(role.presetId), `${where}: presetId must match ^bot-[a-z0-9-]+$`)
    assert(typeof role.name === 'string' && role.name.trim() !== '', `${where}: name is required`)
    assert(typeof role.roleLabel === 'string' && role.roleLabel.trim() !== '', `${where}: roleLabel is required`)
    assert(typeof role.description === 'string' && role.description.trim() !== '', `${where}: description is required`)
    assert(Number.isInteger(role.order), `${where}: order must be an integer`)
    assert(typeof role.instructions === 'string' && role.instructions.trim().length > 80, `${where}: instructions look too short`)
    assert(!/^\s|\s$/.test(role.instructions), `${where}: instructions must not start or end with whitespace`)
    assert(!role.instructions.includes('\t'), `${where}: instructions must not contain tabs`)
    for (const line of role.instructions.split('\n')) {
      assert(!/^\s/.test(line), `${where}: instruction line is indented ("${line.slice(0, 40)}"); YAML block scalars need flush-left prose`)
      assert(line === line.trimEnd(), `${where}: instruction line has trailing whitespace`)
    }
    assert(!role.instructions.includes('/Users/'), `${where}: instructions leak an absolute home path`)
    assert(!/personId\s*=\s*[a-z]/i.test(role.instructions), `${where}: instructions leak a personal id`)
    assert(role.localNotes === undefined || typeof role.localNotes === 'string', `${where}: localNotes must be a string`)
    assert(role.tools === undefined || (typeof role.tools === 'object' && !Array.isArray(role.tools)), `${where}: tools must be an object`)
    for (const [key, value] of Object.entries(role.tools ?? {})) {
      assert(typeof value === 'boolean', `${where}: tools.${key} must be a boolean`)
    }
    assert(!seenIds.has(role.presetId), `duplicate presetId ${role.presetId}`)
    assert(!seenNames.has(role.name), `duplicate role name ${role.name}`)
    assert(!seenOrders.has(role.order), `duplicate order ${role.order}`)
    seenIds.add(role.presetId)
    seenNames.add(role.name)
    seenOrders.add(role.order)
  }
}

/**
 * The preset patch file for one role, byte-for-byte what the bundle ships.
 * @param {Record<string, any>} role
 * @returns {string}
 */
export function presetFile(role) {
  const entry = {
    insert: [
      {
        id: `preset-${role.presetId}`,
        name: '@deepseek-ai/dsh-agent-preset',
        config: {
          id: role.presetId,
          name: role.name,
          description: role.description,
          order: role.order,
          plugins: pluginsFor(role),
        },
      },
    ],
  }
  const header = [
    `# Bot role preset: ${role.name} (${role.presetId}), from dsh-bot-roles.`,
    '#',
    '# Generated from roles/roles.json by scripts/build.mjs — edit the catalog, not this file.',
    '#',
    '# One `@deepseek-ai/dsh-agent-preset` row is inserted, so installing this bundle adds',
    '# the role to the deployment preset roster; sessions selecting it compose the role',
    '# persona plus the tool baseline declared in scripts/lib/toolsets.mjs.',
    '',
  ].join('\n')
  return header + toYaml([entry])
}

/**
 * The DS Bot import face. DS Bot creates Bots only through its own tools, so this
 * file is an input to the paste-ready prompt rather than something a plugin loads.
 * @param {Array<Record<string, any>>} roles
 * @param {Record<string, any>} catalog
 * @returns {Record<string, unknown>}
 */
export function rosterFile(roles, catalog) {
  return {
    schema: 1,
    note:
      'A DS Bot team roster. DS Bot creates Bots only through its own tools (no plugin can create one), so this file feeds docs/bot-team-prompt.md: paste that prompt into your Main Bot and it creates one Bot per entry. "{{cwd}}" stands for the workspace you want the team to work in.',
    workspaceToken: '{{cwd}}',
    generatedFrom: catalog.generatedFrom,
    bots: roles.map((role) => ({
      name: role.name,
      role: role.roleLabel,
      color: role.color,
      description: role.description,
      instructions: role.localNotes ? `${role.instructions}\n\n${role.localNotes}` : role.instructions,
      exportedModel: catalog.exportedModels?.[role.name] ?? null,
    })),
  }
}

/**
 * The ordered bundle patch list the profile composes, derived from catalog order.
 * @param {Array<Record<string, any>>} roles
 * @returns {string[]}
 */
export function expectedPatches(roles) {
  return roles.map((role) => `./presets/${role.presetId}.patch.yml`)
}

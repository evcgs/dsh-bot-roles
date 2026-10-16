// The tool baseline every role preset mounts.
//
// Why a preset must declare this at all: a preset's `plugins` list IS the
// agent's composition. A preset that mounted only `persona` would hand the model
// an empty tool registry, so a role could not read a file, run a command, or
// report progress. Every row below is a package that ships with dsh base or
// dsh-web-app, so the pack stays installable without extra dependencies.
//
// Row ids match the ids the shipped `standard` preset uses, so a profile patch
// that overrides a row by id (for example to switch `tool-bash` off for one
// role) keeps working.

/** Shared compaction group.
 *
 * `isolate` is not decoration: the host plane already registers the `compaction`
 * and `toolResultPruner` services, so without isolating them here every preset's
 * compaction rows fail activation with "service has been registered at …" and the
 * role loses compaction entirely. The shipped `standard` preset isolates the same
 * two names; mirrored deliberately. */
const COMPACTION = {
  id: 'compaction',
  name: 'cordis:group',
  group: true,
  isolate: { compaction: true, toolResultPruner: true },
  config: [
    { id: 'compaction-basic', name: '@deepseek-ai/dsh-compaction-basic' },
    { id: 'command-compact', name: '@deepseek-ai/dsh-command-compact' },
    {
      id: 'tool-result-pruner',
      name: '@deepseek-ai/dsh-compaction-tool-result-pruner',
      config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 },
    },
  ],
}

/** Goal mode, so a role can carry a multi-step objective across rounds. */
const GOALS = [
  { id: 'command-goal', name: '@deepseek-ai/dsh-command-goal' },
  { id: 'tool-goal', name: '@deepseek-ai/dsh-tool-goal' },
]

/**
 * Rows mounted by every role, in order.
 * @param {string} roleName - the Bot's name, used in the generic persona note.
 * @returns {Array<Record<string, unknown>>} cordis entry rows (persona excluded).
 */
export function baselineRows() {
  return [
    {
      id: 'agent-instructions',
      name: '@deepseek-ai/dsh-agent-instructions',
      config: { maxBytes: 65536 },
    },
    { id: 'time-context', name: '@deepseek-ai/dsh-time-context' },
    { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
    {
      id: 'tool-fs-search',
      name: '@deepseek-ai/dsh-tool-fs-search',
      config: { sampleOverCapGlobResults: false },
    },
    {
      id: 'tool-bash',
      name: '@deepseek-ai/dsh-tool-bash',
      disabled: { js: "process.platform === 'win32'" },
    },
    {
      id: 'tool-pwsh',
      name: '@deepseek-ai/dsh-tool-pwsh',
      disabled: { js: "process.platform !== 'win32'" },
    },
    // `allowParallelInProgress` is a required field of this row's schema: mounting
    // it without a value fails activation outright.
    { id: 'tool-todo', name: '@deepseek-ai/dsh-tool-todo', config: { allowParallelInProgress: true } },
    { id: 'tool-jobs', name: '@deepseek-ai/dsh-tool-jobs' },
    { id: 'tool-ask-user', name: '@deepseek-ai/dsh-tool-ask-user' },
    { id: 'skill-filesystem', name: '@deepseek-ai/dsh-skill-filesystem' },
    { id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill' },
    { id: 'present', name: '@deepseek-ai/dsh-tool-present' },
    ...GOALS,
    COMPACTION,
  ]
}

/** The optional web-search row, mounted only for roles with `tools.web`. */
export const WEB_ROW = {
  id: 'tool-web',
  name: '@deepseek-ai/dsh-tool-web',
  config: { fetch: true, searchTimeoutMs: 60000 },
}

/**
 * Assemble the full `config.plugins` list for one role.
 *
 * Web search is inserted before the compaction group so the row order stays
 * stable across roles and a diff between two presets shows only what differs.
 *
 * @param {{instructions: string, tools?: {web?: boolean}}} role - the catalog entry.
 * @returns {Array<Record<string, unknown>>} rows for `config.plugins`.
 */
export function pluginsFor(role) {
  const rows = baselineRows()
  const persona = {
    id: 'persona',
    name: '@deepseek-ai/dsh-persona',
    config: { prefix: role.instructions },
  }
  if (role.tools?.web === true) {
    const at = rows.findIndex((row) => row.id === 'compaction')
    rows.splice(at, 0, WEB_ROW)
  }
  return [persona, ...rows]
}

/** Every package name this pack can mount, for the resolution check. */
export function referencedPackages() {
  const names = new Set()
  const walk = (row) => {
    if (typeof row.name === 'string' && row.name !== 'cordis:group') names.add(row.name)
    if (Array.isArray(row.config)) row.config.forEach(walk)
  }
  baselineRows().forEach(walk)
  walk(WEB_ROW)
  names.add('@deepseek-ai/dsh-persona')
  names.add('@deepseek-ai/dsh-agent-preset')
  return [...names].sort()
}

#!/usr/bin/env node
// The authoritative gate: boot this pack in a throwaway dsh profile and read the
// preset registry's own activation diagnostics back out.
//
// Why this exists rather than a YAML lint: a preset can be perfectly valid YAML
// and still fail to mount — an unresolvable plugin name, a config field the row's
// schema requires, a service that collides with the host plane. dsh records all of
// those per preset and keeps running, so only reading that record proves anything.
// The two earlier lessons this encodes, both found by running it:
//   * `@deepseek-ai/dsh-tool-todo` requires `allowParallelInProgress`, and mounting
//     it bare fails activation;
//   * the compaction rows need `isolate` or they collide with the host plane.
//
// It also runs a negative control by default: a deliberately broken preset must be
// reported broken, otherwise a green run proves only that the probe is not looking.
//
// Usage:
//   node tools/verify-composition.mjs --dsh-bin <…/@deepseek-ai/dsh/lib/bin.js>
//   node tools/verify-composition.mjs            # auto-detects from $DSH_HOME
//
// Needs a dsh installation, so it is a local/CI-with-dsh step, not part of
// `npm run check`.
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const PACKAGE_NAME = MANIFEST.name
const CATALOG = JSON.parse(readFileSync(join(ROOT, 'roles', 'roles.json'), 'utf8'))

/** Options parsed from argv. */
const argv = process.argv.slice(2)
const arg = (name, fallback = undefined) => {
  const at = argv.indexOf(`--${name}`)
  return at === -1 ? fallback : argv[at + 1]
}
const flag = (name) => argv.includes(`--${name}`)

const WORKDIR = resolve(arg('workdir', join(ROOT, '.verify')))
const KEEP = flag('keep')
const NEGATIVE_CONTROL = !flag('no-negative-control')
const PROFILE = 'pack-verify'

/**
 * Locate the dsh launcher without guessing silently: an explicit flag, then
 * $DSH_BIN, then the copy under $DSH_HOME. A wrong guess here would verify the
 * wrong harness, so a miss is an error rather than a fallback.
 * @returns {string}
 */
function findDshBin() {
  const candidates = []
  const explicit = arg('dsh-bin') ?? process.env.DSH_BIN
  if (explicit) candidates.push(resolve(explicit))
  const home = process.env.DSH_HOME
  if (home) candidates.push(join(home, 'profiles', 'web', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'))
  const found = candidates.find((candidate) => existsSync(candidate))
  if (!found) {
    console.error(
      'cannot find the dsh launcher.\n' +
        'Pass --dsh-bin <path to @deepseek-ai/dsh/lib/bin.js>, or set DSH_BIN or DSH_HOME.\n' +
        `tried:\n${candidates.map((c) => `  ${c}`).join('\n') || '  (nothing — no flag and no DSH_HOME)'}`,
    )
    process.exit(2)
  }
  return found
}

const DSH_BIN = findDshBin()

/** The probe: read the registry's diagnostics after boot, write them out, exit.
 *
 * The service handle is captured during `apply` on purpose — a lazy `ctx.agentPresets`
 * lookup after the app tears its context down fails with "inactive context", which
 * looks exactly like a broken pack. */
const PROBE_SOURCE = `import { writeFileSync } from 'node:fs'
export const name = 'mount-probe'
export const inject = ['agentPresets']
export function apply(ctx) {
  const presets = ctx.agentPresets
  setTimeout(async () => {
    const out = { ok: false }
    try {
      const rows = await presets.list()
      out.ok = true
      out.rows = rows.map((row) => ({ id: row.id, name: row.name ?? null, order: row.order ?? null, broken: row.broken ?? null }))
    } catch (error) {
      out.error = String(error?.message ?? error)
    }
    writeFileSync(process.env.PROBE_OUT, JSON.stringify(out, null, 2))
    process.exit(0)
  }, Number(process.env.PROBE_DELAY_MS ?? 50))
}
`

const REGISTRY_PATCH = `- insert:
    - id: agent-preset-registry
      name: '@deepseek-ai/dsh-agent-preset-registry'
      config:
        default: standard
`

/** A preset that must fail: an unresolvable plugin name. */
const BROKEN_PATCH = `- insert:
    - id: preset-broken-control
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: broken-control
        order: 990
        plugins:
          - id: persona
            name: '@deepseek-ai/dsh-persona'
            config:
              prefix: 'negative control'
          - id: ghost
            name: '@deepseek-ai/dsh-tool-does-not-exist-control'
`

/**
 * Lay out one throwaway profile: base + headless (so a boot can run), the pack under
 * test, and the probe. Both the pack and the probe are symlinked, so the gate reads
 * the working tree rather than a copy that could drift.
 * @param {string} name @param {string[]} extraBundles @param {string} [localPatch]
 * @returns {string} the profile directory
 */
function makeProfile(name, extraBundles, localPatch) {
  const dir = join(WORKDIR, 'profiles', name)
  mkdirSync(join(dir, 'node_modules'), { recursive: true })
  const link = (target, at) => {
    if (existsSync(at)) rmSync(at, { recursive: true, force: true })
    symlinkSync(target, at, 'dir')
  }
  link(ROOT, join(dir, 'node_modules', PACKAGE_NAME))
  link(join(WORKDIR, 'probe'), join(dir, 'node_modules', 'mount-probe'))
  for (const extra of extraBundles) link(join(WORKDIR, extra), join(dir, 'node_modules', extra))
  writeFileSync(
    join(dir, 'package.json'),
    `${JSON.stringify(
      {
        name: `dsh-profile-${name}`,
        private: true,
        dependencies: {
          [PACKAGE_NAME]: `link:${ROOT}`,
          'mount-probe': `link:${join(WORKDIR, 'probe')}`,
          ...Object.fromEntries(extraBundles.map((extra) => [extra, `link:${join(WORKDIR, extra)}`])),
        },
        dsh: {
          profile: {
            bundles: [
              '@deepseek-ai/dsh-base',
              '@deepseek-ai/dsh-headless',
              PACKAGE_NAME,
              ...extraBundles,
              'mount-probe',
            ],
          },
        },
      },
      null,
      2,
    )}\n`,
  )
  writeFileSync(join(dir, 'cordis.patch.yml'), REGISTRY_PATCH + (localPatch ?? ''))
  return dir
}

/**
 * @param {string} profile @param {string[]} args @param {Record<string, string>} env
 * @returns {{status: number, stdout: string, stderr: string}}
 */
function runDsh(profile, args, env = {}) {
  const result = spawnSync(process.execPath, [DSH_BIN, '--profile', profile, ...args], {
    cwd: dirname(DSH_BIN),
    env: { ...process.env, DSH_HOME: WORKDIR, DEEPSEEK_API_KEY: 'probe-dummy-key', ...env },
    encoding: 'utf8',
    timeout: 180_000,
  })
  return { status: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error }
}

const failures = []
const passes = []
const check = (ok, what, detail) => (ok ? passes.push(what) : failures.push(detail ? `${what}\n      ${detail}` : what))

function main() {
  rmSync(WORKDIR, { recursive: true, force: true })
  mkdirSync(join(WORKDIR, 'probe'), { recursive: true })
  writeFileSync(join(WORKDIR, 'probe', 'package.json'), `${JSON.stringify({ name: 'mount-probe', version: '0.0.0', type: 'module', main: 'index.js', dsh: { bundle: { patch: './cordis.patch.yml' } } }, null, 2)}\n`)
  writeFileSync(join(WORKDIR, 'probe', 'index.js'), PROBE_SOURCE)
  writeFileSync(join(WORKDIR, 'probe', 'cordis.patch.yml'), `- insert:\n    - id: mount-probe\n      name: mount-probe\n`)

  makeProfile(PROFILE, [])
  const roles = CATALOG.roles

  // ── 1. composition: the bundle's patch layers reach the composed profile tree ──
  const dump = runDsh(PROFILE, ['--dump-config'])
  check(dump.status === 0, 'dump-config exits 0', dump.stderr.trim().split('\n').slice(0, 4).join('\n      '))
  check(
    !/^dsh: .*patch:/m.test(dump.stderr),
    'dump-config applies every patch without a skipped-match warning',
    dump.stderr.trim().split('\n').slice(0, 6).join('\n      '),
  )
  check(dump.stdout.includes(`# == ${PACKAGE_NAME}`), `dump-config attributes rows to ${PACKAGE_NAME}`)
  for (const role of roles) {
    check(dump.stdout.includes(`- id: preset-${role.presetId}`), `composed tree declares preset-${role.presetId}`)
  }

  // ── 2. mount: the registry reports every preset as usable ──
  const probeOut = join(WORKDIR, 'probe-rows.json')
  const boot = runDsh(PROFILE, ['reply with the single word ok'], { PROBE_OUT: probeOut, PROBE_DELAY_MS: '50' })
  if (!existsSync(probeOut)) {
    check(false, 'probe wrote its report', `boot exit ${boot.status}\n      ${(boot.stdout + boot.stderr).trim().split('\n').slice(0, 6).join('\n      ')}`)
  } else {
    const report = JSON.parse(readFileSync(probeOut, 'utf8'))
    check(report.ok === true, 'agentPresets.list() answered', report.error)
    const rows = report.rows ?? []
    check(rows.length === roles.length, `registry declares ${roles.length} presets`, `got ${rows.length}`)
    const ids = new Set(rows.map((row) => row.id))
    for (const role of roles) check(ids.has(role.presetId), `registry declares ${role.presetId}`)
    const broken = rows.filter((row) => row.broken)
    check(
      broken.length === 0,
      `every one of the ${roles.length} presets mounts clean`,
      broken.map((row) => `${row.id}: ${String(row.broken).split('\n').join(' | ')}`).join('\n      '),
    )
  }

  // ── 3. negative control: the gate must be able to fail ──
  if (NEGATIVE_CONTROL) {
    const badDir = join(WORKDIR, 'broken-control')
    mkdirSync(badDir, { recursive: true })
    writeFileSync(join(badDir, 'package.json'), `${JSON.stringify({ name: 'broken-control', version: '0.0.0', private: true, dsh: { bundle: { patch: './cordis.patch.yml' } } }, null, 2)}\n`)
    writeFileSync(join(badDir, 'cordis.patch.yml'), BROKEN_PATCH)
    makeProfile('pack-verify-control', ['broken-control'])
    const controlOut = join(WORKDIR, 'probe-control.json')
    runDsh('pack-verify-control', ['reply with the single word ok'], { PROBE_OUT: controlOut, PROBE_DELAY_MS: '50' })
    if (!existsSync(controlOut)) {
      check(false, 'negative control produced a report')
    } else {
      const report = JSON.parse(readFileSync(controlOut, 'utf8'))
      const row = (report.rows ?? []).find((entry) => entry.id === 'broken-control')
      check(row !== undefined, 'negative control declares its preset')
      check(
        row?.broken !== undefined && row?.broken !== null,
        'negative control is reported broken (so a green run means something)',
        `broken was ${JSON.stringify(row?.broken)} — the gate cannot see failures`,
      )
    }
  }

  // ── report ──
  console.log(`dsh launcher: ${DSH_BIN}`)
  console.log(`workdir:      ${WORKDIR}${KEEP ? ' (kept)' : ''}\n`)
  for (const line of passes) console.log(`ok   ${line}`)
  if (failures.length > 0) {
    console.error('')
    for (const line of failures) console.error(`FAIL ${line}`)
    console.error(`\nverify-composition failed: ${failures.length} of ${passes.length + failures.length} assertions.`)
    process.exitCode = 1
  } else {
    console.log(`\nverify-composition passed (${passes.length} assertions, including the negative control).`)
  }
  if (!KEEP) rmSync(WORKDIR, { recursive: true, force: true })
}

main()

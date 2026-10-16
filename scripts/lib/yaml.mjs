// A tiny, strict YAML emitter for the one shape this pack writes: a cordis entry
// list. It exists instead of a serializer dependency so the published package has
// zero runtime/dev dependencies, and it validates its input rather than trusting
// it: multiline prose that YAML cannot express as a plain block scalar is a hard
// error here, not a subtly mis-parsed preset downstream.

/**
 * Render one scalar. `{ js } ` becomes the cordis `!!js` tag this repository's
 * shipped presets use for platform gates.
 * @param {unknown} value
 * @returns {string}
 */
function scalar(value) {
  if (value === null || value === undefined) throw new Error('cannot emit null/undefined scalar')
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object' && value !== null && typeof value.js === 'string') {
    if (value.js.includes('\n')) throw new Error('!!js expression must be one line')
    return `!!js ${value.js}`
  }
  if (typeof value !== 'string') throw new Error(`unsupported scalar type: ${typeof value}`)
  if (value.includes('\n')) throw new Error('multiline string reached the scalar path')
  // Single quotes are always valid YAML and need no escaping table beyond ''.
  return `'${value.replaceAll("'", "''")}'`
}

/**
 * Validate a multi-line block-scalar body and return it indented.
 *
 * Two conditions YAML cannot survive without an explicit indentation indicator:
 * a line whose own indentation is non-zero, and a body that starts or ends with a
 * blank line. Both are rejected loudly.
 * @param {string} text
 * @param {number} indent - column the block content starts at.
 * @returns {string[]}
 */
function blockScalarLines(text, indent) {
  if (text.startsWith('\n')) throw new Error('block scalar must not start with a blank line')
  if (text.endsWith('\n')) throw new Error('block scalar must not end with a newline')
  if (text.includes('\t')) throw new Error('block scalar must not contain tabs')
  const pad = ' '.repeat(indent)
  const lines = text.split('\n')
  for (const line of lines) {
    if (line !== line.trimEnd()) throw new Error('block scalar line has trailing whitespace')
    if (line !== '' && /^\s/.test(line)) {
      throw new Error('block scalar line is indented; rewrite the prose flush-left')
    }
  }
  return lines.map((line) => (line === '' ? '' : pad + line))
}

/**
 * True when a value is the `{ js }` marker for the cordis `!!js` scalar tag. It
 * must be tested before the generic object branch: a marked value is a scalar in
 * YAML, and emitting it as a mapping produces a `disabled:` mapping that cordis
 * reads as an object instead of an expression.
 * @param {unknown} value
 * @returns {boolean}
 */
function isJsScalar(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof value.js === 'string'
  )
}

/**
 * Emit `key: value` (or `key:` plus nested block) at a given prefix.
 * @param {string} key
 * @param {unknown} value
 * @param {number} keyColumn - column the key itself starts at.
 * @param {string} prefix - padding plus, for the first key of a list item, `- `.
 * @param {string[]} out
 */
function emitKeyValue(key, value, keyColumn, prefix, out) {
  if (isJsScalar(value)) {
    out.push(`${prefix}${key}: ${scalar(value)}`)
    return
  }
  if (Array.isArray(value)) {
    out.push(`${prefix}${key}:`)
    emitList(value, keyColumn + 2, out)
    return
  }
  if (value !== null && typeof value === 'object') {
    out.push(`${prefix}${key}:`)
    emitMap(value, keyColumn + 2, out)
    return
  }
  if (typeof value === 'string' && value.includes('\n')) {
    out.push(`${prefix}${key}: |-`)
    out.push(...blockScalarLines(value, keyColumn + 2))
    return
  }
  out.push(`${prefix}${key}: ${scalar(value)}`)
}

/**
 * @param {Record<string, unknown>} object
 * @param {number} indent
 * @param {string[]} out
 */
function emitMap(object, indent, out) {
  const pad = ' '.repeat(indent)
  for (const [key, value] of Object.entries(object)) {
    emitKeyValue(key, value, indent, pad, out)
  }
}

/**
 * @param {Array<unknown>} items
 * @param {number} indent
 * @param {string[]} out
 */
function emitList(items, indent, out) {
  const firstPad = `${' '.repeat(indent)}- `
  const restPad = ' '.repeat(indent + 2)
  for (const item of items) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      out.push(`${firstPad}${scalar(item)}`)
      continue
    }
    const entries = Object.entries(item)
    if (entries.length === 0) throw new Error('cannot emit an empty mapping as a list item')
    let first = true
    for (const [key, value] of entries) {
      emitKeyValue(key, value, indent + 2, first ? firstPad : restPad, out)
      first = false
    }
  }
}

/**
 * Render an entry list as a YAML document.
 * @param {Array<Record<string, unknown>>} entries
 * @returns {string} YAML text ending in exactly one newline.
 */
export function toYaml(entries) {
  const out = []
  emitList(entries, 0, out)
  return `${out.join('\n')}\n`
}

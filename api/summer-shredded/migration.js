import fs from 'node:fs'
import { CONTENT_VERSION, SUMMER_SHREDDED_PROGRAMS, SUMMER_SHREDDED_CUSTOM_EXERCISES } from './programs.js'

const legacy = JSON.parse(fs.readFileSync(new URL('./legacy-seed.json', import.meta.url)))
const canonical = { programs: SUMMER_SHREDDED_PROGRAMS, customExercises: SUMMER_SHREDDED_CUSTOM_EXERCISES }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const clone = x => x === undefined ? undefined : structuredClone(x)
const object = x => x && typeof x === 'object' && !Array.isArray(x)

// Three-way reconciliation: only fields still equal to the old seed receive corrections.
// Producer edits, order, additions and deletions survive; ambiguous changes are reported.
export function reconcileSeed(current, before = legacy, after = canonical) {
  const conflicts = []
  function merge(c, b, a, at) {
    if (same(c, b)) return clone(a)
    if (same(a, b) || same(c, a)) return clone(c)
    if (object(c) && object(b) && object(a)) {
      const out = clone(c)
      for (const key of Object.keys(a)) {
        if (!(key in b) && !(key in c)) out[key] = clone(a[key])
        else if (key in c) out[key] = merge(c[key], b[key], a[key], `${at}/${key}`)
      }
      return out
    }
    if (Array.isArray(c) && Array.isArray(b) && Array.isArray(a)) {
      const key = [...c, ...b, ...a].every(x => object(x) && typeof x.id === 'string') ? 'id'
        : [...c, ...b, ...a].every(x => object(x) && typeof x.sourceName === 'string') ? 'sourceName' : null
      if (key && [c, b, a].every(xs => new Set(xs.map(x => x[key])).size === xs.length)) {
        const bs = new Map(b.map(x => [x[key], x])), as = new Map(a.map(x => [x[key], x]))
        return c.map(x => bs.has(x[key]) && as.has(x[key]) ? merge(x, bs.get(x[key]), as.get(x[key]), `${at}/${x[key]}`) : clone(x))
          .concat(a.filter(x => !bs.has(x[key]) && !c.some(y => y[key] === x[key])).map(clone))
      }
    }
    conflicts.push(at)
    return clone(c)
  }
  return { content: merge(current, before, after, ''), conflicts, version: CONTENT_VERSION }
}

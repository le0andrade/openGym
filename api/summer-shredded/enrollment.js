import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

export const productDate = (at = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(at)

export function selectionFor(enrollment, today = productDate()) {
  if (!enrollment) return null
  const days = Math.floor((Date.parse(today + 'T12:00:00Z') - Date.parse(enrollment.startedOn + 'T12:00:00Z')) / 86400000)
  return { ...enrollment, week: Math.max(1, Math.min(12, Math.floor(days / 7) + 1)), completed: days >= 84 }
}

export function createEnrollmentStore(dataDir) {
  const file = uid => path.join(dataDir, 'summer-enrollment-' + createHash('sha256').update(uid).digest('hex') + '.json')
  const read = uid => {
    try { return JSON.parse(fs.readFileSync(file(uid), 'utf8')) }
    catch (e) { if (e.code === 'ENOENT') return null; throw e }
  }
  const enroll = (uid, slug, at = new Date()) => {
    if (!['masculino', 'feminino'].includes(slug)) throw new Error('invalid program')
    const existing = read(uid)
    if (existing) {
      if (existing.programSlug !== slug) throw new Error('program already selected')
      return existing
    }
    const value = { programSlug: slug, startedOn: productDate(at), source: 'onboarding' }
    fs.writeFileSync(file(uid), JSON.stringify(value), { flag: 'wx', mode: 0o600 })
    return value
  }
  const assign = (uid, slug) => {
    if (!['masculino', 'feminino'].includes(slug)) throw new Error('invalid program')
    const existing = read(uid)
    const value = { programSlug: slug, startedOn: existing?.startedOn || productDate(), source: 'kiwify' }
    fs.writeFileSync(file(uid) + '.tmp', JSON.stringify(value), { mode: 0o600 }); fs.renameSync(file(uid) + '.tmp', file(uid))
    return value
  }
  return { read, enroll, assign }
}

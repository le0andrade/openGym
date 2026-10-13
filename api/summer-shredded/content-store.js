import fs from 'node:fs'
import path from 'node:path'
import { reconcileSeed } from './migration.js'
import { createEnrollmentStore, selectionFor } from './enrollment.js'

import {
  SUMMER_SHREDDED_CUSTOM_EXERCISES,
  SUMMER_SHREDDED_PROGRAMS
} from './programs.js'

const SCHEMA = 1
const FILE = 'summer-shredded-content.json'
const EXDB_IDS = new Set(JSON.parse(fs.readFileSync(new URL('./exdb-index.json', import.meta.url), 'utf8')).map(e => e.id))

const clone = value => JSON.parse(JSON.stringify(value))
const now = () => new Date().toISOString()

export function seedContent() {
  const payload = {
    programs: clone(SUMMER_SHREDDED_PROGRAMS),
    customExercises: clone(SUMMER_SHREDDED_CUSTOM_EXERCISES)
  }
  const at = now()
  return {
    schema: SCHEMA,
    revision: 1,
    published: { ...clone(payload), revision: 1, publishedAt: at },
    draft: { ...clone(payload), updatedAt: at, updatedBy: null }
  }
}

function assertString(value, field, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`invalid ${field}`)
}

function validatePrescription(value, field) {
  if (!Array.isArray(value) || value.length !== 12 || value.some(x => typeof x !== 'string' || !x.trim())) {
    throw new Error(`${field} must contain 12 weekly prescriptions`)
  }
}

export function validateProductContent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('content required')
  if (!Array.isArray(value.programs) || !value.programs.length) throw new Error('programs required')
  if (!Array.isArray(value.customExercises)) throw new Error('customExercises required')

  const programIds = new Set()
  for (const [pi, program] of value.programs.entries()) {
    assertString(program.id, `programs[${pi}].id`, 100)
    assertString(program.name, `programs[${pi}].name`, 120)
    if (programIds.has(program.id)) throw new Error('duplicate program id')
    programIds.add(program.id)
    if (program.weeks !== 12) throw new Error(`${program.id} must have 12 weeks`)
    if (!Array.isArray(program.workouts) || !program.workouts.length) throw new Error(`${program.id} workouts required`)

    const workoutIds = new Set()
    for (const [wi, workout] of program.workouts.entries()) {
      assertString(workout.id, `${program.id}.workouts[${wi}].id`, 60)
      assertString(workout.name, `${program.id}.workouts[${wi}].name`, 120)
      if (workoutIds.has(workout.id)) throw new Error(`duplicate workout id in ${program.id}`)
      workoutIds.add(workout.id)
      if (!Array.isArray(workout.exercises)) throw new Error(`${program.id}/${workout.id} exercises required`)
      for (const [ei, exercise] of workout.exercises.entries()) {
        assertString(exercise.sourceName, `${program.id}/${workout.id}.exercises[${ei}].sourceName`, 160)
        assertString(exercise.exerciseId, `${program.id}/${workout.id}.exercises[${ei}].exerciseId`, 100)
        validatePrescription(exercise.prescription, `${program.id}/${workout.id}/${exercise.sourceName}`)
      }
    }

    const abdomen = program.conditioning?.abdomen
    const cardio = program.conditioning?.cardio
    if (!abdomen || !cardio) throw new Error(`${program.id} conditioning required`)
    validatePrescription(abdomen.prescription, `${program.id}.conditioning.abdomen`)
    validatePrescription(cardio.prescription, `${program.id}.conditioning.cardio`)
    if (!Array.isArray(cardio.options) || !cardio.options.length) throw new Error(`${program.id} cardio options required`)
  }

  const customIds = new Set()
  for (const [i, exercise] of value.customExercises.entries()) {
    assertString(exercise.id, `customExercises[${i}].id`, 100)
    assertString(exercise.n, `customExercises[${i}].n`, 160)
    if (customIds.has(exercise.id)) throw new Error('duplicate custom exercise id')
    customIds.add(exercise.id)
    // Custom exercises may gain Forge-owned media later, but never accept the source-plan video links.
    if (exercise.video || exercise.youtube || exercise.instagram) throw new Error('external exercise video links are not supported')
  }

  const serialized = JSON.stringify(value)
  if (/youtube\.com|youtu\.be|instagram\.com/i.test(serialized)) {
    throw new Error('external exercise video links are not supported')
  }

  for (const id of customIds) {
    if (EXDB_IDS.has(id)) throw new Error(`custom exercise shadows EXDB id: ${id}`)
  }
  const validateReference = (exercise, context) => {
    assertString(exercise?.exerciseId, `${context}.exerciseId`, 100)
    const isCustom = customIds.has(exercise.exerciseId)
    if (!isCustom && !EXDB_IDS.has(exercise.exerciseId)) throw new Error(`unknown exercise id: ${exercise.exerciseId}`)
    if (!['exact', 'equivalent', 'custom'].includes(exercise.match)) throw new Error(`invalid match: ${context}`)
    if ((exercise.match === 'custom') !== isCustom) throw new Error(`exercise match/catalogue mismatch: ${context}`)
  }
  for (const program of value.programs) {
    for (const workout of program.workouts) {
      for (const exercise of workout.exercises) validateReference(exercise, `${program.id}/${workout.id}`)
    }
    validateReference(program.conditioning.abdomen, `${program.id}/abdomen`)
    for (const option of program.conditioning.cardio.options) validateReference(option, `${program.id}/cardio`)
  }

  return clone(value)
}

export function createContentStore(dataDir) {
  const file = path.join(dataDir, FILE)

  const write = value => {
    const tmp = file + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 })
    fs.renameSync(tmp, file)
  }

  const read = () => {
    let raw
    try { raw = fs.readFileSync(file, 'utf8') }
    catch (e) {
      if (e.code !== 'ENOENT') throw e
      const seeded = seedContent()
      seeded.catalogueMigration = { version: '2.0.0', seeded: true }
      write(seeded)
      return seeded
    }
    const parsed = JSON.parse(raw)
    if (parsed?.schema !== SCHEMA || !parsed?.published || !parsed?.draft) throw new Error('invalid product content file; restore a backup')
    if (parsed.catalogueMigration?.version === '2.0.0') return parsed
    const report = { version: '2.0.0', at: now(), conflicts: [], blocked: [] }
    for (const layer of ['published', 'draft']) {
      const result = reconcileSeed(parsed[layer])
      report.conflicts.push(...result.conflicts.map(field => `${layer}${field}`))
      try {
        const clean = validateProductContent(result.content)
        if (JSON.stringify(clean) !== JSON.stringify(parsed[layer])) {
          if (layer === 'published') {
            parsed.revision = (Number(parsed.revision) || 0) + 1
            clean.revision = parsed.revision
            clean.publishedAt = report.at
          }
          parsed[layer] = clean
        }
      } catch (e) { report.blocked.push({ layer, error: e.message }) }
    }
    // Preserve the exact original file before applying any reconciliation.
    try { fs.writeFileSync(file + '.pre-v2-backup', raw, { flag: 'wx', mode: 0o600 }) }
    catch (e) { if (e.code !== 'EEXIST') throw e }
    parsed.catalogueMigration = report
    write(parsed)
    return parsed
  }

  const saveDraft = (content, userId) => {
    const clean = validateProductContent(content)
    const state = read()
    state.draft = { ...clean, updatedAt: now(), updatedBy: userId || null }
    write(state)
    return state
  }

  const publish = userId => {
    const state = read()
    const clean = validateProductContent(state.draft)
    const revision = Math.max(0, Number(state.revision) || 0) + 1
    const publishedAt = now()
    state.revision = revision
    state.published = {
      programs: clone(clean.programs),
      customExercises: clone(clean.customExercises),
      revision,
      publishedAt,
      publishedBy: userId || null
    }
    state.draft = {
      programs: clone(clean.programs),
      customExercises: clone(clean.customExercises),
      updatedAt: publishedAt,
      updatedBy: userId || null
    }
    if (state.catalogueMigration) state.catalogueMigration.blocked = []
    write(state)
    return state
  }

  return { file, read, saveDraft, publish }
}

export function summerShreddedRoutes({ dataDir, json, readBody, readSession, requireAdmin, audit }) {
  const store = createContentStore(dataDir)
  const enrollments = createEnrollmentStore(dataDir)

  return {
    'GET /api/summer-shredded/content': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      const state = store.read()
      if (state.catalogueMigration?.blocked?.some(x => x.layer === 'published')) {
        return json(res, 503, { error: 'program content requires producer review' })
      }
      json(res, 200, {
        revision: state.published.revision,
        publishedAt: state.published.publishedAt,
        programs: state.published.programs,
        customExercises: state.published.customExercises,
        selection: selectionFor(enrollments.read(user.id))
      })
    },

    'POST /api/summer-shredded/enrollment': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      const body = await readBody(req)
      try {
        const selection = selectionFor(enrollments.enroll(user.id, body.programSlug))
        json(res, 200, { selection })
      } catch (e) { json(res, e.message === 'program already selected' ? 409 : 400, { error: e.message }) }
    },

    'GET /api/admin/summer-shredded/content': async (req, res) => {
      if (!requireAdmin(req, res)) return
      json(res, 200, store.read())
    },

    'PUT /api/admin/summer-shredded/draft': async (req, res) => {
      const admin = requireAdmin(req, res)
      if (!admin) return
      const body = await readBody(req)
      let state
      try {
        state = store.saveDraft(body.content, admin.id)
      } catch (e) {
        return json(res, 400, { error: e.message || 'invalid content' })
      }
      audit?.(req, 'admin.summer-shredded.draft', { user: admin })
      json(res, 200, { ok: true, draft: state.draft, revision: state.revision })
    },

    'POST /api/admin/summer-shredded/publish': async (req, res) => {
      const admin = requireAdmin(req, res)
      if (!admin) return
      let state
      try {
        state = store.publish(admin.id)
      } catch (e) {
        return json(res, 400, { error: e.message || 'invalid content' })
      }
      audit?.(req, 'admin.summer-shredded.publish', { user: admin, msg: String(state.revision) })
      json(res, 200, {
        ok: true,
        revision: state.published.revision,
        publishedAt: state.published.publishedAt
      })
    }
  }
}

import { useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import { registerProductExercises } from './exercises.js'
import { buildSets } from './history.js'
import { uid, todayISO } from './format.js'
import { nav } from './nav.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

const PROGRAM_KEY = 'summer_shredded_dev_program'
const WEEK_KEY = 'summer_shredded_dev_week'

let cached = null
let pending = null

const clone = value => JSON.parse(JSON.stringify(value))

export function clearSummerContentCache() {
  cached = null
  pending = null
}

export async function loadSummerContent({ force = false } = {}) {
  if (!force && cached) return cached
  if (!force && pending) return pending
  pending = api('/api/summer-shredded/content')
    .then(data => {
      cached = data
      registerProductExercises(data.customExercises || [])
      return data
    })
    .finally(() => { pending = null })
  return pending
}

export function useSummerContent() {
  const [state, setState] = useState(() => ({ data: cached, loading: !cached, error: null }))

  useEffect(() => {
    let live = true
    loadSummerContent()
      .then(data => { if (live) setState({ data, loading: false, error: null }) })
      .catch(error => { if (live) setState({ data: null, loading: false, error }) })
    return () => { live = false }
  }, [])

  return state
}

// Temporary development selector until Kiwify entitlement supplies the assigned program.
// It is intentionally exposed only to admin UI. Ordinary students always receive the default.
export function selectedProgramSlug(user) {
  if (!user?.admin) return 'masculino'
  try {
    const v = localStorage.getItem(PROGRAM_KEY)
    return v === 'feminino' ? 'feminino' : 'masculino'
  } catch {
    return 'masculino'
  }
}

export function setSelectedProgramSlug(slug) {
  try { localStorage.setItem(PROGRAM_KEY, slug === 'feminino' ? 'feminino' : 'masculino') } catch {}
}

export function selectedProgramWeek(user) {
  if (!user?.admin) return 1
  try {
    const n = Number(localStorage.getItem(WEEK_KEY) || 1)
    return Number.isInteger(n) && n >= 1 && n <= 12 ? n : 1
  } catch {
    return 1
  }
}

export function setSelectedProgramWeek(week) {
  const n = Math.max(1, Math.min(12, Math.round(Number(week) || 1)))
  try { localStorage.setItem(WEEK_KEY, String(n)) } catch {}
}

export function useSummerSelection(content, user) {
  const [slug, setSlugState] = useState(() => selectedProgramSlug(user))
  const [week, setWeekState] = useState(() => selectedProgramWeek(user))

  const program = useMemo(
    () => content?.programs?.find(p => p.slug === slug) || content?.programs?.[0] || null,
    [content, slug]
  )

  const setSlug = next => {
    const value = next === 'feminino' ? 'feminino' : 'masculino'
    if (user?.admin) setSelectedProgramSlug(value)
    setSlugState(value)
  }

  const setWeek = next => {
    const value = Math.max(1, Math.min(12, Math.round(Number(next) || 1)))
    if (user?.admin) setSelectedProgramWeek(value)
    setWeekState(value)
  }

  return { program, slug, week, setSlug, setWeek }
}

export function parseSummerPrescription(text) {
  const raw = String(text || '').trim()
  const reps = /^(\d+)x(\d+)(?:a(\d+))?/i.exec(raw)
  if (reps) {
    const sets = Number(reps[1])
    const low = Number(reps[2])
    const high = Number(reps[3] || reps[2])
    return {
      mode: 'reps',
      sets,
      repsMin: Math.min(low, high),
      reps: Math.max(low, high),
      range: !!reps[3],
      raw
    }
  }

  const minutes = /^(\d+)\s*min/i.exec(raw)
  if (minutes) return { mode: 'cardio', sets: 1, min: Number(minutes[1]), raw }
  return null
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export function summerExerciseConfig(slot, week) {
  const parsed = parseSummerPrescription(slot?.prescription?.[Number(week) - 1])
  if (!parsed) return null

  if (parsed.mode === 'cardio') {
    return {
      id: slot.exerciseId,
      sets: 1,
      min: parsed.min,
      speed: 0,
      mode: 'cardio',
      prog: 'off'
    }
  }

  return {
    id: slot.exerciseId,
    sets: parsed.sets,
    reps: parsed.reps,
    ...(parsed.range ? { repsMin: parsed.repsMin } : {}),
    weight: 0,
    mode: 'reps',
    // The producer owns the 12-week prescription. openGym's automatic load policy must not
    // change that prescription underneath it; students still log/raise their loads manually.
    prog: 'off'
  }
}

export function buildSummerWorkoutEntries(state, workout, week) {
  return (workout?.exercises || []).map(slot => {
    const cfg = summerExerciseConfig(slot, week)
    if (!cfg) return null

    const parsed = parseSummerPrescription(slot.prescription?.[Number(week) - 1])
    let sets = buildSets(state, cfg)

    // buildSets deliberately remembers last session's reps. Summer Shredded has a producer-owned
    // week range, so keep that useful carry-over only while it is inside this week's bounds.
    if (parsed?.mode === 'reps') {
      sets = sets.map(row => {
        if (row.phase === 'warmup') return row
        const wanted = parsed.range
          ? clamp(Number(row.r) || parsed.repsMin, parsed.repsMin, parsed.reps)
          : parsed.reps
        return { ...row, r: wanted }
      })
    }

    return {
      id: cfg.id,
      target: { ...cfg },
      plan: { policy: 'off', kind: 'off' },
      sets,
      displayName: slot.sourceName,
      sourcePrescription: slot.prescription?.[Number(week) - 1] || null,
      producerNote: slot.note || null,
      producerTechnique: slot.technique || null,
      locked: true
    }
  }).filter(Boolean)
}

export function beginSummerWorkout(program, workout, week, bw = null) {
  if (!program || !workout) return
  const { S, update } = useStore.getState()
  const entries = buildSummerWorkoutEntries(S, workout, week)

  update(s => {
    s.active = {
      id: uid(),
      d: todayISO(),
      start: Date.now(),
      routineIds: [],
      name: workout.name,
      bw: bw || null,
      cur: 0,
      entries,
      workoutView: s.workoutView || 'cards',
      product: 'summer-shredded',
      programId: program.id,
      programSlug: program.slug,
      programWeek: Number(week),
      programWorkoutId: workout.id,
      lockedProgram: true
    }
  })
  useUI.getState().stopRest()
  nav('/workout')
}

export function startSummerWorkout(program, workout, week) {
  if (!program || !workout) return
  const S = useStore.getState().S
  // Keep the existing optional weigh-in flow out of the product adapter for now: the workout
  // starts immediately, while body weight remains loggable from Home/Stats. This avoids routing
  // a prescribed program through the generic routine picker.
  beginSummerWorkout(program, workout, week, S.weighIn === false ? null : null)
}

export function programFor(content, slug) {
  return content?.programs?.find(p => p.slug === slug) || null
}

export function copySummerContent(content) {
  return clone(content)
}

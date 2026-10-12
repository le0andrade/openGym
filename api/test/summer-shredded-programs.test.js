import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ABS_12_WEEK,
  CARDIO_12_WEEK,
  STANDARD_12_WEEK,
  SUMMER_SHREDDED_CUSTOM_EXERCISES,
  SUMMER_SHREDDED_PROGRAMS,
  prescriptionForWeek
} from '../summer-shredded/programs.js'

test('Summer Shredded seeds exactly the male and female 12-week programs', () => {
  assert.deepEqual(
    SUMMER_SHREDDED_PROGRAMS.map(p => p.slug),
    ['masculino', 'feminino']
  )

  for (const program of SUMMER_SHREDDED_PROGRAMS) {
    assert.equal(program.weeks, 12)
    assert.deepEqual(program.workouts.map(w => w.id), ['A', 'B', 'C', 'D', 'E'])

    for (const workout of program.workouts) {
      assert.ok(workout.exercises.length > 0)
      for (const exercise of workout.exercises) {
        assert.equal(exercise.prescription.length, 12, `${program.slug}/${workout.id}/${exercise.sourceName}`)
        assert.ok(exercise.exerciseId)
        assert.ok(['exact', 'equivalent', 'custom'].includes(exercise.match))
      }
    }

    assert.equal(program.conditioning.abdomen.prescription.length, 12)
    assert.equal(program.conditioning.cardio.prescription.length, 12)
    assert.equal(program.conditioning.cardio.options.length, 3)
  }
})

test('canonical prescription tables all cover twelve weeks', () => {
  assert.equal(STANDARD_12_WEEK.length, 12)
  assert.equal(ABS_12_WEEK.length, 12)
  assert.equal(CARDIO_12_WEEK.length, 12)
})

test('source video links are not shipped in canonical program content', () => {
  const payload = JSON.stringify(SUMMER_SHREDDED_PROGRAMS)
  assert.equal(payload.includes('youtube.com'), false)
  assert.equal(payload.includes('youtu.be'), false)
  assert.equal(payload.includes('instagram.com'), false)
})

test('Summer Shredded-owned exercises start without media', () => {
  assert.ok(SUMMER_SHREDDED_CUSTOM_EXERCISES.length > 0)
  for (const exercise of SUMMER_SHREDDED_CUSTOM_EXERCISES) {
    assert.equal(exercise.img, null)
    assert.equal(exercise.gif, null)
    assert.equal(exercise.needsReview, true)
  }
})

test('custom ids referenced by programs are declared in the global custom catalogue', () => {
  const declared = new Set(SUMMER_SHREDDED_CUSTOM_EXERCISES.map(e => e.id))
  const referenced = SUMMER_SHREDDED_PROGRAMS
    .flatMap(p => p.workouts)
    .flatMap(w => w.exercises)
    .filter(e => e.match === 'custom')
    .map(e => e.exerciseId)

  assert.deepEqual([...new Set(referenced)].sort(), [...declared].sort())
})

test('prescriptionForWeek is one-based and rejects invalid weeks', () => {
  const first = SUMMER_SHREDDED_PROGRAMS[0].workouts[0].exercises[0]
  assert.equal(prescriptionForWeek(first, 1), '2x10a15')
  assert.equal(prescriptionForWeek(first, 12), '2x5a9')
  assert.equal(prescriptionForWeek(first, 0), null)
  assert.equal(prescriptionForWeek(first, 13), null)
})

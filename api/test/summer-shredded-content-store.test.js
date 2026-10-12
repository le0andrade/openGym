import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  createContentStore,
  seedContent,
  validateProductContent
} from '../summer-shredded/content-store.js'

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'summer-shredded-'))

test('content store seeds published and draft content separately', () => {
  const dir = tempDir()
  try {
    const store = createContentStore(dir)
    const state = store.read()

    assert.equal(state.schema, 1)
    assert.equal(state.revision, 1)
    assert.equal(state.published.programs.length, 2)
    assert.equal(state.draft.programs.length, 2)
    assert.equal(state.published.programs[0].slug, 'masculino')
    assert.equal(state.published.programs[1].slug, 'feminino')
    assert.notStrictEqual(state.published.programs, state.draft.programs)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('draft changes do not affect students until publish', () => {
  const dir = tempDir()
  try {
    const store = createContentStore(dir)
    const initial = store.read()
    const edited = {
      programs: structuredClone(initial.draft.programs),
      customExercises: structuredClone(initial.draft.customExercises)
    }
    edited.programs[0].workouts[0].name = 'Treino A atualizado'

    const drafted = store.saveDraft(edited, 'producer')
    assert.equal(drafted.draft.programs[0].workouts[0].name, 'Treino A atualizado')
    assert.equal(drafted.published.programs[0].workouts[0].name, 'Treino A')

    const published = store.publish('producer')
    assert.equal(published.revision, 2)
    assert.equal(published.published.revision, 2)
    assert.equal(published.published.programs[0].workouts[0].name, 'Treino A atualizado')
    assert.equal(published.published.publishedBy, 'producer')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('content validation rejects external source-plan video links', () => {
  const state = seedContent()
  const content = {
    programs: structuredClone(state.draft.programs),
    customExercises: structuredClone(state.draft.customExercises)
  }
  content.programs[0].workouts[0].exercises[0].note = 'https://youtube.com/example'

  assert.throws(
    () => validateProductContent(content),
    /external exercise video links are not supported/
  )
})

test('content validation requires twelve prescriptions per exercise', () => {
  const state = seedContent()
  const content = {
    programs: structuredClone(state.draft.programs),
    customExercises: structuredClone(state.draft.customExercises)
  }
  content.programs[0].workouts[0].exercises[0].prescription = ['2x10']

  assert.throws(
    () => validateProductContent(content),
    /12 weekly prescriptions/
  )
})

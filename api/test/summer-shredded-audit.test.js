import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { EXDB } from '../../frontend/src/lib/exercises-data.js'
import { SUMMER_SHREDDED_PROGRAMS as programs, SUMMER_SHREDDED_CUSTOM_EXERCISES as custom } from '../summer-shredded/programs.js'
import { seedContent, validateProductContent } from '../summer-shredded/content-store.js'
const norm = s => s.replace(/\s/g, '')
const source = slug => JSON.parse(fs.readFileSync(new URL(`../summer-shredded/source/${slug}.json`, import.meta.url)))

test('all 828 weekly cells, row names/order and inline notes match independent PDF extraction', () => {
  let cells=0
  for(const p of programs){
    const evidence=source(p.slug)
    assert.equal(p.source.sha256,evidence.sha256)
    const slots=[...p.workouts.flatMap(w=>w.exercises.map(e=>({section:w.id,...e}))),{section:'ABDOMÊN',...p.conditioning.abdomen},{section:'Cardio',...p.conditioning.cardio}]
    assert.equal(slots.length,evidence.rows.length)
    slots.forEach((e,i)=>{
      const row=evidence.rows[i]
      assert.equal(e.section,row.section)
      assert.equal(e.sourceName,row.sourceName)
      assert.deepEqual(e.prescription.map(norm),row.prescription.map(norm),`${p.slug}/${e.sourceName}`)
      assert.equal(e.note||e.intensity||'',row.note)
      cells+=row.prescription.length
    })
    assert.deepEqual(p.legend,evidence.legend)
    assert.equal(p.notes.length,4)
    assert.match(p.notes[0],/90.*300/)
    const prose = s => s.replace(/Dicas e Considerações/g, '').replace(/[\s.]/g, '')
    assert.equal(prose(p.notes.join(' ')), prose(evidence.generalNotes))
  }
  assert.equal(cells,828)
})

test('producer techniques retain their timing and placement',()=>{
  const slots=programs.flatMap(p=>p.workouts.flatMap(w=>w.exercises))
  assert.deepEqual(slots.filter(e=>e.technique==='rest-pause').map(e=>[e.sourceName,e.note]),[
    ['Cadeira extensora c/Rest Pause','Rest pause de 10 segundos'],
    ['Frog pumps c/rest pause','Rest pause de 10 segundos']
  ])
  assert.deepEqual(slots.filter(e=>e.technique==='dead-stop').map(e=>e.note),['Usar limitador'])
  assert.equal(slots.find(e=>e.sourceName==='Cross Over').note,'Pico de contração 2"')
})

test('versioned EXDB index stays identical to shipped catalogue',()=>{
  const index=JSON.parse(fs.readFileSync(new URL('../summer-shredded/exdb-index.json',import.meta.url)))
  assert.deepEqual(index,EXDB.map(({id,n})=>({id,n})))
})

test('every mapping including conditioning resolves and has review evidence',()=>{
  const exdb=new Map(EXDB.map(e=>[e.id,e]));const own=new Map(custom.map(e=>[e.id,e]))
  for(const p of programs)for(const e of [...p.workouts.flatMap(w=>w.exercises),p.conditioning.abdomen,...p.conditioning.cardio.options]){
    assert.ok(e.mappingReview.reason)
    assert.equal(e.mappingReview.status,'pending-producer-review')
    if(e.match==='custom'){
      assert.ok(own.has(e.exerciseId));assert.equal(own.get(e.exerciseId).img,null);assert.equal(own.get(e.exerciseId).gif,null)
    }else{
      assert.ok(exdb.has(e.exerciseId),e.exerciseId)
      assert.equal(e.openGymName,exdb.get(e.exerciseId).n)
      assert.ok(exdb.get(e.exerciseId).img);assert.ok(exdb.get(e.exerciseId).gif)
    }
  }
  assert.doesNotThrow(()=>validateProductContent(seedContent().draft))
})

for(const area of ['workout','abdomen','cardio'])test(`reject dangling ${area} references`,()=>{
  const data=seedContent().draft,p=data.programs[0]
  const e=area==='workout'?p.workouts[0].exercises[0]:area==='abdomen'?p.conditioning.abdomen:p.conditioning.cardio.options[0]
  e.exerciseId='missing-id';assert.throws(()=>validateProductContent(data),/unknown exercise id/)
})
test('reject missing custom declarations, mismatched classifications and EXDB collisions',()=>{
 const missing=seedContent().draft;missing.customExercises=[];assert.throws(()=>validateProductContent(missing),/unknown exercise id/)
 const mismatch=seedContent().draft;mismatch.programs[0].workouts[0].exercises[0].match='custom';assert.throws(()=>validateProductContent(mismatch),/mismatch/)
 const collision=seedContent().draft;collision.customExercises[0].id=EXDB[0].id;assert.throws(()=>validateProductContent(collision),/shadows/)
})
test('source fixtures do not contain video URLs or licensee personal details',()=>{
 const text=JSON.stringify(programs)+JSON.stringify(custom)+JSON.stringify(source('masculino'))+JSON.stringify(source('feminino'))
 assert.doesNotMatch(text,/https?:|youtube|instagram|hotmail|Licensed to/i)
})

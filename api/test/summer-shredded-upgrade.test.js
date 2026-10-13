import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createContentStore, summerShreddedRoutes } from '../summer-shredded/content-store.js'
import { reconcileSeed } from '../summer-shredded/migration.js'
import { createEnrollmentStore, selectionFor, productDate } from '../summer-shredded/enrollment.js'
const legacy=JSON.parse(fs.readFileSync(new URL('../summer-shredded/legacy-seed.json',import.meta.url)))
const withDir=fn=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'summer-upgrade-'));try{return fn(dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('three-way upgrade preserves producer notes, ordering, removals and added exercises',()=>{
 const old=structuredClone(legacy)
 const exercises=old.programs[0].workouts[0].exercises
 exercises[0].note='Assento 4';exercises.reverse();exercises.splice(1,1)
 exercises.push({...structuredClone(exercises[0]),sourceName:'Exercício do produtor',exerciseId:'0043',match:'equivalent'})
 const result=reconcileSeed(old).content
 assert.deepEqual(result.programs[0].workouts[0].exercises.map(x=>x.sourceName),exercises.map(x=>x.sourceName))
 assert.equal(result.programs[0].workouts[0].exercises.find(x=>x.sourceName==='Crucifixo Máquina').note,'Assento 4')
 assert.equal(result.programs[0].workouts[1].exercises[0].exerciseId,'0150')
})
test('upgrade backs up original bytes, fixes both layers once and leaves unrelated history untouched',()=>withDir(dir=>{
 const state={schema:1,revision:4,published:{...structuredClone(legacy),revision:4},draft:structuredClone(legacy)}
 state.draft.programs[0].workouts[0].name='Treino personalizado pelo produtor'
 const file=path.join(dir,'summer-shredded-content.json'),raw=JSON.stringify(state)
 fs.writeFileSync(file,raw);fs.writeFileSync(path.join(dir,'state-student.json'),'historical-record')
 const store=createContentStore(dir),out=store.read()
 assert.equal(out.revision,5);assert.equal(out.draft.programs[0].workouts[0].name,'Treino personalizado pelo produtor')
 assert.equal(out.published.programs[0].workouts[1].exercises[0].exerciseId,'0150')
 assert.equal(fs.readFileSync(file+'.pre-v2-backup','utf8'),raw)
 assert.equal(fs.readFileSync(path.join(dir,'state-student.json'),'utf8'),'historical-record')
 assert.deepEqual(store.read(),out)
}))
test('invalid producer mapping is preserved and migration reports a blocked layer',()=>withDir(dir=>{
 const edited=structuredClone(legacy);edited.programs[0].workouts[1].exercises[0].exerciseId='producer-missing'
 const raw={schema:1,revision:1,published:edited,draft:structuredClone(legacy)}
 fs.writeFileSync(path.join(dir,'summer-shredded-content.json'),JSON.stringify(raw))
 const out=createContentStore(dir).read()
 assert.equal(out.published.programs[0].workouts[1].exercises[0].exerciseId,'producer-missing')
 assert.equal(out.catalogueMigration.blocked[0].layer,'published')
 assert.ok(out.catalogueMigration.conflicts.length)
}))
test('corrupt saved content is never replaced by a fresh seed',()=>withDir(dir=>{
 const file=path.join(dir,'summer-shredded-content.json');fs.writeFileSync(file,'{corrupt')
 assert.throws(()=>createContentStore(dir).read());assert.equal(fs.readFileSync(file,'utf8'),'{corrupt')
}))
test('week advances by São Paulo calendar days and clamps to weeks 1 through 12',()=>{
 const e={programSlug:'feminino',startedOn:'2026-10-13'}
 for(const [date,week] of [['2026-10-12',1],['2026-10-19',1],['2026-10-20',2],['2026-12-29',12],['2027-01-05',12]])assert.equal(selectionFor(e,date).week,week)
 assert.equal(selectionFor(e,'2027-01-05').completed,true)
 assert.equal(productDate(new Date('2026-10-14T01:00:00Z')),'2026-10-13')
})
test('enrollment persists across devices and cannot be restarted or switched by student',()=>withDir(dir=>{
 const store=createEnrollmentStore(dir);const enrolled=store.enroll('student','feminino',new Date('2026-10-13T12:00Z'))
 assert.deepEqual(createEnrollmentStore(dir).read('student'),enrolled)
 assert.deepEqual(store.enroll('student','feminino',new Date('2026-11-01T12:00Z')),enrolled)
 assert.throws(()=>store.enroll('student','masculino'),/already selected/)
 assert.throws(()=>store.enroll('other','other'),/invalid program/)
 assert.equal(store.read('other'),null)
}))
test('content/enrollment routes require login and never accept client supplied week/start date',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'summer-route-'))
 try{
 let user=null,body={programSlug:'feminino',week:12,startedOn:'2020-01-01'},result
 const routes=summerShreddedRoutes({dataDir:dir,json:(r,status,data)=>{result={status,data}},readSession:()=>user,readBody:async()=>body,requireAdmin:()=>null})
 await routes['POST /api/summer-shredded/enrollment']({},{});assert.equal(result.status,401)
 await routes['GET /api/summer-shredded/content']({},{});assert.equal(result.status,401)
 user={id:'student'}
 await routes['POST /api/summer-shredded/enrollment']({},{});assert.equal(result.data.selection.week,1);assert.equal(result.data.selection.startedOn,productDate())
 await routes['GET /api/summer-shredded/content']({},{});assert.equal(result.data.selection.programSlug,'feminino')
 body={programSlug:'masculino'};await routes['POST /api/summer-shredded/enrollment']({},{});assert.equal(result.status,409)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('valid producer publication clears a blocked migration without deleting its backup',()=>withDir(dir=>{
 const edited=structuredClone(legacy);edited.programs[0].workouts[1].exercises[0].exerciseId='producer-missing'
 const file=path.join(dir,'summer-shredded-content.json');fs.writeFileSync(file,JSON.stringify({schema:1,revision:1,published:edited,draft:structuredClone(legacy)}))
 const store=createContentStore(dir);assert.ok(store.read().catalogueMigration.blocked.length)
 const valid=reconcileSeed(legacy).content;store.saveDraft(valid,'producer');const result=store.publish('producer')
 assert.deepEqual(result.catalogueMigration.blocked,[]);assert.ok(fs.existsSync(file+'.pre-v2-backup'))
}))

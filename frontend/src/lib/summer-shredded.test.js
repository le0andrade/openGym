// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SUMMER_SHREDDED_PROGRAMS as programs } from '../../../api/summer-shredded/programs.js'
import { buildCompletedWorkout } from './finish-workout.js'
const mocks=vi.hoisted(()=>({store:{user:{id:'student'},S:null,update:null},nav:vi.fn()}))
vi.mock('../store/useStore.js',()=>{const useStore=s=>s(mocks.store);useStore.getState=()=>mocks.store;return {useStore}})
vi.mock('../store/useUI.js',()=>({useUI:{getState:()=>({stopRest:vi.fn()})}}))
vi.mock('./api.js',()=>({api:vi.fn()}))
vi.mock('./nav.js',()=>({nav:mocks.nav}))
import { buildSummerWorkoutEntries, beginSummerWorkout, conditioningWorkout } from './summer-shredded.js'
import { canMoveActiveWorkoutUnit, moveActiveWorkoutUnit } from './active-workout-order.js'

beforeEach(()=>{
 mocks.store.S={unit:'kg',restSec:60,exWeights:{},workouts:[],active:null,workoutView:'compact'}
 mocks.store.update=fn=>fn(mocks.store.S)
})
describe('prescribed student session',()=>{
 it('keeps new-week ranges while carrying previously logged loads',()=>{
  const slot=programs[0].workouts[0].exercises[0]
  mocks.store.S.workouts=[{d:'2026-10-01',entries:[{id:slot.exerciseId,sets:[{w:50,r:15,done:true}]}]}]
  const [e]=buildSummerWorkoutEntries(mocks.store.S,{exercises:[slot]},4)
  expect(e.sets).toHaveLength(2);expect(e.sets[0].w).toBe(50);expect(e.sets[0].r).toBe(7)
  expect(e.target.restSec).toBe(90);expect(e.displayName).toBe(slot.sourceName)
 })
 it('cardio takes this week duration instead of previous session duration',()=>{
  const workout=conditioningWorkout(programs[0],'cardio',1),id=workout.exercises[0].exerciseId
  mocks.store.S.workouts=[{entries:[{id,sets:[{min:60,speed:3,done:true}]}]}]
  expect(buildSummerWorkoutEntries(mocks.store.S,workout,12)[0].sets[0].min).toBe(40)
 })
 it('preserves special rest-pause rows and their prescribed ten-second pause',()=>{
  const slots=programs[1].workouts[0].exercises.filter(e=>e.technique==='rest-pause')
  const [e]=buildSummerWorkoutEntries(mocks.store.S,{exercises:slots},8)
  expect(e.sets).toHaveLength(2);expect(e.sets.map(x=>x.r)).toEqual([40,40]);expect(e.target.intensifier.restSec).toBe(10)
 })
 it('begin -> log -> finish retains product context, notes and names without editing source/history',()=>{
  const before=JSON.stringify(programs),old={id:'old',entries:[]};mocks.store.S.workouts=[old]
  const p=programs[0],w=p.workouts[0]
  beginSummerWorkout(p,w,3)
  const active=mocks.store.S.active
  active.entries[3].sets[0]={w:60,r:8,done:true}
  const completed=buildCompletedWorkout(active,{end:Date.now()})
  expect(completed.programWeek).toBe(3);expect(completed.programWorkoutId).toBe('A');expect(completed.product).toBe('summer-shredded')
  expect(completed.entries[0].displayName).toBe('Supino Reto Smith (DEAD STOP)');expect(completed.entries[0].producerNote).toBe('Usar limitador')
  expect(completed.entries[0].sourcePrescription).toBe('2x5a9');expect(completed.entries[0].sets[0].w).toBe(60)
  expect(JSON.stringify(programs)).toBe(before);expect(mocks.store.S.workouts[0]).toBe(old)
  expect(canMoveActiveWorkoutUnit(active,0,1)).toBe(false);expect(moveActiveWorkoutUnit(active,0,1)).toBe(null)
 })
 it('does not overwrite an unfinished session or start an invalid week',()=>{
  beginSummerWorkout(programs[0],programs[0].workouts[0],0);expect(mocks.store.S.active).toBe(null)
  beginSummerWorkout(programs[0],programs[0].workouts[0],1);const active=mocks.store.S.active
  beginSummerWorkout(programs[1],programs[1].workouts[0],4);expect(mocks.store.S.active).toBe(active)
 })
})

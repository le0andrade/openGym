import { describe, expect, it } from 'vitest'
import { FOODS, FOOD_BY_ID, energyEstimate, nutritionTarget, foodNutrition, nutritionTotals, substituteQuantity, programDay } from './summer-nutrition.js'
const woman={sex:'female',weight:79,height:167,age:21,activity:'moderate'}
describe('source nutrition calculations',()=>{
 it('uses source coefficients without rounding the intermediate TMB',()=>{
 const estimate=energyEstimate(woman);expect(estimate.tmb).toBeCloseTo(1621.321,3);expect(estimate.get).toBeCloseTo(1913.15878,4)
 expect(nutritionTarget(woman,1,0,null).target).toBeCloseTo(estimate.get)
 expect(nutritionTarget(woman,2,0,null).target).toBeCloseTo(estimate.get-200)
 })
 it('reproduces male coefficients and sex-specific activity factors',()=>{
 const male=energyEstimate({sex:'male',weight:80,height:180,age:30,activity:'intense'})
 expect(male.tmb).toBeCloseTo(66.47+13.75*80+5.003*180-6.775*30);expect(male.factor).toBe(1.22)
 expect(energyEstimate({...woman,age:''})).toBe(null)
 })
 it('requires week-7 recalculation and keeps undocumented late-week days unavailable',()=>{
 expect(nutritionTarget(woman,7,0,null).reason).toBe('recalculate')
 expect(nutritionTarget(woman,7,0,75).target).toBeCloseTo(energyEstimate(woman,75).get-200)
 expect(nutritionTarget(woman,5,3,null).target).toBeCloseTo(energyEstimate(woman).get+100)
 expect(nutritionTarget(woman,10,4,75).reason).toBe('producer-day-pending')
 expect(nutritionTarget(woman,12,6,75).target).toBe(null)
 })
 it('preserves per-gram and per-unit source measures and both protein columns',()=>{
 const rice=foodNutrition(FOOD_BY_ID['food-4'],100),egg=foodNutrition(FOOD_BY_ID['food-56'],2)
 expect(rice.carbs).toBeCloseTo(28.05985,5);expect(rice.proteinPlant).toBeCloseTo(2.52081666,5)
 expect(egg.proteinAnimal).toBeCloseTo(12.8);expect(egg.fat).toBeCloseTo(11.5)
 expect(egg.kcal).toBeCloseTo((12.8+1.12)*4+11.5*9)
 })
 it('does not disguise missing source nutrition as a complete zero total',()=>{
 const unknown=FOODS.find(f=>f.nutritionUnknown)
 expect(foodNutrition(unknown,100)).toBe(null)
 const total=nutritionTotals([{foodId:unknown.id,quantity:100},{foodId:'food-56',quantity:1}])
 expect(total.unknown).toBe(1);expect(total.protein).toBeCloseTo(6.4)
 expect(FOODS).toHaveLength(93);expect(new Set(FOODS.map(f=>f.id)).size).toBe(93)
 })
 it('substitutes using the chosen nutrient and refuses missing/zero bases',()=>{
 const a=FOOD_BY_ID['food-4'],b=FOOD_BY_ID['food-5']
 const quantity=substituteQuantity(a,b,100,'carbs')
 expect(foodNutrition(b,quantity).carbs).toBeCloseTo(foodNutrition(a,100).carbs,2)
 expect(substituteQuantity(a,FOODS.find(f=>f.nutritionUnknown),100)).toBe(null)
 expect(substituteQuantity(a,b,100,'invalid')).toBe(null)
 })
 it('uses day within the program week, anchored to the enrollment date',()=>{
 expect(programDay('2026-10-13','2026-10-13')).toBe(0);expect(programDay('2026-10-13','2026-10-16')).toBe(3);expect(programDay('2026-10-13','2026-10-20')).toBe(0)
 })
})

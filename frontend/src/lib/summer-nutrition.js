import source from './summer-foods.json'
import { DEFAULT_NUTRITION_PROTOCOL } from '../../../api/summer-shredded/nutrition-protocol.js'

export const FOODS = source.foods
export const FOOD_BY_ID = Object.fromEntries(FOODS.map(f => [f.id, f]))
export const ACTIVITY_FACTORS = { male: { light: 1.13, moderate: 1.20, intense: 1.22 }, female: { light: 1.12, moderate: 1.18, intense: 1.20 } }
export function energyEstimate(profile, weight = profile?.weight) {
  if (!profile || !ACTIVITY_FACTORS[profile.sex]?.[profile.activity]) return null
  const { age, height } = profile
  if (![weight, age, height].every(x => typeof x === 'number' && Number.isFinite(x))
    || weight < 30 || weight > 300 || age < 18 || age > 100 || height < 120 || height > 230) return null
  const tmb = profile.sex === 'male' ? 66.47 + 13.75 * weight + 5.003 * height - 6.775 * age
    : 655.09 + 9.563 * weight + 1.85 * height - 4.676 * age
  return { tmb, factor: ACTIVITY_FACTORS[profile.sex][profile.activity], get: tmb * ACTIVITY_FACTORS[profile.sex][profile.activity], weight }
}
export function nutritionTarget(profile, week, day, week7Weight, protocol = DEFAULT_NUTRITION_PROTOCOL) {
  if (!Number.isInteger(week) || week < 1 || week > 12 || !Number.isInteger(day) || day < 0 || day > 6) return { target: null, reason: 'invalid-day' }
  if (week >= 7 && !week7Weight) return { target: null, reason: 'recalculate' }
  const energy = energyEstimate(profile, week >= 7 ? week7Weight : profile?.weight)
  if (!energy) return { target: null, reason: 'profile' }
  const offset = protocol?.weeks?.[week - 1]?.offsets?.[day]
  if (offset === null || offset === undefined) return { ...energy, target: null, reason: 'producer-day-pending' }
  return { ...energy, offset, target: energy.get + offset, reason: null }
}
export function foodNutrition(food, quantity) {
  if (!food || food.nutritionUnknown || !Number.isFinite(quantity) || quantity < 0 || quantity > 5000) return null
  const proteinAnimal = food.proteinAnimal * quantity, proteinPlant = food.proteinPlant * quantity
  const protein = proteinAnimal + proteinPlant, carbs = food.carbs * quantity, fat = food.fat * quantity
  return { proteinAnimal, proteinPlant, protein, carbs, fat, kcal: 4 * protein + 4 * carbs + 9 * fat }
}
export function nutritionTotals(items) {
  return (items || []).reduce((totals, item) => {
    const value = foodNutrition(FOOD_BY_ID[item.foodId], Number(item.quantity))
    if (!value) { totals.unknown++; return totals }
    for (const key of ['kcal', 'protein', 'proteinAnimal', 'proteinPlant', 'carbs', 'fat']) totals[key] += value[key]
    return totals
  }, { kcal: 0, protein: 0, proteinAnimal: 0, proteinPlant: 0, carbs: 0, fat: 0, unknown: 0 })
}
export function substituteQuantity(original, replacement, quantity, basis = 'kcal') {
  const before = foodNutrition(original, quantity), after = foodNutrition(replacement, 1)
  if (!before || !after || !['kcal', 'protein', 'carbs', 'fat'].includes(basis) || before[basis] <= 0 || after[basis] <= 0) return null
  return Math.round(before[basis] / after[basis] * 100) / 100
}
export function programDay(startedOn, today) {
  const days = Math.floor((Date.parse(today + 'T12:00:00Z') - Date.parse(startedOn + 'T12:00:00Z')) / 86400000)
  return Number.isFinite(days) ? Math.max(0, days) % 7 : 0
}
export const initialNutrition = sex => ({ profile: { sex, age: '', height: '', weight: '', activity: 'moderate' }, week7Weight: null,
  meals: ['Café da manhã', 'Almoço', 'Lanche', 'Jantar'].map((name, i) => ({ id: 'meal-' + i, name, items: [] })), days: {} })

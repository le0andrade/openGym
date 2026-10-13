// Canonical Summer Shredded training content.
//
// Source of truth: the two 12-week workout PDFs supplied by the product owner.
// External YouTube/Instagram links from those PDFs are intentionally not stored here.
// Where possible, source exercise names are mapped to an existing openGym catalogue id
// so the student UI can reuse openGym's still image/GIF. Source-facing Portuguese names,
// weekly prescriptions and producer notes remain unchanged.
//
// Match quality:
// - exact: openGym entry represents the same named movement closely.
// - equivalent: movement is suitable for media/demo, while the producer-facing label remains.
// - custom: no safe/clear openGym equivalent; Summer Shredded owns a media-less exercise.

export const STANDARD_12_WEEK = Object.freeze([
  '2x10a15', '2x8a12', '2x5a9', '2x3a7',
  '3x3a7', '3x3a7', '2x8a12', '2x8a12',
  '3x3a7', '2x5a9', '4x3a7', '2x5a9'
])

export const ABS_12_WEEK = Object.freeze([
  '3x10 (TSD)', '3x10 (DSDN)', '3x10 (TSD)', '4x10 (DSDN)',
  '4x10 (DSDN)', '2x10 (DSDN)', '3x10 (TSD)', '4x10 (DSDN)',
  '4x10 (DSDN)', '2x10 (DSDN)', '3x10 (TSD)', '4x10 (DSDN)'
])

export const CARDIO_12_WEEK = Object.freeze([
  '60 min', '60 min', '60 min', '60 min',
  '45 min', '45 min', '60 min', '60 min',
  '45 min', '60 min', '45 min', '40 min'
])

export const FEMALE_LEG_EXTENSION_REST_PAUSE_12_WEEK = Object.freeze([
  '2x20', '2x25', '2x30', '2x30',
  '3x20', '3x20', '2x25', '2x40',
  '2x20', '2x20', '2x40', '3x40'
])

export const FEMALE_FROG_PUMP_12_WEEK = Object.freeze([
  '1x30', '2x30', '2x50', '2x50',
  '3x30', '3x50', '2x50', '2x30',
  '2x30', '2x50', '4x30', '2x50'
])

export { CONTENT_VERSION, SUMMER_SHREDDED_CUSTOM_EXERCISES, SUMMER_SHREDDED_PROGRAMS } from './canonical-data.js'
import { SUMMER_SHREDDED_PROGRAMS } from './canonical-data.js'

export const PROGRAM_BY_SLUG = Object.freeze(
  Object.fromEntries(SUMMER_SHREDDED_PROGRAMS.map(program => [program.slug, program]))
)

export function prescriptionForWeek(exercise, week) {
  const index = Number(week) - 1
  if (!Number.isInteger(index) || index < 0 || index >= 12) return null
  return exercise?.prescription?.[index] ?? null
}

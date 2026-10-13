// Source: Guia Completo para Secar, pages 10, 11 and 17.
// Undocumented days remain null until the producer defines them.
export const DEFAULT_NUTRITION_PROTOCOL = {
  version: '1.0.0',
  source: { file: 'ebook_e8ce86af-5747-4b1a-b2f8-069ec5f0d61f(1).pdf', pages: [10, 11, 17], sha256: 'd2bd893febc42d1d3a5ba9d1805313f0bf01c776082fa2f6013fd664f72634ab' },
  weeks: [
    { week: 1, offsets: [0, 0, 0, 0, 0, 0, 0] },
    { week: 2, offsets: [-200, -200, -200, -200, -200, -200, -200] },
    { week: 3, offsets: [-300, -300, -300, -300, -300, -300, -300] },
    { week: 4, offsets: [-400, -400, -400, -400, -400, -400, -400] },
    { week: 5, offsets: [-400, -400, -400, 100, -400, -400, -400] },
    { week: 6, offsets: [-400, -400, -400, 100, -400, -400, -400] },
    { week: 7, offsets: [-200, -200, -200, -200, -200, -200, -200], recalculation: true },
    { week: 8, offsets: [-300, -300, -300, -300, -300, -300, -300] },
    { week: 9, offsets: [-400, -400, -400, -400, -400, -400, -400] },
    { week: 10, offsets: [-400, -400, -400, 100, null, null, null] },
    { week: 11, offsets: [-500, -500, -500, 100, null, null, null] },
    { week: 12, offsets: [-500, -500, -500, -500, -500, 0, null] }
  ]
}

export function validateNutritionProtocol(protocol) {
  if (!protocol || !Array.isArray(protocol.weeks) || protocol.weeks.length !== 12) throw new Error('nutrition protocol must have 12 weeks')
  protocol.weeks.forEach((row, i) => {
    if (row.week !== i + 1 || !Array.isArray(row.offsets) || row.offsets.length !== 7
      || row.offsets.some(x => x !== null && (typeof x !== 'number' || !Number.isFinite(x) || x < -1500 || x > 1500))) {
      throw new Error('invalid nutrition weekly offsets')
    }
  })
}

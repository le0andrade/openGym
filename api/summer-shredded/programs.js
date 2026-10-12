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

const catalogue = (sourceName, exerciseId, openGymName, match = 'equivalent', extra = {}) => ({
  sourceName,
  exerciseId,
  openGymName,
  match,
  prescription: STANDARD_12_WEEK,
  ...extra
})

const custom = (sourceName, exerciseId, extra = {}) => ({
  sourceName,
  exerciseId,
  openGymName: null,
  match: 'custom',
  prescription: STANDARD_12_WEEK,
  ...extra
})

export const SUMMER_SHREDDED_CUSTOM_EXERCISES = Object.freeze([
  {
    id: 'ss-puxada-romada',
    n: 'Puxada Romada',
    bp: 'back',
    eq: 'cable',
    tg: 'lats',
    sm: [],
    st: [],
    img: null,
    gif: null,
    needsReview: true,
    sourceNote: 'Nome mantido exatamente como aparece no material original; nenhum equivalente openGym foi assumido.'
  }
])

const conditioning = Object.freeze({
  abdomen: {
    sourceName: 'Elevação de pernas Suspenso',
    exerciseId: '2333',
    openGymName: 'arm slingers hanging straight legs',
    match: 'equivalent',
    prescription: ABS_12_WEEK
  },
  cardio: {
    sourceName: 'Escada/Bike/Transport',
    match: 'options',
    intensity: 'Baixa Intensidade',
    prescription: CARDIO_12_WEEK,
    options: [
      { exerciseId: '2311', label: 'Escada', openGymName: 'walking on stepmill' },
      { exerciseId: '2331', label: 'Bike', openGymName: 'cycle cross trainer' },
      { exerciseId: '2141', label: 'Transport', openGymName: 'walk elliptical cross trainer' }
    ]
  }
})

export const SUMMER_SHREDDED_PROGRAMS = Object.freeze([
  {
    id: 'summer-shredded-masculino',
    slug: 'masculino',
    name: 'Summer Shredded Masculino',
    audience: 'male',
    weeks: 12,
    workouts: [
      {
        id: 'A',
        name: 'Treino A',
        exercises: [
          catalogue('Crucifixo Máquina', '0596', 'lever seated fly'),
          catalogue('Crucifixo Inclinado Cross', '1270', 'cable upper chest crossovers'),
          catalogue('Supino Inclinado 30° (H)', '0314', 'dumbbell incline bench press', 'exact'),
          catalogue('Supino Reto Smith (DEAD STOP)', '0748', 'smith bench press', 'exact', {
            note: 'Usar limitador',
            technique: 'dead-stop'
          }),
          catalogue('Cross Over', '1269', 'cable standing up straight crossovers', 'equivalent', {
            note: 'Pico de contração 2"'
          }),
          catalogue('Cross Over Reverso', '0225', 'cable standing cross-over high reverse fly')
        ]
      },
      {
        id: 'B',
        name: 'Treino B',
        exercises: [
          catalogue('Puxada Frente Aberta', '2291', 'cable wide grip lat pulldown', 'exact'),
          catalogue('Puxada Supinada Fechada', '10503', 'cable reverse narrow grip lat pulldown', 'exact'),
          custom('Puxada Romada', 'ss-puxada-romada'),
          catalogue('Remada Baixa Triângulo', '2661', 'cable seated row with v bar', 'exact'),
          catalogue('Remada Aberta Sentado', '0218', 'cable seated wide-grip row', 'exact'),
          catalogue('Pulldown Corda', '0237', 'cable straight arm pulldown (with rope)', 'exact')
        ]
      },
      {
        id: 'C',
        name: 'Treino C',
        exercises: [
          catalogue('Militar Press Frente em pé', '1165', 'barbell standing military press (without rack)', 'exact'),
          catalogue('Arnold Press', '2137', 'dumbbell arnold press', 'exact'),
          catalogue('Elevação Lateral', '0334', 'dumbbell lateral raise', 'exact'),
          catalogue('Elevação Lateral cross por trás', '0192', 'cable one arm lateral raise'),
          catalogue('Elevação Frontal Alternada Neutra (H)', '1230', 'dumbbell standing alternate vertical front raises', 'exact'),
          catalogue('Face Pull', '0203', 'cable rear delt row (with rope)', 'equivalent', {
            note: 'Escapulas fechadas'
          }),
          catalogue('Crucifixo Reverso Cross', '0225', 'cable standing cross-over high reverse fly', 'exact'),
          catalogue('Encolhimento Smith pela frente', '0767', 'smith shrug', 'exact')
        ]
      },
      {
        id: 'D',
        name: 'Treino D',
        exercises: [
          catalogue('Rosca Concentrada Sem apoio', '0418', 'dumbbell standing concentration curl', 'exact'),
          catalogue('Rosca Direta Cross', '0868', 'cable curl', 'equivalent'),
          catalogue('Rosca Martelo (H)', '0312', 'dumbbell hammer curl v. 2', 'exact'),
          catalogue('Rosca Reversa Cross', '0206', 'cable reverse curl', 'exact'),
          catalogue('Rosca Punho Cross', '0247', 'cable wrist curl', 'exact'),
          catalogue('Tríceps Pulley Unilateral', '5033', 'cable single arm triceps pushdown (rope attachment)', 'equivalent'),
          catalogue('Tríceps Corda', '0200', 'cable pushdown (with rope attachment)', 'exact'),
          catalogue('Tríceps Francês (H)', '6221', 'dumbbell standing french press', 'exact'),
          catalogue('Tríceps Testa 45°', '0330', 'dumbbell incline triceps extension', 'equivalent')
        ]
      },
      {
        id: 'E',
        name: 'Treino E',
        exercises: [
          catalogue('Agachamento Livre', '0043', 'barbell full squat', 'equivalent'),
          catalogue('Leg Press', '0739', 'sled 45° leg press', 'exact'),
          catalogue('Elevação Pélvica Barra', '1060', 'barbell hip thrust', 'exact'),
          catalogue('Cadeira Extensora Unilateral', '1571', 'lever one leg extension', 'exact'),
          catalogue('Stiff', '0116', 'barbell straight leg deadlift', 'equivalent'),
          catalogue('Cadeira Flexora', '0599', 'lever seated leg curl', 'exact'),
          catalogue('Sóleo', '0594', 'lever seated calf raise', 'equivalent'),
          catalogue('Gêmeos leg press', '1385', 'lever seated squat calf raise on leg press machine', 'equivalent')
        ]
      }
    ],
    conditioning,
    notes: [
      'Mantenha os descansos de no mínimo 90 segundos entre as séries, podendo chegar até a 300 segundos (5 minutos).',
      'DEAD STOP - Realizar uma pausa momentânea, onde a carga toca o chão e o movimento começa da inércia a cada repetição.',
      'Sempre trabalhe com progressão de cargas, isso é, a cada treino procure superar as cargas do treino passado.',
      'Sempre trabalhe na faixa de repetições prescritas, sempre buscando as repetições mais altas, alcançando-as, aumente a carga.'
    ]
  },
  {
    id: 'summer-shredded-feminino',
    slug: 'feminino',
    name: 'Summer Shredded Feminino',
    audience: 'female',
    weeks: 12,
    workouts: [
      {
        id: 'A',
        name: 'Treino A',
        exercises: [
          catalogue('Agachamento Frontal', '0042', 'barbell front squat', 'exact'),
          catalogue('Goblet Squat', '1760', 'dumbbell goblet squat', 'exact'),
          catalogue('Cadeira extensora c/Rest Pause', '0585', 'lever leg extension', 'exact', {
            prescription: FEMALE_LEG_EXTENSION_REST_PAUSE_12_WEEK,
            note: 'Rest pause de 10 segundos',
            technique: 'rest-pause'
          }),
          catalogue('Passada', '1460', 'walking lunge', 'equivalent'),
          catalogue('Gêmeos Leg Press', '1385', 'lever seated squat calf raise on leg press machine', 'equivalent')
        ]
      },
      {
        id: 'B',
        name: 'Treino B',
        exercises: [
          catalogue('Crucifixo Máquina', '0596', 'lever seated fly'),
          catalogue('Militar Press Frente em pé', '1165', 'barbell standing military press (without rack)', 'exact'),
          catalogue('Elevação Lateral 45°', '0334', 'dumbbell lateral raise', 'equivalent'),
          catalogue('Tríceps Coice Cross Unilateral', '4545', 'cable bent over single arm kickback', 'exact'),
          catalogue('Tríceps Testa', '0060', 'barbell lying triceps extension skull crusher', 'equivalent'),
          catalogue('Tríceps Corda', '0200', 'cable pushdown (with rope attachment)', 'exact')
        ]
      },
      {
        id: 'C',
        name: 'Treino C',
        exercises: [
          catalogue('Stiff', '0116', 'barbell straight leg deadlift', 'equivalent'),
          catalogue('Mesa flexora', '9676', 'lever lying knee flexion', 'exact'),
          catalogue('Cadeira flexora', '0599', 'lever seated leg curl', 'exact'),
          catalogue('Elevação pélvica unilateral', '2071', 'single leg hip thrusts', 'exact'),
          catalogue('Flexão de joelhos em pé c/ caneleira', '0795', 'standing single leg curl', 'equivalent')
        ]
      },
      {
        id: 'D',
        name: 'Treino D',
        exercises: [
          catalogue('Remada Sentado c/ triangulo', '2661', 'cable seated row with v bar', 'exact'),
          catalogue('Puxada com triangulo', '1047', 'cable close grip front lat pulldown', 'equivalent'),
          catalogue('Pullover', '0375', 'dumbbell pullover', 'equivalent'),
          catalogue('Crucifixo Reverso Cross', '0225', 'cable standing cross-over high reverse fly', 'exact'),
          catalogue('Rosca Scott', '0070', 'barbell preacher curl', 'equivalent'),
          catalogue('Rosca Corda Cross', '0165', 'cable hammer curl (with rope)', 'equivalent')
        ]
      },
      {
        id: 'E',
        name: 'Treino E',
        exercises: [
          catalogue('Elevação Pélvica Barra', '1060', 'barbell hip thrust', 'exact'),
          catalogue('Frog pumps c/rest pause', '3181', 'bodyweight frog pump', 'exact', {
            prescription: FEMALE_FROG_PUMP_12_WEEK,
            note: 'Rest pause de 10 segundos',
            technique: 'rest-pause'
          }),
          catalogue('Levantamento terra sumô', '0117', 'barbell sumo deadlift', 'exact'),
          catalogue('Abdução de quadril no cross', '3048', 'cable hip abduction v. 2', 'exact'),
          catalogue('Glúteo Coice Cross', '0880', 'cable standing hip extension v. 2', 'equivalent'),
          catalogue('Agachamento búlgaro', '0410', 'dumbbell single leg split squat', 'equivalent')
        ]
      }
    ],
    conditioning,
    notes: [
      'Mantenha os descansos de no mínimo 90 segundos entre as séries, podendo chegar até a 300 segundos (5 minutos).',
      'REST PAUSE - Realizar o máximo possível de repetições, descansar 10 segundos e seguir a contagem, fazer quantos descansos necessários de 10" até completar.',
      'Sempre trabalhe com progressão de cargas, isso é, a cada treino procure superar as cargas do treino passado.',
      'Sempre trabalhe na faixa de repetições prescritas, sempre buscando as repetições mais altas, alcançando-as, aumente a carga.'
    ]
  }
])

export const PROGRAM_BY_SLUG = Object.freeze(
  Object.fromEntries(SUMMER_SHREDDED_PROGRAMS.map(program => [program.slug, program]))
)

export function prescriptionForWeek(exercise, week) {
  const index = Number(week) - 1
  if (!Number.isInteger(index) || index < 0 || index >= 12) return null
  return exercise?.prescription?.[index] ?? null
}

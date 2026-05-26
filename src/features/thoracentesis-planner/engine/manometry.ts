export type LungExpansionArchetype = 'expandable' | 'partiallyExpandable' | 'trapped'
export type SymptomTrigger = 'chestPressure' | 'cough' | 'throatTickle' | 'pleuriticPain'

export interface DrainageCurvePrediction {
  pressureCmH2O: number
  symptomTriggers: SymptomTrigger[]
  reExpansionEdemaRisk: 'low' | 'moderate' | 'higher'
  teachingPoint: string
}

function roundPressure(value: number) {
  return Math.round(value * 10) / 10
}

export function predictDrainageCurve(
  archetype: LungExpansionArchetype,
  drainedMl: number,
): DrainageCurvePrediction {
  const volume = Math.max(0, drainedMl)
  const symptomTriggers: SymptomTrigger[] = []
  let pressureCmH2O: number
  let teachingPoint: string

  if (archetype === 'expandable') {
    pressureCmH2O = 3 - volume / 350
    teachingPoint = 'Expandable lung shows a gradual pressure decline and symptom-limited drainage.'
    if (volume >= 1500) {
      symptomTriggers.push('cough')
    }
  } else if (archetype === 'partiallyExpandable') {
    pressureCmH2O = volume <= 700 ? 2 - volume / 300 : -1 - (volume - 700) / 85
    teachingPoint =
      'Partially expandable lung has a biphasic curve: early drainage looks tolerable, then pressure falls faster.'
    if (volume >= 900) {
      symptomTriggers.push('chestPressure')
    }
    if (volume >= 1200) {
      symptomTriggers.push('cough')
    }
  } else {
    pressureCmH2O = -4 - volume / 22
    teachingPoint =
      'Trapped lung starts negative and becomes steeply negative with small drainage volumes; symptoms can occur early.'
    if (volume >= 50) {
      symptomTriggers.push('chestPressure')
    }
    if (volume >= 150) {
      symptomTriggers.push('pleuriticPain')
    }
  }

  if (pressureCmH2O <= -20 && !symptomTriggers.includes('throatTickle')) {
    symptomTriggers.push('throatTickle')
  }

  return {
    pressureCmH2O: roundPressure(pressureCmH2O),
    symptomTriggers,
    reExpansionEdemaRisk:
      volume >= 1500 || pressureCmH2O <= -20
        ? 'higher'
        : volume >= 1000 || pressureCmH2O <= -12
          ? 'moderate'
          : 'low',
    teachingPoint,
  }
}

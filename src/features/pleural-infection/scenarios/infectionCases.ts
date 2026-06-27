import type { ParapneumonicInput } from '../engine/staging'

export interface InfectionCase {
  id: string
  /** English case title (kept for tests/non-UI use). The UI renders the
   * localized title via messages `pleuralInfection.workflow.cases.<id>` keyed by id. */
  title: string
  input: ParapneumonicInput
  anticoagulated: boolean
}

export const infectionCases: readonly InfectionCase[] = [
  {
    id: 'anechoic-low-ph',
    title: 'Anechoic effusion with pH 7.18',
    input: {
      ph: 7.18,
      glucose: 82,
      ldh: 650,
      gramStain: false,
      frankPus: false,
      usPattern: 'freeFlowing',
    },
    anticoagulated: false,
  },
  {
    id: 'septated-residual',
    title: 'Septated residual collection after tube',
    input: {
      ph: 7.05,
      glucose: 34,
      ldh: 1800,
      gramStain: false,
      frankPus: false,
      usPattern: 'septated',
    },
    anticoagulated: false,
  },
  {
    id: 'pus-anticoagulated',
    title: 'Frank pus with mandatory anticoagulation',
    input: {
      ph: 6.95,
      glucose: 20,
      ldh: 2400,
      gramStain: true,
      frankPus: true,
      usPattern: 'complex',
    },
    anticoagulated: true,
  },
]

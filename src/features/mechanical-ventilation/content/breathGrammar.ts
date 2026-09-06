import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import type { BreathStopId } from './breathSpine'
import type { VentilationKnobId } from './controlPanel'
import { ventilationDecisionTable, ventilationUnitById } from './learningCurriculum'

/**
 * The diagnostic grammar: what moved → where on the breath → the shortlist.
 *
 * Built once, here, and quoted by reference everywhere. Every Explain step highlights its row; no
 * step restates a row in different words, because paraphrase drift is how grammars die. The rows
 * grow out of the curriculum's decision table (`ventilationDecisionTable`) and give each entry a
 * location on the spine — or say that the finding is not on the breath at all but on one of the two
 * gas-exchange axes.
 *
 * The direction claims in `whatMoved` are checked against the engine by
 * `__tests__/breath-grammar.test.ts`: a row that says the peak rises is a row whose experiment is
 * run and asserted, not a row that was written from intention.
 *
 * Authored teaching construct. Footnote for every row: compare against this patient's own baseline;
 * no row carries a cutoff.
 */

export type BreathGrammarLocation =
  | { readonly kind: 'stop'; readonly stopId: BreathStopId; readonly detail: string }
  | { readonly kind: 'axis'; readonly axis: 'oxygenation' | 'ventilation'; readonly detail: string }

export interface BreathGrammarRow {
  readonly id: string
  /** The curriculum decision-table row this grows out of, when it does. */
  readonly decisionTableId?: (typeof ventilationDecisionTable)[number]['id']
  readonly whatMoved: string
  readonly where: BreathGrammarLocation
  readonly shortlist: readonly string[]
  /** The knob that reaches this row, or null when no knob does and the cause must be found. */
  readonly knob: VentilationKnobId | 'shaping' | null
  readonly taughtIn: readonly string[]
}

export const breathGrammarRows: readonly BreathGrammarRow[] = [
  {
    id: 'resistive-load',
    decisionTableId: 'resistance',
    whatMoved:
      'The peak rises while a valid plateau stays close to where it was, at the same volume and flow.',
    where: {
      kind: 'stop',
      stopId: 'inspiration',
      detail: 'While gas is moving — the pressure spent pushing gas through the airway.',
    },
    shortlist: ['the tube', 'secretions', 'the airways', 'the circuit'],
    knob: null,
    taughtIn: ['mechanics-load-and-pressure', 'high-peak-pressure-integration'],
  },
  {
    id: 'elastic-load',
    decisionTableId: 'elastic',
    whatMoved:
      'The peak and a valid plateau rise together, at the same volume and the same total PEEP.',
    where: {
      kind: 'stop',
      stopId: 'inspiration',
      detail: 'At the end of the push — the pressure the filled lung and chest wall hold.',
    },
    shortlist: ['the lung', 'the chest wall', 'trapped gas', 'one lung instead of two'],
    knob: 'breath-size',
    taughtIn: [
      'mechanics-load-and-pressure',
      'modes-and-breath-delivery',
      'lung-protection',
      'high-peak-pressure-integration',
    ],
  },
  {
    id: 'incomplete-emptying',
    decisionTableId: 'emptying',
    whatMoved: 'Expiratory flow is still running when the next breath starts.',
    where: {
      kind: 'stop',
      stopId: 'expiration',
      detail:
        'Emptying has not finished; the baseline the next breath starts from is higher than the set PEEP.',
    },
    shortlist: [
      'too little time to empty',
      'slow emptying through narrowed airways',
      'a rate set too high',
    ],
    knob: 'rate',
    taughtIn: [
      'expiration-and-air-trapping',
      'ventilation-and-co2',
      'high-peak-pressure-integration',
    ],
  },
  {
    id: 'trigger-mismatch',
    decisionTableId: 'timing',
    whatMoved: 'Efforts that start no breath, or breaths that start with no effort.',
    where: {
      kind: 'stop',
      stopId: 'trigger',
      detail:
        'The start of the breath — the patient and the machine disagree about when it begins.',
    },
    shortlist: [
      'the trigger setting',
      'trapped gas the effort must overcome',
      'a weak effort',
      'a leak or condensate ringing the bell',
    ],
    knob: 'shaping',
    taughtIn: ['triggering-and-cycling', 'waveform-reading-sequence'],
  },
  {
    id: 'cycling-mismatch',
    decisionTableId: 'timing',
    whatMoved:
      'Effort continues after the machine stops pushing, or the push continues after the effort has ended.',
    where: {
      kind: 'stop',
      stopId: 'cycling',
      detail: 'The switch — the patient and the machine disagree about when inspiration ends.',
    },
    shortlist: [
      'the cycle-off setting',
      'the inspiratory time',
      'a demand the breath does not meet',
    ],
    knob: 'shaping',
    taughtIn: ['triggering-and-cycling', 'dyssynchrony-mechanisms'],
  },
  {
    id: 'flow-starvation',
    whatMoved: 'The pressure trace scoops inward during a volume-controlled push.',
    where: {
      kind: 'stop',
      stopId: 'inspiration',
      detail: 'While gas is moving — the patient is pulling harder than the set flow delivers.',
    },
    shortlist: [
      'a set flow below the patient’s demand',
      'a high drive that needs its own cause found',
    ],
    knob: 'shaping',
    taughtIn: ['waveform-reading-sequence', 'dyssynchrony-mechanisms'],
  },
  {
    id: 'oxygenation-axis',
    decisionTableId: 'oxygen',
    whatMoved: 'The saturation moves while the breath pattern is quiet.',
    where: {
      kind: 'axis',
      axis: 'oxygenation',
      detail:
        'Not a place on the breath: the oxygenation axis — oxygen, PEEP, the lung’s shunt, and the circulation.',
    },
    shortlist: [
      'the oxygen fraction',
      'the PEEP and the aerated lung',
      'shunt in the lung',
      'the circulation',
    ],
    knob: 'oxygen',
    taughtIn: ['oxygenation-response', 'safety-reassessment-and-human-factors'],
  },
  {
    id: 'ventilation-axis',
    decisionTableId: 'co2',
    whatMoved: 'The carbon dioxide moves while the oxygenation is acceptable.',
    where: {
      kind: 'axis',
      axis: 'ventilation',
      detail:
        'Not a place on the breath: the ventilation axis — the gas moved each minute and the part of it that reaches exchanging lung.',
    },
    shortlist: [
      'the rate',
      'the size of the breath',
      'emptying between breaths',
      'dead space',
      'carbon dioxide production',
    ],
    knob: 'rate',
    taughtIn: ['ventilation-and-co2', 'safety-reassessment-and-human-factors'],
  },
]

export const breathGrammarRowById: ReadonlyMap<string, BreathGrammarRow> = new Map(
  breathGrammarRows.map((row) => [row.id, row]),
)

export function breathGrammarRow(id: string): BreathGrammarRow {
  const row = breathGrammarRowById.get(id)
  if (!row) throw new Error(`Unknown breath grammar row: ${id}`)
  return row
}

/** The rows a section highlights, in grammar order. */
export function breathGrammarRowsFor(unitId: string): readonly BreathGrammarRow[] {
  return breathGrammarRows.filter((row) => row.taughtIn.includes(unitId))
}

export function breathGrammarErrors(rows: readonly BreathGrammarRow[]): readonly string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const row of rows) {
    if (ids.has(row.id)) errors.push(`Duplicate row id ${row.id}`)
    ids.add(row.id)
    if (
      row.decisionTableId &&
      !ventilationDecisionTable.some((entry) => entry.id === row.decisionTableId)
    ) {
      errors.push(`Row ${row.id} names an unknown decision-table entry ${row.decisionTableId}`)
    }
    for (const unitId of row.taughtIn) {
      if (!ventilationUnitById.has(unitId))
        errors.push(`Row ${row.id} is taught in unknown unit ${unitId}`)
    }
    for (const line of [row.whatMoved, row.where.detail, ...row.shortlist]) {
      if (/\d/.test(line)) errors.push(`Number in grammar copy: "${line}"`)
      const flagged = flaggedLearnerCopyTerms(line)
      if (flagged.length > 0) errors.push(`Banned term ${flagged.join(', ')} in "${line}"`)
    }
    if (row.shortlist.length === 0 || row.shortlist.length > 5) {
      errors.push(`Row ${row.id} shortlist must hold one to five causes`)
    }
  }
  for (const entry of ventilationDecisionTable) {
    if (!rows.some((row) => row.decisionTableId === entry.id)) {
      errors.push(`Decision-table entry ${entry.id} has no grammar row`)
    }
  }
  return errors
}

{
  const errors = breathGrammarErrors(breathGrammarRows)
  if (errors.length > 0) throw new Error(`Breath grammar is not valid:\n${errors.join('\n')}`)
}

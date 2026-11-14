import type { DolphinSourceId } from '../data/sources'

/**
 * The trouble grammar: for each thing that changes during the procedure, where it happens, its
 * earliest sign, and the first moves in order. Every complication debrief highlights one row, and
 * the Reference tab prints the whole table.
 *
 * From the NMMP workshop's "rules of bronchoscopy" (keep off the walls, never advance blindly, pull
 * back to the carina and main bronchi, control cough) and its complications slides, with Tsang's
 * account of passing the glottis. Drugs without a sourced dose are named "per the NMMP protocol".
 */
export interface TroubleRow {
  readonly id: string
  readonly step: string
  readonly change: string
  readonly earliestSign: string
  /** In the order the hands make them. */
  readonly firstMoves: readonly string[]
  readonly sourceIds: readonly DolphinSourceId[]
}

export const DOLPHIN_TROUBLE_GRAMMAR: readonly TroubleRow[] = [
  {
    id: 'plug-mucus',
    step: 'Blowhole',
    change: 'Nasal plug or mucus fills the view',
    earliestSign: 'The view turns pink within a few millimeters',
    firstMoves: [
      'Stop',
      'Withdraw to the naris',
      'Suction',
      'Find the passage again before advancing',
    ],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
  },
  {
    id: 'fornix',
    step: 'Nasopharynx',
    change: 'The tip is in a fornix, not at the spout',
    earliestSign: 'A smooth blind pouch, and nothing moves with a breath',
    firstMoves: ['Pull back until both fornices are in view', 'Aim at the midline spout tip'],
    sourceIds: ['tsang-2002', 'nmmp-bronchoscopy-guide'],
  },
  {
    id: 'spout-cough',
    step: 'Spout',
    change: 'Cough or laryngospasm when the tip touches the spout',
    earliestSign: 'A cough; the glottis clamps and the scope is pushed back',
    firstMoves: [
      'Stop',
      'Withdraw to the nasopharynx',
      'More topical lidocaine: the atomizer, or through the scope',
      'Top up sedation only if the animal is still intolerant',
      'Wait for regular breaths',
    ],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
  },
  {
    id: 'closed-glottis',
    step: 'Spout',
    change: 'Advancing against a closed glottis',
    earliestSign: 'Resistance, no lumen ahead, the animal straining',
    firstMoves: [
      'Never push',
      'Hold at the spout',
      'Advance only in the moment it opens, in stages',
    ],
    sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
  },
  {
    id: 'lost-orientation',
    step: 'Trachea to the branches',
    change: 'Orientation is lost',
    earliestSign: 'What you expect to see does not match the picture',
    firstMoves: [
      'Withdraw to the carina or the main bronchus',
      'Find the tracheal bronchus again: cranial, on the right',
      'Count the branches again from the carina',
    ],
    sourceIds: ['nmmp-workshop-2024', 'nmmp-bronchoscopy-guide'],
  },
  {
    id: 'breath-hold',
    step: 'Any point',
    change: 'The breath-hold lengthens, or mentation or heart rate changes',
    earliestSign: 'Breaths further apart; no breath when one is due',
    firstMoves: [
      'Withdraw to the nasopharynx, or out',
      'Let the animal breathe',
      'Oxygen',
      'Stop the procedure if breathing does not recover',
      'Albuterol per the NMMP protocol',
    ],
    sourceIds: ['nmmp-workshop-2024'],
  },
  {
    id: 'poor-return',
    step: 'Lavage',
    change: 'Little fluid comes back',
    earliestSign: 'Far less returns than was instilled',
    firstMoves: [
      'Confirm the scope is wedged',
      'Gentle hand suction',
      'No unplanned extra aliquots',
      'Record what was instilled and what returned',
    ],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'nmmp-form-2019'],
  },
  {
    id: 'bleeding',
    step: 'Brush or biopsy',
    change: 'Bleeding',
    earliestSign: 'Blood fills the lumen',
    firstMoves: [
      'Keep the scope wedged',
      'Suction',
      'Cold saline',
      'Wait',
      'Stop sampling',
      'Escalate per the NMMP protocol',
    ],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
  },
  {
    id: 'secretions',
    step: 'Deep branches',
    change: 'Secretions block the view',
    earliestSign: 'A cloudy view, with the scope nearly as wide as the lumen',
    firstMoves: ['Suction', 'Small flushes', 'Stop at the scope’s reach', 'Never advance blind'],
    sourceIds: ['nmmp-workshop-2024'],
  },
  {
    id: 'over-sedation',
    step: 'Sedation',
    change: 'Over-sedation',
    earliestSign: 'Breaths further apart and a poor response',
    firstMoves: [
      'No more top-ups',
      'Support breathing',
      'Flumazenil',
      'Keep the animal out of deep water until breathing is regular',
    ],
    sourceIds: ['nmmp-workshop-2024', 'ivancic-2014'],
  },
]

export const troubleRowById: ReadonlyMap<string, TroubleRow> = new Map(
  DOLPHIN_TROUBLE_GRAMMAR.map((row) => [row.id, row] as const),
)

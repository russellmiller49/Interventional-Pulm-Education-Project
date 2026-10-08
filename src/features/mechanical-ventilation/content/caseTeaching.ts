import { mechanicalVentilationCaseById, mechanicalVentilationCases } from './runtimeCases'

/**
 * The case explanation as it is said to the learner (MV-PRE-REVIEW-04: Q6, C10, C11).
 *
 * The casebook's debriefs were written for whoever builds and runs the simulator: "The learner
 * should not chase a single SpO2 value…", "The randomized branch prevents rote pattern matching",
 * "The simulator should calculate inflated volume per neural effort…". They were printed to the
 * learner unchanged. The casebook snapshot is SHA-256 pinned and is not edited, so — as
 * `caseFindings.ts` does for the findings — the learner's wording is authored here, against the
 * frozen text.
 *
 * Rules for every entry, held by `mv-pre-review-04-learner-map.test.tsx`:
 *
 * - it restates the casebook debrief and adds no clinical claim, number or action;
 * - a sentence that is an instruction to the simulator's builder ("the simulator should…", "the
 *   case should reward…") is left out of the learner's text, because the learner cannot act on it
 *   and several describe behaviour the model does not have (see `caseModelNotes.ts`);
 * - it never says the learner did something;
 * - the casebook's own wording stays one disclosure away, on the same page.
 *
 * None of this is clinically reviewed. It is a change of voice, not of content.
 */
export interface VentilationCaseTeaching {
  /** The explanation, addressed to the learner. */
  readonly explanation: string
  /**
   * Which line of the casebook's hint ladder is offered beside the mechanism question. The first
   * line is the default; MV-01's first line asks which settings change oxygenation, which is a
   * different question from the one beside it (C11). Always one of the casebook's own lines.
   */
  readonly mechanismHintIndex: number
}

export const ventilationCaseTeaching: Readonly<Record<string, VentilationCaseTeaching>> = {
  'MV-01': {
    explanation:
      'The central tradeoff is recruitment versus overdistension. Do not chase a single SpO₂ value without watching the mechanics and the blood pressure. The same PEEP increment can help at one point on the compliance curve and harm at another.',
    mechanismHintIndex: 1,
  },
  'MV-02': {
    explanation:
      'In volume control, a fixed flow can be inadequate even when the tidal volume is reasonable. Match flow and timing to the patient’s demand while the cause of the high drive is treated. A normal respiratory rate is not the only goal in metabolic acidosis.',
    mechanismHintIndex: 0,
  },
  'MV-03': {
    explanation:
      'Double triggering is a timing problem with a volume-injury consequence. One patient effort outlasts the machine’s inflation and starts a second one before the first has emptied, so the two volumes stack. Count the volume inflated per patient effort, not only per machine breath: that is why breath stacking can defeat a low tidal-volume strategy.',
    mechanismHintIndex: 0,
  },
  'MV-04': {
    explanation:
      'Reverse triggering is ventilator-to-patient entrainment: the machine breath comes first and the patient’s effort follows it. It is often hard to recognize without effort monitoring, so look for indirect clues and for a fixed phase relationship between the mandatory breath and the effort. Management depends on context and does not reduce to more sedation or less sedation alone.',
    mechanismHintIndex: 0,
  },
  'MV-05': {
    explanation:
      'The missed efforts here are often caused by hyperinflation, not by weak effort. High support can create a larger tidal volume, a shorter expiratory time, more intrinsic PEEP and more missed triggers. The corrective direction may therefore be less support, earlier cycling and more expiratory time.',
    mechanismHintIndex: 0,
  },
  'MV-06': {
    explanation:
      'This is time-critical obstructive shock. The key is to unload trapped gas first, then deliberately accept a low minute ventilation. Raising the respiratory rate is harmful here: it leaves even less time to exhale.',
    mechanismHintIndex: 0,
  },
  'MV-07': {
    explanation:
      'Missed triggers can arise from low effort as well as from intrinsic PEEP, so the waveform context matters. Improve sensitivity and reduce load, and avoid the opposite error of autotriggering.',
    mechanismHintIndex: 0,
  },
  'MV-08': {
    explanation:
      'Autotriggering is the machine misreading a signal as an effort. Check the circuit and the patient-effort signal before treating what looks like a respiratory drive problem.',
    mechanismHintIndex: 0,
  },
  'MV-09': {
    explanation:
      'Premature cycling is common when a short time constant and a high cycle threshold make flow fall rapidly. Align the timing of the breath with the patient’s inspiration; simply increasing the tidal volume does not do that.',
    mechanismHintIndex: 0,
  },
  'MV-10': {
    explanation:
      'Delayed cycling is especially likely in obstructive lungs because flow decays slowly. High support and a low cycle threshold can keep the ventilator inflating after the patient’s inspiration has ended.',
    mechanismHintIndex: 0,
  },
  'MV-11': {
    explanation:
      'Rise time is not a cosmetic setting. It changes peak flow, effort, mechanical inspiratory time and comfort. The value that suits a patient depends on their respiratory drive and mechanics, so there is no single universal number.',
    mechanismHintIndex: 0,
  },
  'MV-12': {
    explanation:
      'Over-assistance may look comfortable in the moment, but it can produce alkalemia, periodic breathing, missed efforts, sleep disruption and diaphragmatic unloading. The target is shared work, not zero effort.',
    mechanismHintIndex: 0,
  },
  'MV-13': {
    explanation:
      'Peak pressure contains a resistive and an elastic component. A large peak-to-plateau gap directs you toward airway or circuit resistance. The cause differs between runs of this case, so read this patient’s findings; do not rely on recalling an earlier run.',
    mechanismHintIndex: 0,
  },
  'MV-14': {
    explanation:
      'Two distinctions meet in this case: patient causes versus ventilator causes in an emergency, and resistance versus compliance. Integrate the mechanics with the bedside examination; the waveform is not read in isolation.',
    mechanismHintIndex: 0,
  },
  'MV-15': {
    explanation:
      'Dyspnea, anxiety, pain and delirium reinforce one another, and physical signs and oxygen saturation can underestimate suffering. Assess the patient directly, make small physiology-based ventilator changes, communicate, and treat reversible stressors before deep sedation.',
    mechanismHintIndex: 0,
  },
}

export function ventilationCaseExplanation(caseId: string): string {
  const teaching = ventilationCaseTeaching[caseId]
  if (!teaching) throw new Error(`No learner explanation for case ${caseId}`)
  return teaching.explanation
}

/** The casebook hint offered beside the mechanism question: one of the casebook's own lines. */
export function ventilationCaseMechanismHint(caseId: string): string {
  const definition = mechanicalVentilationCaseById.get(caseId)
  const teaching = ventilationCaseTeaching[caseId]
  if (!definition || !teaching) throw new Error(`No mechanism hint for case ${caseId}`)
  return (
    definition.hintLadder[teaching.mechanismHintIndex] ??
    'Inspect pressure, flow, volume, and patient effort together.'
  )
}

{
  for (const definition of mechanicalVentilationCases) {
    const teaching = ventilationCaseTeaching[definition.id]
    if (!teaching) throw new Error(`Case ${definition.id} has no learner explanation`)
    if (!definition.hintLadder[teaching.mechanismHintIndex])
      throw new Error(`Case ${definition.id}: hint index outside the casebook's hint ladder`)
  }
}

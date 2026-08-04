/**
 * What this patient actually has, separated from what they might have had.
 *
 * `visibleFindings` comes from the supplied casebook, and it is a *teaching* list rather than an
 * examination of one patient: several entries describe a branch this run did not take, or describe
 * what would appear if the learner did something they may not have done. Rendered as one flat list
 * — which is what the bedside panel and the reference drawer did — the effect is that mutually
 * exclusive findings are all asserted as present, and for MV-13 the three candidate causes are
 * printed side by side with their internal branch names attached:
 *
 *   "Secretions branch: sawtooth flow/pressure and coarse airway sounds."
 *   "Tube/HME branch: suction catheter does not pass easily…"
 *   "Bronchospasm branch: diffuse wheeze…"
 *
 * The snapshot is SHA-256 pinned and must not be edited, so the classification is authored here
 * instead, by index, against the frozen file. A test holds every index in range.
 *
 * Three kinds:
 *
 * - `present`   — true of this patient now, whatever the run did.
 * - `byBranch`  — true only of the version of the case this run selected. Shown as the differential
 *                 before the cause is settled, and resolved afterwards.
 * - `onAction`  — what would appear *if* the learner does something. A prediction, not an
 *                 observation, and it stops being either once they have done it.
 */
import { mechanicalVentilationCaseById } from './runtimeCases'

export type FindingKind = 'present' | 'byBranch' | 'onAction'

interface CaseFindingPlan {
  /** Indices into the case's own `visibleFindings`, by kind. Anything unlisted is `present`. */
  readonly byBranch?: readonly number[]
  readonly onAction?: readonly number[]
}

/**
 * Only what the source text itself marks as conditional is reclassified — a named branch, or a
 * finding written as the consequence of an action ("if PEEP is raised", "when measured", "reveals",
 * "only if assessed"). Everything else stays present, because downgrading a real finding to a
 * hypothetical would be the same defect pointing the other way.
 */
const findingPlans: Readonly<Record<string, CaseFindingPlan>> = {
  // "…initially improves when PEEP is raised modestly" / "If PEEP is raised too aggressively…"
  'MV-01': { onAction: [2, 3] },
  // "A single prolonged patient effort spans both ventilator breaths" is present; the reported-VT
  // caveat is what the ventilator *may* report, which is a reading rather than a bedside finding.
  'MV-03': {},
  // "In advanced mode, EAdi rises…" needs monitoring this bedside does not carry by default.
  'MV-04': { onAction: [1] },
  // "An expiratory hold reveals total PEEP well above set PEEP."
  'MV-05': { onAction: [3] },
  // "Pplat is near normal when measured"; "Blood pressure improves transiently if the circuit is
  // disconnected".
  'MV-06': { onAction: [1, 3] },
  // "…contains water in branch A; …leak appears in branch B."
  'MV-08': { byBranch: [2] },
  // Every finding is the consequence of a rise-time setting: slow, overcorrected, or best.
  'MV-11': { onAction: [0, 1, 2] },
  // The three candidate causes, each labelled with its own branch name in the source text.
  'MV-13': { byBranch: [1, 2, 3] },
  // "Pain, urinary retention, disorientation, and poor sleep are discoverable only if assessed."
  'MV-15': { onAction: [3] },
}

export interface ClassifiedFinding {
  readonly text: string
  readonly kind: FindingKind
}

export function classifyCaseFindings(caseId: string): readonly ClassifiedFinding[] {
  const definition = mechanicalVentilationCaseById.get(caseId)
  if (!definition) return []
  const plan = findingPlans[caseId] ?? {}
  const byBranch = new Set(plan.byBranch ?? [])
  const onAction = new Set(plan.onAction ?? [])
  return definition.visibleFindings.map((text, index) => ({
    text,
    kind: byBranch.has(index) ? 'byBranch' : onAction.has(index) ? 'onAction' : 'present',
  }))
}

/* ------------------------------------------------------------------------------------------------
 * What this run's branch actually was, in learner-facing words
 * ---------------------------------------------------------------------------------------------- */

export interface BranchResolution {
  /** What this patient turned out to have. Never the internal branch identifier. */
  readonly cause: string
  /** The intervention effect that addresses it, for judging whether the learner's action fit. */
  readonly resolvedByEffectIds: readonly string[]
  /** Why the action worked, said in terms of the mechanism rather than of the branch. */
  readonly whenAddressed: string
  /** Why a plausible alternative action left the numbers where they were. */
  readonly whenNotAddressed: string
}

/**
 * Only two cases in the casebook have branches that change what is wrong with the patient and what
 * fixes it — `high-resistance` (MV-13) and `autotriggering` (MV-08). The others branch cosmetically
 * or not at all, so there is nothing to resolve and nothing that would explain a non-response.
 *
 * The internal token is the lookup key and never the output. A learner who worked out that the
 * obstruction was in the tube should read that back in those words, not as `hme-or-ett`.
 */
const branchResolutions: Readonly<Record<string, Readonly<Record<string, BranchResolution>>>> = {
  'MV-13': {
    secretions: {
      cause: 'Secretions in the airway and tube.',
      resolvedByEffectIds: ['suction-airway'],
      whenAddressed:
        'Clearing them removed the narrowing the gas had to be pushed through, so the pressure needed to deliver the same breath fell.',
      whenNotAddressed:
        'The obstruction was material sitting in the airway, so it stayed where it was until something removed it. A bronchodilator relaxes muscle it was not made of, and changing the tube does not clear what is inside the one you have.',
    },
    'hme-or-ett': {
      cause: 'The tube itself, or the filter on the end of it, was obstructed.',
      resolvedByEffectIds: ['remove-hme', 'reposition-ett'],
      whenAddressed:
        'Taking the obstruction out of the circuit restored the bore the gas travels through, and the pressure fell as soon as it did.',
      whenNotAddressed:
        'The narrowing was in the apparatus rather than in the patient, so treatments aimed at the airways had little to work on. This is the version of the case that a suction catheter refuses to pass, which is the finding that separates it.',
    },
    bronchospasm: {
      cause: 'Bronchospasm — the airways themselves were constricted.',
      resolvedByEffectIds: ['bronchodilator'],
      whenAddressed:
        'Relaxing the airway muscle widened the airways, and the pressure needed to move gas through them fell — over minutes rather than immediately, because the drug has to take effect.',
      whenNotAddressed:
        'The narrowing was in the airway walls, not in the tube and not from material that could be suctioned, so clearing the apparatus left the resistance almost where it was.',
    },
  },
  'MV-08': {
    condensate: {
      cause: 'Water in the circuit, oscillating near the flow sensor.',
      resolvedByEffectIds: ['drain-condensate'],
      whenAddressed:
        'Draining it removed the movement the flow sensor had been reading as the start of a breath.',
      whenNotAddressed:
        'The signal the ventilator kept answering was coming from the circuit rather than from the patient, so it continued until the circuit was dealt with.',
    },
    leak: {
      cause: 'A leak in the circuit.',
      resolvedByEffectIds: ['correct-leak'],
      whenAddressed:
        'Sealing it removed the continuing flow the ventilator had been mistaking for an inspiratory effort.',
      whenNotAddressed:
        'Gas escaping continuously looks to the trigger very much like a patient starting to breathe in, and it goes on doing so until the leak is found.',
    },
    'cardiogenic-oscillation': {
      cause: 'The heartbeat itself, transmitted to the airway and read as an effort.',
      resolvedByEffectIds: [],
      whenAddressed:
        'Making the trigger less sensitive raised the bar above the size of the cardiac oscillation, so the ventilator stopped answering it while still answering the patient.',
      whenNotAddressed:
        'There is nothing in the circuit to drain or seal here — the signal is real and it is the patient’s heart. This version is settled at the trigger setting rather than at the circuit.',
    },
  },
}

export function branchResolution(caseId: string, branch: string): BranchResolution | null {
  return branchResolutions[caseId]?.[branch] ?? null
}

/** Every case id that carries an authored branch resolution, for tests and coverage checks. */
export const branchResolvedCaseIds = Object.keys(branchResolutions)

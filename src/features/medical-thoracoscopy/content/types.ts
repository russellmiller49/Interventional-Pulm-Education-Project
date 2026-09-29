import type { ControlId } from './controlPanel'
import type { CopyExemption } from './learnerCopy'
import type { LandmarkId } from './landmarks'
import type { ModelBoundaryId } from './modelBoundaries'
import type { PleuralZoneId } from './pleuralZones'
import type { ThoracoscopySectionId } from './sectionIds'
import type { ThoracoscopySpinePhase } from './spine'
import type { TeachingExampleId } from './teachingExamples'

/**
 * The authoring contract for one Learn section, following the section authoring guide
 * (`docs/medical-thoracoscopy/section-authoring-guide.md`).
 *
 * A section is data: one file in `content/sections/`, checked by `sectionValidation.ts` when the
 * index imports it, so a problem fails the build instead of reaching a learner. The lesson that
 * shows a section is built separately; nothing here decides layout.
 *
 * Every statement the section makes points at the claim register by claim id, and the register
 * lists the section as a surface. A claim is not reviewed because a section cites it: every
 * decision stays NOT REVIEWED until a named reviewer records one.
 */

/** A claim register id, `MT-C-0000`. */
export type ClaimId = `MT-C-${string}`

/** The labels the fidelity contract allows on a screen, and nothing else. */
export const FIDELITY_LABELS = [
  'Derived from CT segmentation',
  'Authored construct',
  'Authored, illustrative',
  'Educational rendering from published dimensions',
  'Awaiting clinical review',
  'Not modeled',
] as const

export type FidelityLabel = (typeof FIDELITY_LABELS)[number]

/** Analogy, then the precise statement, then a checklist of four or fewer, then an application. */
export interface ConceptAnchor {
  readonly analogy: string
  readonly precise: string
  readonly checklistLabel: string
  readonly checklist: readonly string[]
  /** Where the learner uses it straight away, in one or two sentences. */
  readonly application: string
  readonly claimIds: readonly ClaimId[]
}

/** What a teaching block is for. A section shows the normal before anything else. */
export type BlockRole = 'framing' | 'normal-reference' | 'mechanism' | 'common-errors' | 'boundary'

export interface TeachingBlock {
  readonly id: string
  readonly role: BlockRole
  /**
   * Where the lesson places it by default: before the section's question or after it. A block after
   * the question can still be opened at any time; foundational teaching is never held back.
   */
  readonly when: 'before-question' | 'after-question'
  /** Visible heading. No digits. */
  readonly heading: string
  /** Paragraphs separated by a blank line. */
  readonly body: string
  /** A short list under the body. */
  readonly list?: {
    readonly label: string
    /** Eight or fewer. */
    readonly items: readonly string[]
  }
  /**
   * The lesson prints the seven region names under the body, in survey order, from
   * `pleural-zones.json`, so the names are never typed twice.
   */
  readonly zoneList?: true
  /** At least one. */
  readonly claimIds: readonly ClaimId[]
  readonly copyExemptions?: readonly CopyExemption[]
}

/** Shown in full; a valid alternative to answering a question. */
export interface WorkedExample {
  readonly heading: string
  readonly situation: string
  readonly steps: readonly { readonly action: string; readonly reason: string }[]
  readonly outcome: string
  readonly claimIds: readonly ClaimId[]
}

export type Plausibility = 'best' | 'reasonable-but-incomplete' | 'incorrect-mechanism' | 'unsafe'

export interface AuthoredChoice {
  /** 'a' to 'd'. The lesson may show them in another order; authored order carries no meaning. */
  readonly id: 'a' | 'b' | 'c' | 'd'
  readonly label: string
  /** Why this choice fits or does not, in terms of the situation. Never only "not this one". */
  readonly feedback: string
  /**
   * `best` exactly once. `unsafe` names a harmful move and says why at once; `incorrect-mechanism`
   * is a wrong picture of how something works; `reasonable-but-incomplete` is defensible and
   * short of the best.
   */
  readonly plausibility: Plausibility
}

/**
 * An optional question. The explanation can be read before answering, any answer can be changed,
 * and the question can be left. Nothing about it is counted or stored.
 */
export interface AuthoredQuestion {
  /** Unique in the module: `MT-Q-<section number>-<letter>`. */
  readonly id: string
  /**
   * A prediction comes before the teaching that answers it, so no block placed before the question
   * may carry its answer. A retrieval comes after the teaching, to use it straight away.
   */
  readonly kind: 'prediction' | 'retrieval'
  /** The teaching purpose that keeps it. Not shown to learners. */
  readonly purpose: string
  readonly stem: string
  /** Three or four. */
  readonly choices: readonly AuthoredChoice[]
  /** The mechanism, in two to four sentences. */
  readonly explanation: string
  /**
   * Words that would give the answer away. Each must match the best choice or the explanation. None
   * may appear in the section's title, objective, clinical question, activity prompt or this stem,
   * nor, for a prediction, in a block placed before the question.
   */
  readonly answerPhrases: readonly RegExp[]
  readonly claimIds: readonly ClaimId[]
}

/** The same principle in a different situation. Not the same stem with the nouns changed. */
export interface TransferQuestion extends AuthoredQuestion {
  readonly kind: 'retrieval'
  /** For the author and the reviewer: what differs from the section's own situation. Not shown. */
  readonly whatChanged: string
}

/** The tempting wrong move, with the risk said at once and what this model does. */
export interface HarmfulReflex {
  readonly move: string
  readonly risk: string
  /**
   * What the simulation does when the learner tries it. A consequence with no accepted claim is
   * "not modeled", and a refused movement is a limit of the model, never protection a device gives.
   */
  readonly inThisModel: string
  readonly claimIds: readonly ClaimId[]
}

/** A misconception recorded because it is real and documented. There is no quota. */
export interface Misconception {
  readonly belief: string
  readonly correction: string
  readonly claimIds: readonly ClaimId[]
}

/**
 * Where what the learner sees comes from, and the label the screen gives it. A device part points
 * at the device definitions, which hold their own facts and records; anything else at claims.
 */
export interface SectionSignal {
  readonly name: string
  readonly provenance: 'measured' | 'derived' | 'authored'
  readonly label: FidelityLabel
  readonly detail: string
  readonly claimIds: readonly ClaimId[]
  readonly deviceIds?: readonly string[]
}

// ── The section's own activity ───────────────────────────────────────────────────────────────

/** Section 6: the regions visited one after another, each with the landmark that names it. */
export interface TourActivity {
  readonly kind: 'tour'
  readonly prompt: string
  readonly stops: readonly {
    readonly zone: PleuralZoneId
    readonly landmarks: readonly LandmarkId[]
    /**
     * What to notice here, in one or two sentences. Shown once the learner has named the region or
     * asked, never before, since it names the landmark the learner is asked for.
     */
    readonly notice: string
  }[]
  readonly claimIds: readonly ClaimId[]
}

/** Section 7: aim at a region with the pivot, saying first which way the hand will go. */
export interface PivotActivity {
  readonly kind: 'pivot'
  readonly prompt: string
  readonly targets: readonly {
    readonly zone: PleuralZoneId
    /** Which way the hand moves, and why the tip goes the other way. Shown after the attempt. */
    readonly handAndTip: string
  }[]
  readonly claimIds: readonly ClaimId[]
}

/**
 * Section 11: every region in one order. The learner notes each region as seen, partly seen or not
 * seen, with a reason, and compares the note with the Chest view's estimate. The note is not stored.
 */
export interface SurveyActivity {
  readonly kind: 'survey'
  readonly prompt: string
  /** Every zone exactly once, in the order `pleural-zones.json` gives. */
  readonly order: readonly PleuralZoneId[]
  readonly claimIds: readonly ClaimId[]
}

export type SectionActivity = TourActivity | PivotActivity | SurveyActivity

// ── The section ───────────────────────────────────────────────────────────────────────────────

/**
 * A section. The lesson presents it in one of two default orders, set by the kind of its question,
 * and the learner may open any part at any time. In both, the teaching example, the objective, the
 * clinical question and the signals' labels come first, and the transfer comes last.
 *
 * - prediction: the blocks placed before the question; the question; then the new concept, the
 *   increment, the anchor, the blocks placed after it, the worked example, the activity with its
 *   controls and their descriptions, the misconceptions, the harmful reflex and what the model
 *   leaves out.
 * - retrieval: the new concept, the increment, the anchor, the blocks, the worked example, the
 *   activity with its controls, the misconceptions, the harmful reflex and what the model leaves
 *   out; then the question.
 */
export interface ThoracoscopySectionSpec {
  readonly id: ThoracoscopySectionId
  /** Raised whenever the section's teaching changes. */
  readonly revision: number
  /** The phase of the procedure the section sits at. */
  readonly spinePhase: ThoracoscopySpinePhase
  /** What the learner will be able to explain. One sentence. */
  readonly objective: string
  /** Earlier sections that help. A suggestion, never a lock. */
  readonly suggestedBackground: readonly ThoracoscopySectionId[]
  /** Exactly one idea. */
  readonly newConcept: string
  /** The new idea as a count against what came before: "the survey, plus one tool". */
  readonly increment: string
  /** The decision this section helps the learner make. */
  readonly clinicalQuestion: string
  readonly anchor: ConceptAnchor
  /** The labelled state the section opens from, when it opens from one. */
  readonly teachingExample: TeachingExampleId | null
  /**
   * The controls of the model the section shows, and those the learner can use in it. A control is
   * usable only in or after the section that teaches it.
   */
  readonly controls: {
    readonly shown: readonly ControlId[]
    readonly operable: readonly ControlId[]
  }
  readonly blocks: readonly TeachingBlock[]
  readonly workedExample: WorkedExample
  readonly activity: SectionActivity
  /** The optional question. */
  readonly question: AuthoredQuestion
  readonly transfer: TransferQuestion
  readonly harmfulReflex: HarmfulReflex
  readonly misconceptions: readonly Misconception[]
  /** What the model leaves out: shared statements by id, then this section's own. */
  readonly modelLeavesOut: {
    readonly shared: readonly ModelBoundaryId[]
    readonly section: readonly string[]
  }
  readonly signals: readonly SectionSignal[]
  /** The sections, practice scenarios and cases that use this section again. */
  readonly usedAgainBy: readonly string[]
}

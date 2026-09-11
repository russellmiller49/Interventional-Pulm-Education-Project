import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import type { StageBlockKind } from '@/features/learning-module/stage/StageTeachingScope'
import type { StageStepLocation } from '@/features/learning-module/stage/stageModel'

import type {
  AirwayLabel,
  ScopeGoal,
  ScopeMetricId,
  ScopeViewSpec,
} from '../components/scope/types'
import type { ClaimClass, SourceRef } from '../data/sources'
import type { ControlStrip } from './controlPanel'
import type { GrammarRowId } from './grammar'
import type { CopyExemption } from './learnerCopy'
import type { LocalPolicyId } from './localPolicies'
import type { MediaRef } from './media'
import type { RegisterExemption } from './reviewRegister'
import type { BronchSectionId } from './sectionIds'
import type { SpineStopId } from './spine'

/**
 * The authoring contract for one Learn section.
 *
 * A section is authored as one data file (`content/sections/<id>.ts`) against this shape and
 * validated at import by `sectionValidation.ts`. The adapter (`stageLessons.ts`) turns it into the
 * stage's steps — Recognize → Predict → Act → [Observe] → Explain → Transfer — so no component
 * authors a step and every section has the same shape. The fields follow the medical-education
 * lesson spec: one new concept, the clinical question, the commit point, at least two documented
 * wrong mental models, the harmful reflex, a transfer to a changed situation, the model boundary,
 * and a source for every claim.
 *
 * Words on a surface the learner sees before committing (titles, the objective, the "why", the
 * Recognize step, pre-commit teaching blocks, the workspace caption, the prediction stem) may not
 * carry the answer; each section lists the phrases that would, and the validator refuses them there.
 */

// ── Objectives and evidence ──────────────────────────────────────────────────────────────────────

/** How an objective's attainment could be shown. Only the first two are gathered by this app. */
export type EvidenceMethod =
  /** A committed prediction or item, explained afterwards. */
  | 'committed-explanation'
  /** A goal met in the simulator pane, with its assists and input mode recorded. */
  | 'simulated-navigation'
  /** A case decision in Practice or the capstone. */
  | 'case-decision'
  /** The hands must be observed by faculty; the app teaches the idea and cannot show the skill. */
  | 'observed-physical-skill-required'
  /** Taught here, shown elsewhere (supervised practice, institutional process). */
  | 'not-app-assessable'

export interface ObjectiveCoverage {
  /** Manifest objective id, verbatim ("M05-O3"). */
  readonly objectiveId: string
  /** The observable subtask or explanatory question in this section that addresses it. */
  readonly subtask: string
  readonly evidence: EvidenceMethod
}

// ── Items ────────────────────────────────────────────────────────────────────────────────────────

export type Plausibility = ClinicalLearningItem['choices'][number]['plausibility']

export interface AuthoredChoice {
  /** 'a' to 'd'. Display order is rotated at render; authored order carries no meaning. */
  readonly id: string
  readonly label: string
  /** Why this choice fits or does not, in terms of the observation, not "this is wrong". */
  readonly rationale: string
  /**
   * `best` exactly once. `unsafe` for the harmful reflex (the verdict names it as unsafe);
   * `incorrect-mechanism` for a documented wrong mental model; `reasonable-but-incomplete` for a
   * defensible half-answer.
   */
  readonly plausibility: Plausibility
}

export interface AuthoredItem {
  /** Stable and unique across the module: 'Q01'…'Q31' for adapted seeds, 'N01'… for new items. */
  readonly id: string
  /** The manifest seed this adapts, when it does. */
  readonly seedId?: string
  readonly itemType: Exclude<ClinicalLearningItem['itemType'], 'transfer-case'>
  /** A patient situation shown above the stem. Present → a patient item. */
  readonly situation?: string
  /** A still or photograph shown with the stem. */
  readonly media?: MediaRef
  readonly stem: string
  /** Three or four. */
  readonly choices: readonly AuthoredChoice[]
  /** Shown after commitment: the mechanism, in two to four sentences. */
  readonly explanation: string
  readonly objectiveIds: readonly string[]
  readonly claimClass: ClaimClass
  readonly sourceRefs: readonly SourceRef[]
  readonly reviewItemIds?: readonly string[]
  /** Refuted register phrases a rationale or the explanation may carry, each naming its R-item. */
  readonly registerExemptions?: readonly RegisterExemption[]
  readonly copyExemptions?: readonly CopyExemption[]
  /** When the answer is an airway, the map pin each choice corresponds to (answer on the map). */
  readonly choiceAirways?: Readonly<Record<string, AirwayLabel | null>>
}

export interface AuthoredTransferItem extends AuthoredItem {
  /** What changed from the prediction's situation: the same principle, a different case. */
  readonly transferVariant: string
  /** The earlier section whose idea this retrieves, when the transfer is a spaced replay. */
  readonly retrievesFrom?: BronchSectionId
}

// ── Teaching blocks ──────────────────────────────────────────────────────────────────────────────

/**
 * What a block is for. A section needs a normal reference or a worked example (normal before
 * broken), and a block on common errors and their correction.
 */
export type BlockRole =
  | 'framing'
  | 'signals'
  | 'normal-reference'
  | 'worked-example'
  | 'mechanism'
  | 'common-errors'
  | 'policy'
  | 'boundary'

export interface BronchTeachingBlock {
  readonly id: string
  /**
   * When the stage shows it. `question`, `signals`, `pattern` and `discriminators` are pre-commit
   * and leak-scanned; `after-commitment` opens at Explain; `boundary` opens at Explain.
   */
  readonly kind: StageBlockKind
  readonly role: BlockRole
  /** Visible heading; may be named as a Teaching-panel landmark. No digits. */
  readonly heading: string
  /** Paragraphs separated by a blank line. Plain clinical prose. */
  readonly body: string
  readonly pointsLabel?: string
  /** At most six. */
  readonly points?: readonly string[]
  readonly media?: MediaRef
  readonly claimClass: ClaimClass
  /** At least one, except for a `design` block. */
  readonly sourceRefs: readonly SourceRef[]
  /** Required when the claim class is `local-policy`. */
  readonly localPolicyIds?: readonly LocalPolicyId[]
  readonly reviewItemIds?: readonly string[]
  /** A `common-errors` block may name a refuted register phrase, with the R-item. */
  readonly registerExemptions?: readonly RegisterExemption[]
  readonly copyExemptions?: readonly CopyExemption[]
}

/** Analogy → precise statement → checklist of at most four (P2). Shown at Explain. */
export interface ConceptAnchor {
  readonly analogy: string
  readonly precise: string
  readonly checklistLabel: string
  readonly checklist: readonly string[]
}

// ── The Simulator panel ──────────────────────────────────────────────────────────────────────────

export type MonitorChannel =
  | 'responsiveness'
  | 'respiratory-effort'
  | 'airflow'
  | 'oximetry'
  | 'capnography'
  | 'heart-rate'
  | 'blood-pressure'
  | 'peak-pressure'
  | 'exhaled-volume'
  | 'airway-view'

export type MonitorTrend = 'steady' | 'rising' | 'falling' | 'lost' | 'new'

/** Scripted and in words: a trend against this patient's own earlier state, never a threshold. */
export interface MonitorReading {
  readonly channel: MonitorChannel
  readonly words: string
  readonly trend: MonitorTrend
}

/** What the Simulator panel shows while the section is being recognized, predicted and explained. */
export type BronchWorkspace =
  | { readonly kind: 'scope'; readonly view: ScopeViewSpec }
  | { readonly kind: 'media'; readonly media: readonly MediaRef[]; readonly caption: string }
  | { readonly kind: 'map'; readonly lit: readonly AirwayLabel[]; readonly caption: string }
  | {
      readonly kind: 'monitor'
      readonly readings: readonly MonitorReading[]
      readonly caption: string
    }

// ── Act kinds ────────────────────────────────────────────────────────────────────────────────────

export interface ScopeLabAct {
  readonly kind: 'scope-lab'
  readonly view: ScopeViewSpec
  /** All must be met; a goal made only of `without` tests is refused. */
  readonly goals: readonly ScopeGoal[]
  readonly observe?: {
    readonly view?: ScopeViewSpec
    readonly goals: readonly ScopeGoal[]
    readonly readouts?: readonly ScopeMetricId[]
  }
}

export interface BronchSortOrigin {
  readonly id: string
  readonly label: string
  readonly definition: string
}

export interface BronchSortRow {
  readonly id: string
  readonly statement: string
  readonly origin: string
  readonly rationale: string
}

export interface BronchSort {
  readonly id: string
  readonly prompt: string
  readonly origins: readonly BronchSortOrigin[]
  /** At least four; every origin is the answer to at least one row. */
  readonly rows: readonly BronchSortRow[]
  readonly sourceRefs: readonly SourceRef[]
}

export interface BronchIdentifyRow {
  readonly id: string
  readonly media: MediaRef
  readonly prompt: string
  /** Three to five. */
  readonly choices: readonly { readonly id: string; readonly label: string }[]
  readonly answerId: string
  /** Why, in landmarks and parentage — never "because it is". */
  readonly rationale: string
}

export interface BronchIdentify {
  readonly id: string
  readonly prompt: string
  readonly rows: readonly BronchIdentifyRow[]
  readonly sourceRefs: readonly SourceRef[]
}

export interface BronchSequenceStep {
  readonly id: string
  readonly label: string
  /** Why this step sits where it does; shown once the order holds. */
  readonly detail: string
}

export interface BronchSequence {
  readonly id: string
  readonly prompt: string
  /** Authored in the order that holds; shuffled at render. At least four. */
  readonly steps: readonly BronchSequenceStep[]
  readonly rationale: string
  /** Steps whose misplacement is a safety error, named as such in the feedback. */
  readonly criticalStepIds?: readonly string[]
  readonly sourceRefs: readonly SourceRef[]
}

/** One line of a shared accounting ledger (drill D19). Educational arithmetic, not a dose check. */
export type BronchLedgerRow =
  | {
      readonly id: string
      readonly kind: 'measured'
      readonly label: string
      readonly detail: string
      readonly concentrationMgPerMl: number
      readonly volumeMl: number
    }
  | {
      readonly id: string
      readonly kind: 'unknown'
      readonly label: string
      readonly detail: string
      /** Why the amount cannot be known from the record. */
      readonly reason: string
    }

export interface BronchLedger {
  readonly id: string
  readonly prompt: string
  /** Printed with the ledger: what the arithmetic is and is not. */
  readonly boundary: string
  readonly rows: readonly BronchLedgerRow[]
  /** The learner enters milligrams for each measured row, then answers this. */
  readonly totalPrompt: string
  readonly totalChoices: readonly AuthoredChoice[]
  /** True when an unknown row means no total can be stated; must agree with the rows. */
  readonly totalIsUnknown: boolean
  readonly sourceRefs: readonly SourceRef[]
  readonly localPolicyIds: readonly LocalPolicyId[]
}

export interface BronchReportOption {
  readonly id: string
  readonly label: string
  /** Whether the evidence supports writing this. An unsupported choice is refused, with why. */
  readonly supported: boolean
  readonly rationale: string
}

export interface BronchReportField {
  readonly id: string
  readonly label: string
  /** What the record or image shows for this field, in words. */
  readonly evidence: string
  readonly options: readonly BronchReportOption[]
}

export interface BronchReport {
  readonly id: string
  readonly prompt: string
  readonly evidenceTitle: string
  readonly media?: readonly MediaRef[]
  /** At least three; each with at least one supported and one unsupported option. */
  readonly fields: readonly BronchReportField[]
  readonly sourceRefs: readonly SourceRef[]
}

export interface BronchScenarioFrame {
  readonly id: string
  readonly situation: string
  readonly readings: readonly MonitorReading[]
  readonly media?: MediaRef
  readonly prompt: string
  /**
   * Exactly one `best`, which advances the scenario. An `unsafe` choice is refused with its
   * rationale and the frame stays; it can never complete the step (A13, A32).
   */
  readonly choices: readonly AuthoredChoice[]
  readonly registerExemptions?: readonly RegisterExemption[]
}

export interface BronchScenario {
  readonly id: string
  /** Names the situation. No digits. */
  readonly title: string
  /** Printed with the monitor: the values are scripted for teaching, not a physiological model. */
  readonly boundary: string
  /** At least two. */
  readonly frames: readonly BronchScenarioFrame[]
  readonly sourceRefs: readonly SourceRef[]
}

export type BronchAct =
  | ScopeLabAct
  | { readonly kind: 'sort'; readonly sort: BronchSort }
  | { readonly kind: 'identify'; readonly identify: BronchIdentify }
  | { readonly kind: 'sequence'; readonly sequence: BronchSequence }
  | { readonly kind: 'ledger'; readonly ledger: BronchLedger }
  | { readonly kind: 'report'; readonly report: BronchReport }
  | { readonly kind: 'scenario'; readonly scenario: BronchScenario }

export type BronchActKind = BronchAct['kind']

// ── Steps, practice, the section ─────────────────────────────────────────────────────────────────

export interface AuthoredStepText {
  /** No digits. Recognize's title is the section's `recognizeTitle`. */
  readonly title: string
  /** One or two sentences, naming the surface ("in the airway map, …"). */
  readonly instruction: string
  readonly lookIn: StageStepLocation
}

export interface BronchStepTexts {
  readonly recognize: Omit<AuthoredStepText, 'title'>
  readonly act: AuthoredStepText
  /** Required for a scope-lab with an `observe`; refused otherwise. */
  readonly observe?: AuthoredStepText
  readonly explain: Omit<AuthoredStepText, 'lookIn'>
}

export interface AuthoredMicroCase {
  /** The manifest case id when adapted ('C02'), or 'mc-<slug>'. */
  readonly id: string
  readonly manifestCaseId?: string
  /** Names the situation, never the mechanism or the decision. No digits. */
  readonly presentationTitle: string
  /** The signals in the room, before interpretation. */
  readonly situation: string
  /** One decision. Its own `situation` is left out; the case's situation is shown instead. */
  readonly item: AuthoredItem
}

export interface BronchSectionDefinition {
  readonly id: BronchSectionId
  /** Names the topic, never the answer. No digits. */
  readonly title: string
  readonly shortTitle: string
  readonly minutes: number
  readonly moduleIds: readonly string[]
  /** Every objective this section is the primary home of, each with its observable subtask. */
  readonly objectives: readonly ObjectiveCoverage[]
  readonly drillIds: readonly string[]
  readonly prerequisites: readonly BronchSectionId[]

  /** The decision this section lets the learner make. Pre-commit. */
  readonly clinicalQuestion: string
  /** The Recognize step's title, in presentation terms. Pre-commit. No digits. */
  readonly recognizeTitle: string
  /** The discrimination the section enables. Pre-commit; never opens with the answer. */
  readonly objective: string
  /** Why it matters at the bedside, in one or two sentences. Pre-commit. */
  readonly why: string
  /** Exactly one idea. Shown at Explain. */
  readonly newConcept: string
  /** "This section adds one idea to the last: …" Shown at Explain. */
  readonly incrementSentence: string
  /** The tempting wrong move. The Act and the items must not reward it. */
  readonly harmfulReflex: string
  readonly anchor: ConceptAnchor

  readonly spineStops: readonly SpineStopId[]
  readonly grammarRowIds: readonly GrammarRowId[]
  readonly controlStrip: ControlStrip
  /** Phrases naming the keyed answer; no pre-commit surface may carry one. Each must match the key. */
  readonly precommitDenyPatterns: readonly RegExp[]
  /** What the model and the section do not represent. Printed under the scene and at Explain. */
  readonly modelBoundary: string
  /** Required when an objective needs observed physical skill: what the app cannot see. */
  readonly physicalSkillNote?: string
  readonly localPolicyIds: readonly LocalPolicyId[]
  readonly reviewItemIds: readonly string[]

  readonly blocks: readonly BronchTeachingBlock[]
  readonly workspace: BronchWorkspace
  readonly steps: BronchStepTexts
  readonly act: BronchAct
  readonly prediction: AuthoredItem
  readonly transfer: AuthoredTransferItem
  /** One-decision cases paired by mechanism; at least one for mechanism and application sections. */
  readonly practice: readonly AuthoredMicroCase[]
}

/** A capstone case: decided once, in one sitting, debriefed at the end (content/capstone.ts). */
export interface AuthoredCapstoneCase {
  readonly id: string
  readonly presentationTitle: string
  readonly situation: string
  readonly item: AuthoredItem
  /** A decision here that does not hold is a safety error; the standard cannot be met with one. */
  readonly critical: boolean
  readonly pairedSectionId: BronchSectionId
}

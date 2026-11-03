import type { CriticalCareCurriculumStage } from '@/features/learning-module/activity/types'
import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import type { StageBlockKind } from '@/features/learning-module/stage/StageTeachingScope'

import type { DolphinSourceId } from '../data/sources'
import type { ScopeGoal } from '../engine/scopeGoals'
import type { DolphinObjectiveId } from './objectives'
import type { DolphinSectionId } from './sectionIds'

/**
 * The authoring contract for the Dolphin Bronchoscopy module.
 *
 * A section is one data file (`content/sections/<id>.ts`) against `DolphinSectionDefinition`,
 * validated at import (`stageLessons.ts`). The adapter turns it into the stage's steps —
 * Recognize → Predict → Act → Explain → Transfer — so no component authors a step and every
 * section has the same shape.
 *
 * Words on a surface the learner sees before committing (the title, the clinical question, the
 * anchor, pre-commit teaching blocks, the workspace caption, the act prompt, frame alt text, the
 * prediction stem) may not carry the answer; each section lists the phrases that would
 * (`precommitDenyPatterns`), and the validator refuses them there.
 */

// ── Numbers ─────────────────────────────────────────────────────────────────────────────────────

/** A row id in `teachingNumbers.ts`. Kept as a string here to avoid an import cycle. */
export type DolphinNumberId = string

// ── Media ───────────────────────────────────────────────────────────────────────────────────────

/** A frame from `frameBank.ts`, shown with a teaching block or an item. */
export interface DolphinMediaRef {
  readonly frameId: string
}

// ── The memory hook ─────────────────────────────────────────────────────────────────────────────

/** An analogy, one precise sentence and a checklist of at most four. */
export interface ConceptAnchor {
  /** At most 35 words. An aid, never the definition. */
  readonly analogy: string
  readonly precise: string
  readonly checklistLabel: string
  /** At most four. Repeated on the completion card. */
  readonly checklist: readonly string[]
}

// ── Teaching blocks ─────────────────────────────────────────────────────────────────────────────

export type DolphinBlockRole =
  | 'framing'
  | 'signals'
  | 'normal-reference'
  | 'worked-example'
  | 'mechanism'
  | 'common-errors'
  | 'first-moves'
  | 'policy'

export interface DolphinTeachingBlock {
  readonly id: string
  /**
   * When the stage shows it. `question`, `signals`, `pattern` and `discriminators` are pre-commit
   * and leak-scanned; `after-commitment` opens at Explain.
   */
  readonly kind: StageBlockKind
  readonly role: DolphinBlockRole
  /** Visible heading; no digits. */
  readonly heading: string
  /** Paragraphs separated by a blank line. */
  readonly body: string
  /** At most six. */
  readonly points?: readonly string[]
  readonly media?: DolphinMediaRef
  /** Register rows whose values the copy states. Every digit in the copy must come from one. */
  readonly numberIds?: readonly DolphinNumberId[]
  readonly sourceIds: readonly DolphinSourceId[]
}

/** What you do first, in order, for one row of the trouble grammar. */
export interface FirstMoveCard {
  readonly id: string
  readonly troubleRowId: string
  readonly heading: string
  readonly steps: readonly string[]
  /** When to call for help, and for whom. */
  readonly callForHelp: string
  readonly sourceIds: readonly DolphinSourceId[]
}

// ── Items ───────────────────────────────────────────────────────────────────────────────────────

export type Plausibility = ClinicalLearningItem['choices'][number]['plausibility']

export interface AuthoredChoice {
  /** 'a' to 'd'. Display order is rotated at render; authored order carries no meaning. */
  readonly id: string
  readonly label: string
  /** Why this choice fits or does not, in terms of the observation — never "this is wrong". */
  readonly rationale: string
  /**
   * `best` exactly once. `unsafe` only for the section's harmful reflex; `incorrect-mechanism` for a
   * documented wrong mental model; `reasonable-but-incomplete` for a defensible half-answer.
   */
  readonly plausibility: Plausibility
}

export interface AuthoredItem {
  readonly id: string
  readonly itemType: Exclude<ClinicalLearningItem['itemType'], 'transfer-case'>
  /** An animal, a room or a view, shown above the stem. */
  readonly situation?: string
  readonly media?: DolphinMediaRef
  readonly stem: string
  /** Exactly four. */
  readonly choices: readonly AuthoredChoice[]
  /** Shown after commitment, or on request: the mechanism, in two to four sentences. */
  readonly explanation: string
  readonly objectiveIds: readonly DolphinObjectiveId[]
  readonly sourceIds: readonly DolphinSourceId[]
  readonly numberIds?: readonly DolphinNumberId[]
}

export interface AuthoredTransferItem extends AuthoredItem {
  /** What changed from the prediction's situation: the same principle, a different case. */
  readonly transferVariant: string
  /** The earlier sections whose ideas this retrieves, when the transfer is a spaced replay. */
  readonly retrievesFrom?: readonly DolphinSectionId[]
}

export interface DolphinMicroCase {
  readonly id: string
  readonly sectionId: DolphinSectionId
  /** Names the situation, never the mechanism or the decision. No digits. */
  readonly presentationTitle: string
  /** The signals in the room, before interpretation. At most sixty words with the stem. */
  readonly situation: string
  /** One decision. */
  readonly item: AuthoredItem
  /** The trouble-grammar row the debrief highlights, when there is one. */
  readonly troubleRowId?: string
  readonly media?: DolphinMediaRef
}

// ── The Simulator panel ─────────────────────────────────────────────────────────────────────────

export type ScopeStartId =
  | 'naris'
  | 'nasopharynx'
  | 'spout-approach'
  | 'larynx'
  | 'trachea-mid'
  | 'carina'
  | 'rmb-origin'
  | 'lmb-origin'

export type AnatomyPresetId = 'airway-in-body' | 'lungs-and-ribs' | 'spout-in-skull'

/** A stop on the passage, the module's spine. */
export type SpineStopId =
  | 'blowhole'
  | 'nasal-passage'
  | 'nasopharynx'
  | 'spout'
  | 'larynx'
  | 'trachea'
  | 'tracheal-bronchus'
  | 'carina'
  | 'main-bronchi'

export interface DolphinScopeWorkspace {
  readonly kind: 'scope'
  readonly start: ScopeStartId
  /** `learner` keeps the module's own checkbox. */
  readonly labels: 'shown' | 'hidden' | 'learner'
  readonly showLocation: boolean
  /** Load the linked CT (about 31 MB). Off unless the section reads the CT. */
  readonly ct?: boolean
  /** Show the 3D tree beside the view. */
  readonly tree?: boolean
  /** Show the authored breathing cue over the view. */
  readonly breathCue?: boolean
  /** One line under the panel: what it shows. Pre-commit. */
  readonly caption: string
}

export type DolphinWorkspace =
  | DolphinScopeWorkspace
  | { readonly kind: 'anatomy'; readonly preset: AnatomyPresetId; readonly caption: string }
  | { readonly kind: 'frame'; readonly frameId: string; readonly caption: string }
  /** The passage drawn as its stops, with the section's stops lit. Never a blank panel. */
  | { readonly kind: 'passage'; readonly lit: readonly SpineStopId[]; readonly caption: string }

// ── Acts ────────────────────────────────────────────────────────────────────────────────────────

export interface DolphinSortOrigin {
  readonly id: string
  readonly label: string
  readonly definition: string
}

export interface DolphinSortRow {
  readonly id: string
  readonly statement: string
  readonly origin: string
  readonly rationale: string
}

export interface DolphinSort {
  readonly id: string
  readonly prompt: string
  readonly origins: readonly DolphinSortOrigin[]
  /** At least four; every origin is the answer to at least one row. */
  readonly rows: readonly DolphinSortRow[]
  readonly sourceIds: readonly DolphinSourceId[]
  readonly numberIds?: readonly DolphinNumberId[]
}

export interface DolphinSequenceStep {
  readonly id: string
  readonly label: string
  /** Why this step sits where it does; shown once the order is checked. */
  readonly detail: string
}

export interface DolphinSequence {
  readonly id: string
  readonly prompt: string
  /** Authored in the order that holds; shuffled at render. At least four. */
  readonly steps: readonly DolphinSequenceStep[]
  readonly rationale: string
  /** Steps whose misplacement is a safety error, named as such in the feedback. */
  readonly criticalStepIds?: readonly string[]
  readonly sourceIds: readonly DolphinSourceId[]
  readonly numberIds?: readonly DolphinNumberId[]
}

export interface DolphinScenarioFrame {
  readonly id: string
  /** When this is, in the case's own time. */
  readonly time?: string
  readonly situation: string
  readonly media?: DolphinMediaRef
  readonly prompt: string
  /**
   * Exactly one `best`, which advances. An `unsafe` choice is refused with its rationale and the
   * frame stays. Any other shows its rationale and the learner chooses again.
   */
  readonly choices: readonly AuthoredChoice[]
  /** The trouble-grammar row this frame turns on. */
  readonly troubleRowId?: string
}

export interface DolphinScenario {
  readonly id: string
  /** Names the situation. No digits. */
  readonly title: string
  /** At least two. */
  readonly frames: readonly DolphinScenarioFrame[]
  readonly sourceIds: readonly DolphinSourceId[]
}

export interface DolphinIdentifyRow {
  readonly id: string
  readonly frameId: string
  readonly prompt: string
  /** Three to five abbreviations or names. */
  readonly choices: readonly { readonly id: string; readonly label: string }[]
  readonly answerId: string
  /** Why, in landmarks and order — never "because it is". */
  readonly rationale: string
}

export interface DolphinIdentify {
  readonly id: string
  readonly prompt: string
  readonly rows: readonly DolphinIdentifyRow[]
  readonly sourceIds: readonly DolphinSourceId[]
}

export interface AnatomyPickPrompt {
  readonly id: string
  /** "Pick the structure the scope enters at the top of the head." */
  readonly prompt: string
  /** A structure id of the dolphin 3D model. */
  readonly answerId: string
  readonly rationale: string
}

export type DolphinAct =
  | {
      readonly kind: 'scope-lab'
      /** What to do, in one or two sentences. Pre-commit. */
      readonly prompt: string
      /** All must be met. */
      readonly goals: readonly ScopeGoal[]
    }
  | {
      readonly kind: 'branch-drill'
      readonly prompt: string
      readonly set: string
      readonly count: number
    }
  | { readonly kind: 'identify'; readonly identify: DolphinIdentify }
  | {
      readonly kind: 'anatomy-pick'
      readonly prompt: string
      readonly preset: AnatomyPresetId
      readonly prompts: readonly AnatomyPickPrompt[]
      readonly sourceIds: readonly DolphinSourceId[]
    }
  | { readonly kind: 'sort'; readonly sort: DolphinSort }
  | { readonly kind: 'sequence'; readonly sequence: DolphinSequence }
  | { readonly kind: 'calculate'; readonly prompt: string; readonly ledgerId: string }
  | {
      readonly kind: 'report'
      readonly prompt: string
      readonly templateId: 'nmmp-2019' | 'tursiops-draft'
      /** Pre-fill "reached" from the survey driven in this step. */
      readonly fromSurvey: boolean
      /** The survey to drive before writing, in its fixed order. Met goals are not required to write. */
      readonly surveyGoals: readonly ScopeGoal[]
    }
  | { readonly kind: 'scenario'; readonly scenario: DolphinScenario }
  | { readonly kind: 'read'; readonly prompt: string }

export type DolphinActKind = DolphinAct['kind']

// ── The section ─────────────────────────────────────────────────────────────────────────────────

export interface DolphinSectionDefinition {
  readonly id: DolphinSectionId
  /** Names the situation, never the answer. No digits. */
  readonly title: string
  /** At most three words. */
  readonly shortTitle: string
  readonly minutes: number
  /** The measured time the activities take, apart from reading. */
  readonly activityMinutes: number
  readonly stage: CriticalCareCurriculumStage
  readonly objectiveIds: readonly DolphinObjectiveId[]
  readonly prerequisites: readonly DolphinSectionId[]
  /** One sentence on what the section adds. Shown in the outline and the hub. */
  readonly summary: string

  /** The decision this section lets the learner make. Pre-commit. */
  readonly clinicalQuestion: string
  /** Exactly one idea. "none" for an integration section, which applies earlier ones. */
  readonly newConcept: string
  /** "This section adds one idea to the last: …" */
  readonly incrementSentence?: string
  /** The tempting wrong move. The act and the items must not reward it. */
  readonly harmfulReflex: string
  /** Phrases naming the harmful reflex; a choice is `unsafe` only when its label matches one. */
  readonly harmfulReflexPatterns?: readonly RegExp[]
  readonly anchor: ConceptAnchor

  readonly blocks: readonly DolphinTeachingBlock[]
  readonly workspace: DolphinWorkspace
  readonly act: DolphinAct
  /** The Recognize step's instruction, naming the surface. Pre-commit. */
  readonly recognizeInstruction: string
  readonly prediction: AuthoredItem
  readonly transfer: AuthoredTransferItem
  /** Three to five one-decision cases for the planning, procedure and trouble sections. */
  readonly practice: readonly DolphinMicroCase[]
  readonly firstMoves?: readonly FirstMoveCard[]
  /** Phrases naming the keyed answer; no pre-commit surface may carry one. */
  readonly precommitDenyPatterns: readonly RegExp[]
  readonly sourceIds: readonly DolphinSourceId[]
}

// ── Integrated cases (Assess) ───────────────────────────────────────────────────────────────────

export interface DolphinIntegratedFrame {
  readonly id: string
  /** When this is, in the case's own time: "Day before", "At the spout". */
  readonly time: string
  readonly situation: string
  readonly media?: DolphinMediaRef
  readonly prompt: string
  /** Exactly four; exactly one `best`. The verdict shows at once; the debrief waits for the end. */
  readonly choices: readonly AuthoredChoice[]
  /** The trouble-grammar row the frame turns on, when it does. */
  readonly troubleRowId?: string
}

export interface DolphinIntegratedCase {
  readonly id: string
  /** Names the situation, never the answer. No digits. */
  readonly title: string
  /** The animal and the setting, before the first frame. */
  readonly situation: string
  /** Three to five. */
  readonly frames: readonly DolphinIntegratedFrame[]
  /** The decision of the five (`decisions.ts`) the case turns on. */
  readonly decisionId:
    | 'go'
    | 'topical-or-sedation'
    | 'spout-timing'
    | 'next-site'
    | 'continue-or-stop'
  /** The sections it draws on, for the debrief's links. */
  readonly sectionIds: readonly DolphinSectionId[]
  readonly objectiveIds: readonly DolphinObjectiveId[]
  /** Shown only after the last frame: what the case was about, in two to four sentences. */
  readonly debrief: string
  readonly numberIds?: readonly DolphinNumberId[]
  readonly sourceIds: readonly DolphinSourceId[]
}

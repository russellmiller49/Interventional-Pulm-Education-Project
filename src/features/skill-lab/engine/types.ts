/**
 * Shared types for the "skill lab" interactive Practice primitives.
 *
 * These are the generic, module-agnostic shapes behind three reusable drills:
 *   1. Step sequencing  — drag/keyboard-order the steps of a procedure.
 *   2. Decision scenario — a branching, optionally-timed clinical
 *      recognition-and-management drill (the procedural-complication trainer).
 *   3. Equipment labeling — click hotspots on a neutral equipment diagram.
 *
 * Discipline (mirrors the pleural scoring-engine pattern): pure functions and
 * types live in `engine/`, React lives in `components/`, and all state is held
 * in memory. Consuming modules (pleuroscopy, rigid bronchoscopy, EBUS, …)
 * author data that conforms to these shapes; they never fork the engine.
 *
 * Audience & scope: cognitive/procedural-knowledge trainers for board-certified
 * or board-eligible pulmonologists and IP fellows in an accredited program,
 * used under faculty supervision. Simulation only — no device is operated and
 * no patient is treated.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Step sequencing
// ─────────────────────────────────────────────────────────────────────────────

export interface SequenceStep {
  id: string
  label: string
  /** Teaching note shown after grading (why this step sits where it does). */
  detail?: string
}

export interface StepSequence {
  id: string
  title: string
  prompt: string
  /** Authored in the CORRECT order; the UI shuffles for presentation. */
  steps: readonly SequenceStep[]
  /** Why the order matters — revealed on completion. */
  rationale: string
}

export interface SequenceScore {
  /** How many steps the learner placed in their correct position. */
  correctPositions: number
  total: number
  /** Index of the first out-of-place step, or null if fully correct. */
  firstErrorIndex: number | null
  passed: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision scenarios (branching, optionally timed)
// ─────────────────────────────────────────────────────────────────────────────

/** Simulated physiologic snapshot shown as a trend during a scenario. */
export interface Vitals {
  spo2: number
  hr: number
  sbp: number
}

export interface ScenarioChoice {
  id: string
  label: string
  /** Rationale shown regardless of correctness (commit-first teaching). */
  feedback: string
  isSafe: boolean
  /**
   * Simulated physiologic response applied when this choice is taken — used to
   * model how an unsafe or delayed decision moves the vitals trend. Optional;
   * omitted for neutral choices.
   */
  vitalsDelta?: Partial<Vitals>
  /** Next node id, or null for a terminal (the node must then be terminal). */
  nextNodeId: string | null
}

export interface ScenarioTerminal {
  outcome: 'rescued' | 'harm' | 'mixed'
  debrief: string
  referenceIds: string[]
}

export interface ScenarioNode {
  id: string
  situation: string
  /** Per-node countdown; on expiry the worst safe-or-least-bad branch applies. */
  decisionSeconds?: number
  choices: readonly ScenarioChoice[]
  /** Present on terminal nodes; a terminal node needs no choices to be taken. */
  terminal?: ScenarioTerminal
}

export interface DecisionScenario {
  id: string
  title: string
  briefing: string
  initialVitals: Vitals
  startNodeId: string
  nodes: readonly ScenarioNode[]
}

export interface ScenarioState {
  nodeId: string
  vitals: Vitals
  /** Chosen choice ids in order, for the debrief report card. */
  history: string[]
  finished: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Equipment labeling
// ─────────────────────────────────────────────────────────────────────────────

export interface EquipmentHotspot {
  id: string
  label: string
  /** Position on the diagram, 0–100 (percent of width / height). */
  xPct: number
  yPct: number
  /** Function / teaching note revealed once the hotspot is identified. */
  description: string
}

export interface EquipmentMap {
  id: string
  title: string
  /**
   * Neutral diagram. Its `imageAlt` must NOT name the hotspots — the alt text
   * cannot leak the answers a learner is being asked to place.
   */
  imageSrc: string
  imageAlt: string
  hotspots: readonly EquipmentHotspot[]
}

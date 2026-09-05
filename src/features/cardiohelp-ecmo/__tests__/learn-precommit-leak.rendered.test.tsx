import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import {
  buildDrillStageLesson,
  resolveGuidedLesson,
} from '../components/stage/adapters/drillStageAdapter'
import { resolveGuidedSimulatorTask } from '../components/stage/drillControlResolver'
import type { StageLesson, StageStep } from '../components/stage/stageModel'
import { circuitMapEmphasisCaption } from '../components/circuit-map/circuitMapEmphasis'
import { ecmoCircuitSegment, resolveEcmoModeText } from '../content/circuitSegments'
import { ecmoDrillSpec, ecmoDrillSpecs } from '../content/drillSpecs'
import { ecmoLocalizationRow } from '../content/localizationCards'
import { ECMO_TRANSFER_STEP_TITLE } from '../content/learnLessons'
import {
  cardiohelpScenarioById,
  predictionControls,
  predictionDirections,
  predictionGoals,
} from '../content/scenarios'
import type { GuidedControlId, SimulationAction } from '../engine/types'
import {
  latestState,
  mountDrill,
  nowPrimary,
  nowStatus,
  resetStageHarness,
} from '../test-support/learnStageHarness'

/**
 * I3d, rendered half — nothing on the Learn stage answers a drill before its prediction is taken.
 *
 * `learn-precommit-leak.test.ts` holds the authored registries to each drill's deny patterns. This
 * suite holds the *composed document* to the same patterns: every drill is mounted on the real stage
 * over the real session core, the real console, the real circuit map, gas panel, monitor and trends
 * (only the WebGL leaf is mocked), and the whole DOM is scanned at the two moments a learner reads
 * before committing — the first step on mount, and the prediction step, reached the way a learner
 * reaches it. Hidden DOM counts: a closed disclosure, a collapsed teaching block, a `hidden` surface
 * and an SVG description are all one interaction from the screen, and a status chip or an alarm
 * line that names the fault is the leak the pure-content scan cannot see.
 *
 * The deny set per drill is the spec's `precommitDenyPatterns`, the scenario's diagnosis and every
 * sentence of its causal chain and fitting response, the expected goal/control/direction labels in
 * the words the module echoes a commitment in, and the constant transfer-step title. The prediction
 * fieldset is the one surface excused: its options necessarily print every candidate move without
 * identifying the keyed one.
 *
 * Signal words stay allowed. pVen, flow, sweep, chatter, saturation and the pressure names are what
 * the learner is asked to read; the patterns name diagnoses, mechanisms and moves.
 */

/*
 * Twenty drills, two of them console tours of a dozen steps each with a `waitFor` at most of them.
 * Isolated the whole suite runs in well under a minute; under full-suite worker contention a single
 * tour can take several seconds.
 */
jest.setTimeout(60_000)

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

// The one permitted mock: the 3D canvas needs WebGL. Everything else renders for real.
jest.mock('../components/EcmoCircuit3D', () => ({
  EcmoCircuit3D: () => <div data-testid="ecmo-circuit-3d" />,
}))

const DRILL_IDS: readonly string[] = Object.keys(ecmoDrillSpecs)

type Moment = 'first step' | 'prediction step'

/* ------------------------------------------------------------------ *
 * Known pre-commit disclosures
 * ------------------------------------------------------------------ */

interface KnownDisclosure {
  readonly drills: readonly string[]
  /** Case-insensitive substring of a scanned unit. A unit carrying it is excused from the scan. */
  readonly text: string
  readonly kind: 'content' | 'control'
  readonly reason: string
}

/**
 * Disclosures the scan finds and this increment does not close, each with its owner named.
 *
 * Every entry must still fire for every drill it lists, or the test fails: an excuse that no longer
 * excuses anything is deleted, not carried. The `content` entries belong to the content owner and
 * are reported, not edited, by the component pass; the `control` entries are the simulator's own
 * operable controls, listed string by string so a new label cannot shelter behind a category.
 */
const KNOWN_DISCLOSURES: readonly KnownDisclosure[] = [
  {
    // TODO(owner decision): the circuit panel's own check control. It exists on every lesson, its
    // label is the resolver's instruction for the respond step and is pinned by
    // orientation-startup-state.test.tsx. Options: a neutral pre-commit label, or leaving a bedside
    // control its bedside name.
    drills: ['startup-sensor-orientation', 'va-startup-sensor-orientation'],
    text: 'Perform tip-to-tip circuit and sensor check',
    kind: 'control',
    reason: 'label of the operable circuit-check control on the circuit surface',
  },
  {
    // TODO(owner decision): the gas panel's restore control appears exactly while the source is
    // down and names the fix. Its label is the resolver's instruction for the respond step and is
    // pinned by learn-walkthrough.test.tsx; the transfer into this drill is already a labelled
    // worked example. Options: withhold the control until the prediction is committed, or keep it.
    drills: ['gas-source-interruption', 'va-gas-source-interruption'],
    text: 'Restore verified gas source',
    kind: 'control',
    reason: 'label of the operable restore control on the gas surface',
  },
]

function knownDisclosuresFor(scenarioId: string): readonly KnownDisclosure[] {
  return KNOWN_DISCLOSURES.filter((entry) => entry.drills.includes(scenarioId))
}

/* ------------------------------------------------------------------ *
 * The deny set
 * ------------------------------------------------------------------ */

interface DenySet {
  readonly patterns: readonly RegExp[]
  /** Phrases denied as case-insensitive, whitespace-normalised substrings. */
  readonly phrases: readonly { readonly where: string; readonly text: string }[]
}

function normalise(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()
}

function sentences(text: string): readonly string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function denySetFor(scenarioId: string): DenySet {
  const scenario = cardiohelpScenarioById.get(scenarioId)
  if (!scenario) throw new Error(`No scenario ${scenarioId}`)
  const spec = ecmoDrillSpec(scenarioId)
  const { expectation, debrief } = scenario

  const phrases: { where: string; text: string }[] = [
    { where: 'debrief.diagnosis', text: debrief.diagnosis },
    ...debrief.causalChain.flatMap((link) =>
      sentences(link).map((text) => ({ where: 'debrief.causalChain', text })),
    ),
    ...debrief.correctWorkflow.flatMap((line) =>
      sentences(line).map((text) => ({ where: 'debrief.correctWorkflow', text })),
    ),
    { where: 'transfer step title', text: ECMO_TRANSFER_STEP_TITLE },
  ]

  const goalLabel = predictionGoals.find((goal) => goal.id === expectation.goalId)?.label
  if (goalLabel) phrases.push({ where: 'expected goal label', text: goalLabel })
  const controlLabel = predictionControls.find(
    (control) => control.value === expectation.control,
  )?.label
  if (controlLabel) phrases.push({ where: 'expected control label', text: controlLabel })
  // A one-word direction ("Increase", "Decrease") is ordinary console vocabulary — the rotary's
  // own buttons say it — so a bare direction is denied only when the module's label for it is a
  // phrase. The control label above catches the committed-triple echo either way.
  const directionLabel = predictionDirections.find(
    (direction) => direction.value === expectation.direction,
  )?.label
  if (directionLabel && /\s/.test(directionLabel)) {
    phrases.push({ where: 'expected direction label', text: directionLabel })
  }

  /*
   * The map's own reveal. Once the learner commits, the pressure-zone map marks the row's places
   * and captions them "Implicated on this map: …". That sentence, and the labels of the places it
   * names, are answers this scan would not otherwise know about — the deny patterns are written
   * against the debrief, not the map — so a drill with a row adds them here. Segment ids are not
   * denied: they are also how the walk names where it is standing, before anything is asked.
   */
  if (spec.localizationRowId) {
    const implicated = { kind: 'implicated', rowId: spec.localizationRowId } as const
    const caption = circuitMapEmphasisCaption(implicated, scenario.supportMode, {
      sensorFlagsDrawn: false,
    })
    if (caption) phrases.push({ where: 'map implicated caption', text: caption })
    for (const segmentId of ecmoLocalizationRow(spec.localizationRowId).implicatedSegmentIds) {
      phrases.push({
        where: `map implicated segment ${segmentId}`,
        text: `Implicated on this map: ${resolveEcmoModeText(ecmoCircuitSegment(segmentId).label, scenario.supportMode)}`,
      })
    }
  }

  // Very short sentences ("Pump running.") would fire on legitimate readouts.
  const substantial = phrases.filter(({ text }) => text.split(/\s+/).length >= 3)
  return { patterns: spec.precommitDenyPatterns, phrases: substantial }
}

/**
 * The map marks nothing before commitment: no halo, no caption, on any drill. A drill with a row
 * marks the row's places the moment the engine records the commitment and not a step sooner; a
 * drill without a row never marks anything. Either way, before the prediction there is nothing.
 */
function mapMarkingLeaks(): readonly string[] {
  const leaks: string[] = []
  for (const node of Array.from(document.querySelectorAll('[data-map-emphasis-target]'))) {
    leaks.push(`map marks ${node.getAttribute('data-map-emphasis-target')} before commitment`)
  }
  const caption = document.querySelector('[data-map-emphasis-caption]')
  if (caption) leaks.push(`map caption before commitment: ${caption.textContent}`)
  return leaks
}

/* ------------------------------------------------------------------ *
 * The disclosure surface
 * ------------------------------------------------------------------ */

/**
 * Every unit of the disclosure surface, hidden DOM included: each text node on its own (SVG
 * `<title>`, `<desc>`, `<text>` labels, sr-only spans), each sentence of each prose container, and
 * every aria-label — from the entire composed document minus the prediction fieldset.
 */
function disclosureUnits(): readonly string[] {
  const root = document.body.cloneNode(true) as HTMLElement
  for (const fieldset of Array.from(root.querySelectorAll('[data-prediction-choices]'))) {
    fieldset.remove()
  }

  const units: string[] = []
  const push = (text: string | null | undefined) => {
    for (const sentence of sentences(text ?? '')) units.push(sentence)
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) push(node.textContent)
  // Prose containers re-joined: a paragraph broken into several JSX text nodes must still be
  // scanned as its sentences, or a leak written across an expression boundary would slip through.
  for (const element of Array.from(
    root.querySelectorAll('p, li, dd, dt, td, th, desc, title, text'),
  )) {
    push(element.textContent)
  }
  for (const element of Array.from(root.querySelectorAll('[aria-label]'))) {
    push(element.getAttribute('aria-label'))
  }
  return units
}

interface ScanResult {
  readonly leaks: readonly string[]
  readonly excused: ReadonlySet<string>
}

function scan(scenarioId: string, moment: Moment, deny: DenySet): ScanResult {
  const known = knownDisclosuresFor(scenarioId)
  const excused = new Set<string>()
  const leaks: string[] = []

  for (const unit of disclosureUnits()) {
    const lowered = normalise(unit)
    const excuse = known.find((entry) => lowered.includes(normalise(entry.text)))
    if (excuse) {
      excused.add(excuse.text)
      continue
    }
    for (const pattern of deny.patterns) {
      const match = unit.match(pattern)
      if (match) leaks.push(`${moment} · "${unit.trim().slice(0, 160)}" ← ${pattern}`)
    }
    for (const phrase of deny.phrases) {
      if (lowered.includes(normalise(phrase.text))) {
        leaks.push(`${moment} · "${unit.trim().slice(0, 160)}" ← ${phrase.where}`)
      }
    }
  }
  return { leaks: Array.from(new Set(leaks)), excused }
}

/* ------------------------------------------------------------------ *
 * The step list
 * ------------------------------------------------------------------ */

function currentStepId(): string {
  return document.querySelector('[data-ecmo-shell="learn"]')?.getAttribute('data-stage') ?? ''
}

/** Unreached rows print their ordinal only; nothing past the prediction is reachable. */
function stepListLeaks(lesson: StageLesson, moment: Moment): readonly string[] {
  const rows = Array.from(document.querySelectorAll('[data-step-list] li[data-step-state]'))
  const leaks: string[] = []
  if (rows.length !== lesson.steps.length) {
    leaks.push(`${moment} · step list has ${rows.length} rows for ${lesson.steps.length} steps`)
  }
  rows.forEach((row) => {
    const stepId = row.getAttribute('data-step-id')
    const index = lesson.steps.findIndex((step) => step.id === stepId)
    const step = lesson.steps[index]
    if (!step) {
      leaks.push(`${moment} · step row ${stepId} names no step`)
      return
    }
    const state = row.getAttribute('data-step-state')
    const text = row.textContent ?? ''
    if (index > lesson.predictionStepIndex && state !== 'locked') {
      leaks.push(`${moment} · ${step.id} is ${state} before the prediction is committed`)
    }
    if (state === 'locked') {
      if (!text.includes(`Step ${step.ordinal}`)) {
        leaks.push(`${moment} · locked row ${step.id} does not read "Step ${step.ordinal}"`)
      }
      if (text.includes(step.title)) {
        leaks.push(`${moment} · locked row ${step.id} prints its title "${step.title}"`)
      }
    }
  })
  return leaks
}

/* ------------------------------------------------------------------ *
 * Driving a lesson to its prediction, the way a learner does
 * ------------------------------------------------------------------ */

function clickNextStep() {
  fireEvent.click(screen.getByRole('button', { name: /^Next step$/i }))
}

/** Operate the control the resolver names, on the real console, gas panel or circuit. */
function operateControl(controlId: GuidedControlId, action: SimulationAction) {
  const control = document.getElementById(controlId)
  if (!control) throw new Error(`The stage did not render the control ${controlId}`)
  switch (controlId) {
    case 'cardiohelp-rpm-control': {
      const target =
        action.type === 'SET_RPM'
          ? action.rpm
          : action.type === 'SET_FLOW_TARGET'
            ? action.flow
            : null
      if (target === null) throw new Error(`${action.type} does not drive the rotary`)
      const read = () =>
        action.type === 'SET_RPM'
          ? latestState().device.rpmSetpoint
          : latestState().device.lpmSetpoint
      let guard = 0
      while (Math.abs(read() - target) > 0.001 && guard < 400) {
        fireEvent.keyDown(control, { key: read() < target ? 'ArrowUp' : 'ArrowDown' })
        guard += 1
      }
      return
    }
    case 'cardiohelp-sweep-control':
      if (action.type !== 'SET_SWEEP') throw new Error(`${action.type} does not drive the sweep`)
      fireEvent.change(control, { target: { value: String(action.sweep) } })
      return
    case 'cardiohelp-fio2-control':
      if (action.type !== 'SET_GAS_FIO2') throw new Error(`${action.type} does not drive FiO₂`)
      fireEvent.change(control, { target: { value: String(action.fio2) } })
      return
    default:
      fireEvent.click(control)
  }
}

/**
 * A recognised task may take several controls in turn — Menu, then Alarm list — so the resolver is
 * consulted again after each one until the engine state satisfies the step.
 */
async function operateUntilSatisfied(actions: readonly SimulationAction[]) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const task = resolveGuidedSimulatorTask(actions, latestState())
    if (!task) throw new Error('The task stopped resolving to a control')
    if (task.satisfied) return
    operateControl(task.controlId, actions[0])
  }
  throw new Error(`The simulator never reached the state ${JSON.stringify(actions[0])}`)
}

async function performStep(step: StageStep) {
  switch (step.interaction.kind) {
    case 'read':
      fireEvent.click(nowPrimary())
      return
    case 'model-advance':
      fireEvent.click(nowPrimary())
      clickNextStep()
      return
    case 'simulator-task': {
      const task = resolveGuidedSimulatorTask(step.interaction.actions, latestState())
      if (!task) {
        // An unrecognised task — advancing the model, reloading the case — is performed from the
        // Now card and then moved on from, exactly as the harness does.
        fireEvent.click(nowPrimary())
        clickNextStep()
        return
      }
      await operateUntilSatisfied(step.interaction.actions)
      await waitFor(() => expect(nowStatus()).toMatch(/^Done\./))
      clickNextStep()
      return
    }
    default:
      throw new Error(`${step.id}: a ${step.interaction.kind} step precedes the prediction`)
  }
}

async function driveToPrediction(lesson: StageLesson) {
  for (let guard = 0; guard < lesson.steps.length + 1; guard += 1) {
    const index = lesson.steps.findIndex((step) => step.id === currentStepId())
    if (index < 0) throw new Error(`The stage is on an unknown step: ${currentStepId()}`)
    if (index === lesson.predictionStepIndex) return
    if (index > lesson.predictionStepIndex) {
      throw new Error(
        `The stage passed the prediction without it being committed: ${currentStepId()}`,
      )
    }
    const step = lesson.steps[index]
    await performStep(step)
    await waitFor(() => expect(currentStepId()).not.toBe(step.id))
  }
  throw new Error(`${lesson.scenarioId}: the prediction step was never reached`)
}

/* ------------------------------------------------------------------ *
 * The suite
 * ------------------------------------------------------------------ */

beforeEach(() => {
  resetStageHarness()
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn().mockResolvedValue({ ok: true }),
  })
})

describe('the deny set is what the pure-content scan holds the registries to', () => {
  it('covers all twenty drills', () => {
    expect(DRILL_IDS).toHaveLength(20)
  })

  it('names only drills in the known-disclosure list', () => {
    for (const entry of KNOWN_DISCLOSURES) {
      for (const drill of entry.drills) expect(DRILL_IDS).toContain(drill)
      expect(entry.text.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('nothing rendered before a drill’s prediction answers it', () => {
  it.each(DRILL_IDS)(
    '%s: the first step and the prediction step disclose nothing, and unreached rows are withheld',
    async (scenarioId) => {
      const guided = resolveGuidedLesson(scenarioId)
      expect(guided.scenarioId).toBe(scenarioId)
      const lesson = buildDrillStageLesson(guided, guided.supportMode)
      expect(lesson.predictionStepIndex).toBeGreaterThan(0)
      const deny = denySetFor(scenarioId)
      const excused = new Set<string>()
      const leaks: string[] = []

      await mountDrill(scenarioId)
      expect(currentStepId()).toBe(lesson.steps[0].id)
      expect(latestState().scenario.prediction.committed).toBe(false)

      const first = scan(scenarioId, 'first step', deny)
      leaks.push(...first.leaks, ...stepListLeaks(lesson, 'first step'), ...mapMarkingLeaks())
      first.excused.forEach((text) => excused.add(text))

      await driveToPrediction(lesson)
      expect(currentStepId()).toBe(lesson.steps[lesson.predictionStepIndex].id)
      expect(document.querySelector('[data-prediction-choices]')).not.toBeNull()
      expect(latestState().scenario.prediction.committed).toBe(false)

      const prediction = scan(scenarioId, 'prediction step', deny)
      leaks.push(
        ...prediction.leaks,
        ...stepListLeaks(lesson, 'prediction step'),
        ...mapMarkingLeaks(),
      )
      prediction.excused.forEach((text) => excused.add(text))

      expect(leaks).toEqual([])

      // Every excuse this drill carries must still be needed; a stale one is deleted, not kept.
      for (const entry of knownDisclosuresFor(scenarioId)) {
        expect(excused.has(entry.text)).toBe(true)
      }
    },
  )
})

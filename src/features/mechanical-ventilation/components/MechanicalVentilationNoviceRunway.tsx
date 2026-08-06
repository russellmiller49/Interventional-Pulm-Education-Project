'use client'

/**
 * "Before lesson 1" — the runway a first-year fellow needs before the pathway starts.
 *
 * The module was assessed as a strong intermediate reasoning simulator that is not yet an ideal
 * first exposure: section 1 opens by asking which variable the ventilator is holding, which assumes
 * the learner already knows what the controls are, what a normal breath looks like, and what the
 * mode name on the screen is claiming. This supplies that, and nothing more — it is a runway, not a
 * lesson, and it deliberately teaches no mechanism the pathway is about to teach properly.
 *
 * Ungated and recommended rather than required. It renders above the section list through
 * `PathwayLanding`'s `notice` slot — the one node the shared component accepts there — so it adds
 * no persistent section or activity id and the pathway file is untouched.
 *
 * Two deliberate restraints:
 *
 * - **No numbers that the module's source layer withholds.** Tidal volume is reasoned per kilogram
 *   of predicted body weight, so the primer teaches what predicted body weight is and where it
 *   comes from, and says plainly that the millilitres-per-kilogram figure belongs to reviewed
 *   sources and local practice. This module's clinical reconciliation is still open; inventing a
 *   target here would be the one thing the rest of the module is careful not to do.
 * - **No second waveform engine.** The normal breath is drawn closed-form from the equation of
 *   motion and rendered through `tracePath` from the teaching primitives, the same approach and the
 *   same primitive the waveform-anatomy panel already uses for its comparison columns. The claim
 *   being made is about shape and sequence, not about a particular patient.
 */
import { useMemo, useState } from 'react'

import { ventilatorDeviceProfiles } from '../content'
import type { WaveformSample } from '../engine'
import { ModelBoundary, TextEquivalent, styles, tracePath } from './teaching/shared'

/* ------------------------------------------------------------------------------------------------
 * A. The controls, and what each one does not promise
 * ---------------------------------------------------------------------------------------------- */

interface ControlCopy {
  readonly id: string
  readonly label: string
  /** What turning it actually changes. */
  readonly changes: string
  /** The promise it does not make — the misreading that follows from treating it as a guarantee. */
  readonly doesNotGuarantee: string
  /** What has to be looked at afterwards for the change to mean anything. */
  readonly reassess: string
}

const controls: readonly ControlCopy[] = [
  {
    id: 'fio2',
    label: 'Oxygen (FiO₂)',
    changes:
      'The fraction of oxygen in the gas being delivered — the concentration offered at the airway.',
    doesNotGuarantee:
      'That it reaches the blood. Oxygen has to cross a lung to matter, so blood that bypasses ventilated lung is not helped by a higher concentration. A patient who does not respond to more oxygen is telling you something about the lung, not about the setting.',
    reassess:
      'Saturation and, where available, an arterial gas — and whether the improvement is proportionate to how much you gave.',
  },
  {
    id: 'peep',
    label: 'PEEP',
    changes:
      'The pressure the respiratory system is held at between breaths, so lung units that would otherwise collapse at end-expiration may stay open.',
    doesNotGuarantee:
      'Recruitment. The same pressure that opens collapsed lung can overdistend lung that was already open, and it raises the pressure inside the chest, which can reduce the blood returning to the heart.',
    reassess:
      'Oxygenation, the pressures the breath now reaches, delivered volume, and the blood pressure — all four, because this is the setting whose benefit and its cost show up in different places.',
  },
  {
    id: 'tidal-volume',
    label: 'Tidal volume',
    changes:
      'The size of the breath the ventilator delivers, on a mode that sets volume. The pressure needed to deliver it is then whatever the lung demands.',
    doesNotGuarantee:
      'That the breath is the right size for this lung, or even that it all arrives — gas can leak from the circuit or stay in the chest. Volume is reasoned against predicted body weight, not against the number on the bed.',
    reassess:
      'Exhaled volume against set volume, the pressure the breath reached, and the patient’s own effort.',
  },
  {
    id: 'rate',
    label: 'Respiratory rate',
    changes:
      'How many breaths the ventilator will deliver each minute if the patient does not trigger more.',
    doesNotGuarantee:
      'The rate the patient actually gets. A patient who is triggering breathes above it, and every extra breath shortens the time available to empty. It also does not guarantee CO₂ clearance — that depends on how much of each breath reaches gas-exchanging lung.',
    reassess:
      'Total rate against set rate, whether expiratory flow reaches zero before the next breath, and the CO₂ measurement when there is one.',
  },
  {
    id: 'flow',
    label: 'Inspiratory flow',
    changes:
      'How fast gas is delivered on a volume-set breath, which decides how long inspiration takes and therefore how long is left to breathe out.',
    doesNotGuarantee:
      'Comfort. Flow below what the patient is asking for is one of the commonest causes of distress on a ventilator, and it shows up as a dip in the pressure trace rather than as an alarm.',
    reassess:
      'The shape of the pressure trace during inspiration, the patient’s visible effort, and the time left for expiration.',
  },
  {
    id: 'inspiratory-time',
    label: 'Inspiratory time',
    changes:
      'How long the ventilator spends in inspiration on a time-cycled breath, which sets the split between inspiration and expiration.',
    doesNotGuarantee:
      'That it matches the patient’s own inspiration. The machine breath and the neural breath are two different clocks, and they routinely disagree.',
    reassess:
      'Where the patient’s effort starts and stops relative to the machine breath, and whether expiration finishes.',
  },
  {
    id: 'pressure-support',
    label: 'Pressure support',
    changes:
      'How much pressure above baseline the ventilator adds to a breath the patient started themselves.',
    doesNotGuarantee:
      'A particular breath size. The volume that results depends on the support, the mechanics, and how hard the patient pulls — so the same setting delivers different breaths as the patient changes.',
    reassess:
      'Delivered volume, rate, effort, and whether the breath is ending when the patient wants it to.',
  },
  {
    id: 'trigger',
    label: 'Trigger sensitivity',
    changes:
      'How much of a signal — a drop in pressure, or a change in flow — the patient must produce for the ventilator to start a breath.',
    doesNotGuarantee:
      'That every effort is answered. Set it too insensitive and efforts are missed; set it too sensitive and the circuit itself can start breaths the patient never asked for. Both directions are failures, and they look different on the trace.',
    reassess:
      'Efforts that produce no breath, breaths with no effort before them, and the delay between the two.',
  },
  {
    id: 'cycling',
    label: 'Cycling threshold',
    changes:
      'On a flow-cycled breath, how far inspiratory flow must fall before the ventilator switches to expiration.',
    doesNotGuarantee:
      'That inspiration ends when the patient’s does. Ending too early leaves the patient still pulling; ending too late pushes into the time they needed to breathe out.',
    reassess:
      'Whether effort continues past the end of the breath, and whether expiratory flow reaches zero before the next one.',
  },
]

/* ------------------------------------------------------------------------------------------------
 * B. One normal breath
 * ---------------------------------------------------------------------------------------------- */

interface BreathStage {
  readonly id: string
  readonly label: string
  /** Where the stage sits along the drawn breath, 0 to 1, for the marker. */
  readonly at: number
  readonly body: string
}

const breathStages: readonly BreathStage[] = [
  {
    id: 'trigger',
    label: 'Trigger',
    at: 0.02,
    body: 'Something starts the breath: the ventilator’s clock, or the patient. On the traces this is the moment flow leaves zero. If the patient started it, there is usually a small dip in pressure just before — the effort that asked for it.',
  },
  {
    id: 'inspiration',
    label: 'Inspiration',
    at: 0.18,
    body: 'Gas moves in. Flow is above the line, volume climbs as the running total of that flow, and pressure rises — partly to push gas through the tube and airways, partly to distend the lung it is filling.',
  },
  {
    id: 'target',
    label: 'What is held',
    at: 0.4,
    body: 'One of pressure or volume is the variable the ventilator is defending; the other is free to follow the lung. This is the single most useful thing to read off a trace, and the whole of the first section is about it.',
  },
  {
    id: 'cycle',
    label: 'Cycle',
    at: 0.55,
    body: 'Inspiration ends. A time, a delivered volume, or a fall in flow decides when — and which of those it is belongs to the mode, not to the patient. On the traces it is where flow crosses back through zero.',
  },
  {
    id: 'expiration',
    label: 'Expiration',
    at: 0.78,
    body: 'Gas comes out, and on every mode here it comes out passively — the lung and the circuit empty on their own, with no setting driving them. That is why the expiratory limb reports the patient rather than the machine, and why whether it reaches zero before the next breath is worth checking every time.',
  },
]

const SAMPLE_COUNT = 140

/**
 * One idealized passive breath, from the equation of motion.
 *
 * Volume-set delivery, because that is the breath whose three traces are easiest to tell apart the
 * first time: square flow, a straight volume ramp, and a pressure trace that steps for the resistive
 * term and then ramps as the lung fills. Deliberately generic — no case, no patient, no numbers
 * printed against it.
 */
function normalBreath(): readonly WaveformSample[] {
  const complianceLPerCmH2O = 0.05
  const resistanceCmH2OPerLps = 10
  const peep = 5
  const tidalVolumeL = 0.45
  const inspiratorySeconds = 1
  const tau = resistanceCmH2OPerLps * complianceLPerCmH2O
  const expiratorySeconds = tau * 5
  const total = inspiratorySeconds + expiratorySeconds
  const inspiratorySamples = Math.round((SAMPLE_COUNT * inspiratorySeconds) / total)
  const setFlowLps = tidalVolumeL / inspiratorySeconds

  return Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const inInspiration = index < inspiratorySamples
    const time = (index / (SAMPLE_COUNT - 1)) * total
    if (inInspiration) {
      const elapsed = (index / inspiratorySamples) * inspiratorySeconds
      const volumeL = setFlowLps * elapsed
      return {
        time,
        pawCmH2O: peep + resistanceCmH2OPerLps * setFlowLps + volumeL / complianceLPerCmH2O,
        flowLMin: setFlowLps * 60,
        volumeMl: volumeL * 1000,
        pmusCmH2O: 0,
        phase: 'inspiration' as const,
        triggered: index === 0,
        spontaneous: false,
      }
    }
    const elapsed =
      ((index - inspiratorySamples) / (SAMPLE_COUNT - inspiratorySamples)) * expiratorySeconds
    const volumeL = tidalVolumeL * Math.exp(-elapsed / tau)
    return {
      time,
      pawCmH2O: peep,
      flowLMin: (-volumeL / tau) * 60,
      volumeMl: volumeL * 1000,
      pmusCmH2O: 0,
      phase: 'expiration' as const,
      triggered: false,
      spontaneous: false,
    }
  })
}

/* ------------------------------------------------------------------------------------------------
 * C. What the mode names map to
 * ---------------------------------------------------------------------------------------------- */

interface CrosswalkRow {
  readonly modeId: string
  readonly generic: string
  readonly trigger: string
  readonly target: string
  readonly cycle: string
}

const crosswalk: readonly CrosswalkRow[] = [
  {
    modeId: 'volume-ac',
    generic: 'Volume assist/control',
    trigger: 'Patient or the machine’s clock',
    target: 'Volume',
    cycle: 'Delivered volume or a set time',
  },
  {
    modeId: 'pressure-ac',
    generic: 'Pressure assist/control',
    trigger: 'Patient or the machine’s clock',
    target: 'Pressure',
    cycle: 'A set time',
  },
  {
    modeId: 'pressure-support',
    generic: 'Pressure support / CPAP',
    trigger: 'Patient only, with a backup if they stop',
    target: 'Pressure',
    cycle: 'A fall in inspiratory flow',
  },
  {
    modeId: 'volume-simv',
    generic: 'SIMV, volume-set mandatory breaths',
    trigger: 'Patient or the machine’s clock, on mandatory breaths',
    target: 'Volume on mandatory breaths; the support setting between them',
    cycle: 'Delivered volume or a set time; flow on the breaths between',
  },
  {
    modeId: 'pressure-simv',
    generic: 'SIMV, pressure-set mandatory breaths',
    trigger: 'Patient or the machine’s clock, on mandatory breaths',
    target: 'Pressure on mandatory breaths; the support setting between them',
    cycle: 'A set time; flow on the breaths between',
  },
]

/* ------------------------------------------------------------------------------------------------
 * D & E. Setting up, and how urgent it is
 * ---------------------------------------------------------------------------------------------- */

const setupSteps: readonly { readonly label: string; readonly body: string }[] = [
  {
    label: 'Name the two goals first',
    body: 'What does this patient need for oxygenation, and what do they need for clearing CO₂? They are different problems with different settings behind them, and a plan that has not separated them tends to move the wrong control.',
  },
  {
    label: 'Reason the breath size against predicted body weight',
    body: 'Lungs scale with height, not with how much a patient currently weighs — an oedematous patient does not have a bigger lung. Predicted body weight is worked out from height and sex, and is what tidal volume is expressed per kilogram of. Take the millilitres-per-kilogram figure itself from the reviewed sources and your own unit’s practice; this module does not state one while its clinical reconciliation is open.',
  },
  {
    label: 'Choose a breath type that matches what the patient can do',
    body: 'A patient making no effort and a patient with a strong drive need different arrangements, and the choice is really about which variable you want defended and how much of the breath you want them to shape.',
  },
  {
    label: 'Set the alarms as a boundary, not as an afterthought',
    body: 'Alarm limits are where you decide in advance what you want to be told about. They are the part of the setup most often left at whatever the last patient had.',
  },
  {
    label: 'Reassess, and be specific about what',
    body: 'The patient first — comfort, effort, chest movement, breath sounds — then the waveforms, the pressures, the volume actually exhaled, gas exchange, and the blood pressure. A setting change that has not been reassessed has not finished.',
  },
]

/* ------------------------------------------------------------------------------------------------
 * The runway
 * ---------------------------------------------------------------------------------------------- */

type PanelId = 'controls' | 'breath' | 'modes' | 'setup' | 'urgency'

const panelOrder: readonly { readonly id: PanelId; readonly label: string }[] = [
  { id: 'controls', label: 'The controls' },
  { id: 'breath', label: 'One normal breath' },
  { id: 'modes', label: 'Mode names' },
  { id: 'setup', label: 'Starting a patient' },
  { id: 'urgency', label: 'Urgent, or abnormal?' },
]

export function MechanicalVentilationNoviceRunway({
  /**
   * Which panel is open on first mount. Exists for the offline render harness, which cannot press a
   * button and has to mount each state separately to review it — the same reason the teaching
   * panels render with no dispatch. In the app it is left at its default.
   */
  initialPanel = 'controls',
}: {
  readonly initialPanel?: PanelId
} = {}) {
  const [panel, setPanel] = useState<PanelId>(initialPanel)
  const [control, setControl] = useState<string>(controls[0].id)
  const [stage, setStage] = useState<string>(breathStages[0].id)

  const breath = useMemo(() => normalBreath(), [])
  const selectedControl = controls.find((item) => item.id === control) ?? controls[0]
  const selectedStage = breathStages.find((item) => item.id === stage) ?? breathStages[0]

  const pressurePath = tracePath(breath, 'pawCmH2O', 0, 30, 300, 54)
  const flowPath = tracePath(breath, 'flowLMin', -40, 40, 300, 54)
  const volumePath = tracePath(breath, 'volumeMl', 0, 520, 300, 54)

  const breathSummary =
    'One passive breath drawn as three stacked traces sharing a time axis. Pressure rises from the baseline through inspiration and returns to it. Flow is square and above the line while gas goes in, crosses zero at the end of inspiration, and decays back to zero from below the line as the lung empties. Volume climbs as the running total of flow and falls back as the gas leaves. The five marks along the breath are trigger, inspiration, the variable being held, cycle, and expiration.'

  return (
    <section
      className={styles.panel}
      aria-labelledby="mv-novice-runway"
      data-mv-novice-runway="true"
    >
      <header className={styles.panelHeader}>
        <span>Before lesson 1 · recommended, not required</span>
        <h2 id="mv-novice-runway">New to ventilators? Start here.</h2>
        <p>
          The sections below assume you can already name the controls, picture a normal breath, and
          read a mode name for what it claims. If any of that is new, this is the short version —
          five panels, no order to follow, and nothing here is a prerequisite for opening any
          section.
        </p>
      </header>

      <div className={styles.componentToggles}>
        {panelOrder.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={panel === entry.id}
            onClick={() => setPanel(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {panel === 'controls' ? (
        <>
          <div className={styles.componentToggles}>
            {controls.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={control === item.id}
                onClick={() => setControl(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={styles.stepDetail}>
            <span>{selectedControl.label} — what it changes</span>
            <p>{selectedControl.changes}</p>
            <span>What it does not guarantee</span>
            <p>{selectedControl.doesNotGuarantee}</p>
            <span>What to reassess afterwards</span>
            <p>{selectedControl.reassess}</p>
          </div>
        </>
      ) : null}

      {panel === 'breath' ? (
        <>
          <figure className={`${styles.figure} ${styles.wideSurfaceFigure}`}>
            <svg viewBox="0 0 300 186" role="img" aria-label={breathSummary}>
              {[
                { id: 'pressure', label: 'Pressure', d: pressurePath },
                { id: 'flow', label: 'Flow', d: flowPath },
                { id: 'volume', label: 'Volume', d: volumePath },
              ].map((row, index) => (
                <g key={row.id} transform={`translate(0 ${index * 62})`}>
                  <path className={styles.traceGrid} d="M0 54 H300" />
                  {row.id === 'flow' ? (
                    <path className={styles.zeroFlowLine} d="M0 27 H300" />
                  ) : null}
                  <path className={styles.trace} d={row.d} />
                  <text className={styles.comparisonAxis} x="2" y="9">
                    {row.label}
                  </text>
                </g>
              ))}
              {/* Starts below the label band so the marker never strikes through a trace name. */}
              <g className={styles.variableMarker}>
                <path d={`M${(selectedStage.at * 300).toFixed(1)} 12 V186`} />
              </g>
            </svg>
            <figcaption>
              One passive breath. The dashed line on the flow trace is zero flow — the only one of
              the three read against zero. Select a stage to mark where it happens.
            </figcaption>
          </figure>
          <div className={styles.componentToggles}>
            {breathStages.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={stage === item.id}
                onClick={() => setStage(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={styles.stepDetail}>
            <span>{selectedStage.label}</span>
            <p>{selectedStage.body}</p>
          </div>
          <TextEquivalent>{breathSummary}</TextEquivalent>
        </>
      ) : null}

      {panel === 'modes' ? (
        <>
          <div className={styles.stepDetail}>
            <span>The names are local; the three questions are not</span>
            <p>
              Every mode has to answer the same three questions about a breath — what starts it,
              what is held during it, and what ends it. Manufacturers then give their own answer to
              those questions its own name, and the names do not agree with each other. Read the
              questions, and treat the label as a local dialect.
            </p>
          </div>
          <div className={styles.evidenceTable} aria-label="Generic breath types and device names">
            {crosswalk.map((row) => (
              <div key={row.modeId} className={styles.evidenceRow}>
                <span>
                  {row.generic}
                  <small>
                    <strong>Starts:</strong> {row.trigger} · <strong>Holds:</strong> {row.target} ·{' '}
                    <strong>Ends:</strong> {row.cycle}
                  </small>
                  <small>
                    Called, on the consoles in this module:{' '}
                    {ventilatorDeviceProfiles
                      .map((profile) => {
                        const descriptor = profile.modes.find(
                          (candidate) => candidate.id === row.modeId,
                        )
                        return descriptor ? `${descriptor.label} (${profile.shortName})` : null
                      })
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
                <span className={styles.verdict} data-verdict="neutral">
                  Examples
                </span>
              </div>
            ))}
          </div>
          <div className={styles.stepDetail}>
            <span>One simplification to put down again later</span>
            <p>
              For the modes above, a ventilator holds one of pressure or volume and lets the other
              follow the lung. That rule is what makes a trace readable at sight, and the first
              section builds on it — but it is a simplification. The adaptive or dual-control modes
              hold pressure within each breath while adjusting that pressure across several breaths
              to chase a volume you asked for, so neither answer describes them on its own. The
              Modes section returns to this once the four breath variables are familiar.
            </p>
          </div>
        </>
      ) : null}

      {panel === 'setup' ? (
        <>
          <div className={styles.stepDetail}>
            <span>A sequence, not a set of default numbers</span>
            <p>
              What makes an initial setup defensible is the order the decisions are made in and what
              each one is answerable to. The numbers themselves belong to the patient in front of
              you, the reviewed sources, and your unit’s practice.
            </p>
          </div>
          <ol className={styles.steps}>
            {setupSteps.map((step) => (
              <li key={step.label}>
                <div className={styles.stepDetail}>
                  <span>{step.label}</span>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {panel === 'urgency' ? (
        <div className={styles.evidenceTable} aria-label="How urgent an abnormal finding is">
          <div className={styles.evidenceRow}>
            <span>
              Stabilize first, localize afterwards
              <small>
                The patient is deteriorating alongside the finding — the blood pressure is falling,
                the saturation is dropping fast, the chest is not moving, or hand ventilation is
                getting harder. Here the sequence is to support the patient, take away whatever
                might be causing it, and only then work out which mechanism it was. Disconnecting a
                patient from the ventilator and ventilating by hand is a diagnostic act as much as a
                supportive one: it separates causes in the patient from causes in the machine.
              </small>
            </span>
            <span className={styles.verdict} data-verdict="against">
              Act now
            </span>
          </div>
          <div className={styles.evidenceRow}>
            <span>
              Localize first, then change one thing
              <small>
                The finding is abnormal but the patient is stable — an alarm that keeps sounding, a
                waveform that does not look right, a number that has drifted. Here you can afford to
                measure before acting: read the traces in a fixed order, work out which mechanism
                fits, change one control, and reassess. Changing several settings at once on a
                stable patient throws away the information the response would have given you.
              </small>
            </span>
            <span className={styles.verdict} data-verdict="neutral">
              Deliberate
            </span>
          </div>
          <div className={styles.evidenceRow}>
            <span>
              The distinction is about the patient, not the number
              <small>
                A high pressure alarm is not urgent because the number is high; it is urgent because
                of what the patient is doing while it sounds. The same reading can be either, which
                is why the first move on any alarm is to look at the person rather than the screen.
              </small>
            </span>
            <span className={styles.verdict} data-verdict="consistent">
              Both
            </span>
          </div>
        </div>
      ) : null}

      <ModelBoundary>
        This primer supports supervised learning and is not a substitute for the operator’s manual
        for the device you are using, your unit’s protocols, or the supervision of someone
        responsible for the patient. Working through it does not establish that you are ready to
        manage a ventilated patient independently. No treatment target is stated here; the numeric
        figures this module withholds are still awaiting its clinical source reconciliation.
      </ModelBoundary>
    </section>
  )
}

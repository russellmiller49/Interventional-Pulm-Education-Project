import { ecmoDerivedValueGuides } from '../../content/ecmoValueGuides'
import { createReferenceSimulationState, ecmoSimulationReducer } from '../../engine'
import type { EcmoSimulationState } from '../../engine/types'
import {
  GuidedValue,
  ModelBoundary,
  TextEquivalent,
  direction,
  directionWord,
  round,
  styles,
} from './shared'

/**
 * VV series physiology: what the pump displays, and what is left of it after re-drainage.
 *
 * The panel keeps four quantities that are routinely collapsed into one strictly apart:
 *
 *   - displayed circuit flow — everything the pump moved, including blood it just returned
 *   - recirculation-adjusted circuit flow — the same flow with the re-drained share removed
 *   - the venous-line saturation the console actually measures, on the drainage limb
 *   - the systemic venous saturation this simulation estimates, which no sensor reads
 *
 * The mixture arithmetic is shown from the raw model values rather than from rounded display
 * values, so the fraction it reproduces is the engine's own fraction rather than a number that
 * happens to look close.
 */

interface SeriesStage {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly carries: string
}

function seriesStages(state: EcmoSimulationState): readonly SeriesStage[] {
  const { circuit, patient } = state
  return [
    {
      id: 'systemic-venous-return',
      label: 'Systemic venous return',
      detail:
        'Blood coming back from the tissues, carrying whatever the tissues left behind. Nothing on the circuit measures this directly.',
      carries: `Systemic venous saturation, estimated at ${round(patient.systemicVenousSaturationEstimate, 1)}`,
    },
    {
      id: 'drainage',
      label: 'Drainage limb',
      detail:
        'What the circuit actually pulls in: systemic venous return mixed with any freshly returned circuit blood that is drawn straight back.',
      carries: `Venous-line saturation ${round(circuit.preOxygenatorSaturation, 1)}, measured in the disposable’s measuring cell`,
    },
    {
      id: 'oxygenator',
      label: 'Membrane lung',
      detail: 'Gas exchange, then out along the return limb.',
      carries: `Post-oxygenator saturation ${round(circuit.postOxygenatorSaturation, 1)}`,
    },
    {
      id: 'venous-return-to-patient',
      label: 'Return to the venous system',
      detail:
        'The circuit gives the blood back on the venous side. Part of it travels on toward the right heart; part of it can be drained again without ever leaving the chest.',
      carries: `Recirculating share of drainage ${round(circuit.recirculationFraction * 100, 1)} of every 100 parts`,
    },
    {
      id: 'right-heart',
      label: 'Right heart',
      detail:
        'The patient’s own right ventricle moves that blood forward. The circuit adds no pumping to the circulation here.',
      carries: `Native cardiac output ${round(patient.nativeCardiacOutputLpm, 1)} L/min`,
    },
    {
      id: 'native-lung',
      label: 'Native pulmonary circulation',
      detail:
        'The patient’s own lungs are still in the path and still contributing whatever gas exchange they can.',
      carries: 'Native lung contribution, additive to the membrane lung',
    },
    {
      id: 'left-heart-systemic',
      label: 'Left heart and systemic circulation',
      detail:
        'The systemic circulation is driven entirely by the native heart in VV support. This is where the delivered result is read.',
      carries: `Patient SpO₂ ${round(patient.spo2, 1)}`,
    },
  ]
}

/**
 * The settled VV reference circuit, derived from the engine rather than copied into content.
 *
 * Computed once and reused: the comparison the observe phase asks for is between the state on
 * screen and the reference this lesson opens on, and a learner cannot hold both in their head while
 * switching between them.
 */
let cachedReference: EcmoSimulationState | null = null
function vvReferenceCircuit(): EcmoSimulationState {
  if (!cachedReference) {
    let state = createReferenceSimulationState('vv-reference')
    for (let tick = 0; tick < 12; tick += 1) {
      state = ecmoSimulationReducer(state, { type: 'STEP' })
    }
    cachedReference = state
  }
  return cachedReference
}

interface ComparisonRow {
  readonly id: string
  readonly label: string
  readonly unit: string
  readonly precision: number
  readonly deadband: number
  readonly read: (state: EcmoSimulationState) => number
}

/**
 * Deadbands for the comparison words only. A display aid for this simulation — not a tolerance,
 * not a threshold — and the raw values either side of them are always shown.
 */
const COMPARISON_ROWS: readonly ComparisonRow[] = [
  {
    id: 'displayed-circuit-flow',
    label: 'Displayed circuit flow',
    unit: 'L/min',
    precision: 2,
    deadband: 0.05,
    read: (state) => state.circuit.bloodFlow,
  },
  {
    id: 'adjusted-circuit-flow',
    label: 'Recirculation-adjusted circuit flow',
    unit: 'L/min',
    precision: 2,
    deadband: 0.05,
    read: (state) => state.circuit.recirculationAdjustedCircuitFlowLpm,
  },
  {
    id: 'venous-line-saturation',
    label: 'Venous-line SvO₂',
    unit: '',
    precision: 1,
    deadband: 0.5,
    read: (state) => state.circuit.preOxygenatorSaturation,
  },
  {
    id: 'systemic-venous-estimate',
    label: 'Systemic venous saturation (estimate)',
    unit: '',
    precision: 1,
    deadband: 0.5,
    read: (state) => state.patient.systemicVenousSaturationEstimate,
  },
  {
    id: 'patient-spo2',
    label: 'Patient SpO₂',
    unit: '',
    precision: 1,
    deadband: 0.5,
    read: (state) => state.patient.spo2,
  },
]

export function VvSeriesPhysiologyPanel({ state }: { readonly state: EcmoSimulationState }) {
  const { circuit, patient } = state
  const stages = seriesStages(state)

  // Raw model values, not display values: the arithmetic has to reproduce the engine's fraction.
  const systemic = patient.systemicVenousSaturationEstimate
  const post = circuit.postOxygenatorSaturation
  const pre = circuit.preOxygenatorSaturation
  const spread = post - systemic
  // Below about a point of spread the rearrangement is dominated by rounding, so it is not shown.
  const impliedFraction = Math.abs(spread) > 1 ? (pre - systemic) / spread : null

  return (
    <div className={styles.panel} data-teaching-panel="vv-series-physiology">
      <section className={styles.section} aria-labelledby="series-path-heading">
        <h3 id="series-path-heading" className={styles.heading}>
          The circuit in series with the patient
        </h3>

        <ol className="mt-3 grid gap-2" data-series-path>
          {stages.map((stage, index) => (
            <li
              key={stage.id}
              className="rounded-xl border-l-4 border-solid bg-muted/30 p-3"
              data-series-stage={stage.id}
            >
              <p className="text-sm font-semibold">
                {index + 1}. {stage.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{stage.detail}</p>
              <p className="mt-1 text-xs font-medium">{stage.carries}</p>
            </li>
          ))}
        </ol>

        <p className="mt-3 text-sm leading-6" data-systemic-pump-claim>
          Native cardiac output is the systemic pump in VV support. The circuit changes the oxygen
          content of blood arriving at the right heart and provides no circulatory support at all.
        </p>

        <TextEquivalent>
          Blood returns from the tissues to the venous system, is drained into the circuit, crosses
          the membrane lung, and is returned to the venous system. From there the patient’s own
          right heart moves it through the patient’s own lungs to the left heart and out to the
          systemic circulation. The circuit sits inside that loop rather than beside it, which is
          why some of what it returns can be drained again before it has been anywhere.
        </TextEquivalent>

        <ModelBoundary>
          The diagram is a teaching sequence of where blood goes, not a scale drawing of cannula
          positions or vessel anatomy, and the share that recirculates depends on a cannula geometry
          this simulation does not draw.
        </ModelBoundary>
      </section>

      <section className={styles.section} aria-labelledby="two-flows-heading">
        <h3 id="two-flows-heading" className={styles.heading}>
          Two flows, two saturations — read separately
        </h3>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-3" data-series-signal="displayed-circuit-flow">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Displayed circuit flow
            </p>
            <p className="text-2xl font-semibold">{circuit.bloodFlow.toFixed(2)} L/min</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Everything the pump moved. Blood that was drained again straight after being returned
              is counted here exactly like blood that reached the tissues.
            </p>
          </div>
          <div className="rounded-xl border p-3" data-series-signal="adjusted-circuit-flow">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Recirculation-adjusted circuit flow
            </p>
            <p className="text-2xl font-semibold">
              {circuit.recirculationAdjustedCircuitFlowLpm.toFixed(2)} L/min
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The same flow with the immediately re-drained share removed. It is not a second
              systemic cardiac output, and it must never be added to the native output to make one.
            </p>
          </div>
          <div className="rounded-xl border p-3" data-series-signal="recirculation-fraction">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Recirculating share of drainage
            </p>
            <p className="text-2xl font-semibold">{circuit.recirculationFraction.toFixed(3)}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Authored by the case in this simulation. It does not move when the pump speed moves.
            </p>
          </div>
          <div className="rounded-xl border p-3" data-series-signal="native-cardiac-output">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Native cardiac output
            </p>
            <p className="text-2xl font-semibold">
              {patient.nativeCardiacOutputLpm.toFixed(1)} L/min
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The systemic pump. In VV support it does all of the circulatory work.
            </p>
          </div>
          <div className="rounded-xl border p-3" data-series-signal="venous-line-saturation">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Venous-line SvO₂ — device-displayed
            </p>
            <p className="text-2xl font-semibold">
              {circuit.readouts.venousLineSaturation.displayed === null
                ? '--'
                : circuit.readouts.venousLineSaturation.displayed.toFixed(1)}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The console’s own measurement, taken on the drainage limb in the disposable’s
              measuring cell. It rises with recirculation.
              {circuit.readouts.venousLineSaturation.displayed === null
                ? ` ${circuit.readouts.venousLineSaturation.reason}`
                : ''}
            </p>
          </div>
          <div className="rounded-xl border p-3" data-series-signal="systemic-venous-estimate">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Systemic venous saturation — model estimate
            </p>
            <p className="text-2xl font-semibold">
              {patient.systemicVenousSaturationEstimate.toFixed(1)}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              A latent quantity this simulation infers from its own oxygen balance. No sensor on the
              circuit reads it and the CARDIOHELP never displays it.
            </p>
          </div>
          <div className="rounded-xl border p-3" data-series-signal="post-oxygenator-saturation">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Post-oxygenator saturation
            </p>
            <p className="text-2xl font-semibold">{circuit.postOxygenatorSaturation.toFixed(1)}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              What the membrane lung sends back into the venous system.
            </p>
          </div>
          <div className="rounded-xl border p-3" data-series-signal="patient-spo2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Patient SpO₂</p>
            <p className="text-2xl font-semibold">{patient.spo2.toFixed(1)}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The delivered result, after the native lung and the native heart have had their say.
            </p>
          </div>
        </div>

        <TextEquivalent>
          Displayed circuit flow is {circuit.bloodFlow.toFixed(2)} L/min and the
          recirculation-adjusted circuit flow is{' '}
          {circuit.recirculationAdjustedCircuitFlowLpm.toFixed(2)} L/min, with a recirculating share
          of {circuit.recirculationFraction.toFixed(3)}. The console displays a venous-line
          saturation of{' '}
          {circuit.readouts.venousLineSaturation.displayed === null
            ? 'no number'
            : circuit.readouts.venousLineSaturation.displayed.toFixed(1)}{' '}
          while this simulation estimates the systemic venous saturation at{' '}
          {patient.systemicVenousSaturationEstimate.toFixed(1)} and the post-oxygenator saturation
          at {circuit.postOxygenatorSaturation.toFixed(1)}. Patient SpO₂ is{' '}
          {patient.spo2.toFixed(1)} and native cardiac output is{' '}
          {patient.nativeCardiacOutputLpm.toFixed(1)} L/min.
        </TextEquivalent>
      </section>

      <section className={styles.section} aria-labelledby="comparison-heading">
        <h3 id="comparison-heading" className={styles.heading}>
          This state against the VV reference circuit
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm" data-reference-comparison>
            <caption className="sr-only">
              Each quantity in the VV reference circuit this lesson opens on, in the state currently
              loaded, and the direction between them.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  Quantity
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  VV reference circuit
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  State on screen
                </th>
                <th scope="col" className="pb-1 font-semibold">
                  Direction
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => {
                const referenceValue = row.read(vvReferenceCircuit())
                const liveValue = row.read(state)
                const word = directionWord[direction(liveValue - referenceValue, row.deadband)]
                return (
                  <tr key={row.id} data-comparison-row={row.id}>
                    <th scope="row" className="py-1 pr-3 font-medium">
                      {row.label}
                    </th>
                    <td className="py-1 pr-3 text-muted-foreground" data-reference-value>
                      {referenceValue.toFixed(row.precision)}
                      {row.unit ? ` ${row.unit}` : ''}
                    </td>
                    <td className="py-1 pr-3 font-semibold" data-live-comparison-value>
                      {liveValue.toFixed(row.precision)}
                      {row.unit ? ` ${row.unit}` : ''}
                    </td>
                    <td className="py-1" data-comparison-direction={word}>
                      {word}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <TextEquivalent>
          {COMPARISON_ROWS.map((row) => {
            const referenceValue = row.read(vvReferenceCircuit())
            const liveValue = row.read(state)
            return `${row.label} is ${liveValue.toFixed(row.precision)}${row.unit ? ` ${row.unit}` : ''} against the reference circuit's ${referenceValue.toFixed(row.precision)}${row.unit ? ` ${row.unit}` : ''}, ${directionWord[direction(liveValue - referenceValue, row.deadband)]}`
          }).join('. ')}
          . Displayed flow and the flow left after re-drainage can move in opposite directions, and
          the venous-line saturation can move opposite to the systemic estimate. That is the whole
          point of reading them separately.
        </TextEquivalent>

        <ModelBoundary>
          The reference column is this simulation&rsquo;s own authored teaching circuit, derived by
          the same model that produces every other number here, not a set of bedside values to
          reproduce. The words higher, lower and about the same come from an authored display
          deadband for this simulation and mark no boundary of safety; the raw values either side of
          them are printed above.
        </ModelBoundary>
      </section>

      <section className={styles.section} aria-labelledby="mixture-heading">
        <h3 id="mixture-heading" className={styles.heading}>
          This simulation’s mixture relationship
        </h3>
        <p className="mt-2 text-sm leading-6">
          The drainage limb is a mixture of the two saturations either side of it. In this
          simulation the venous-line value is produced as
        </p>
        <p className="mt-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm" data-mixture-formula>
          pre-oxygenator = systemic + fraction × (post-oxygenator − systemic)
        </p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2" data-mixture-values>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">systemic</dt>
            <dd className="text-sm font-semibold">{round(systemic, 1)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              post-oxygenator
            </dt>
            <dd className="text-sm font-semibold">{round(post, 1)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              pre-oxygenator
            </dt>
            <dd className="text-sm font-semibold">{round(pre, 1)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              share this reproduces
            </dt>
            <dd className="text-sm font-semibold" data-implied-fraction>
              {impliedFraction === null ? 'not separable here' : impliedFraction.toFixed(3)}
            </dd>
          </div>
        </dl>

        <TextEquivalent>
          {impliedFraction === null
            ? `The two saturations either side of the drainage limb are too close together here for the share to be separated from them, so no share is shown. The simulation is using ${circuit.recirculationFraction.toFixed(3)}.`
            : `Rearranged, the same relationship returns a share of ${impliedFraction.toFixed(3)}, which is the ${circuit.recirculationFraction.toFixed(3)} this simulation is using. That agreement is a property of the model, not a measurement.`}
        </TextEquivalent>

        <ModelBoundary>
          This is the mixing relationship this simulation uses to produce its own numbers. It is not
          a validated bedside method for estimating recirculation from two saturations, and the
          systemic value in it is a model estimate rather than anything the CARDIOHELP measures.
        </ModelBoundary>

        <ModelBoundary>
          This simulation takes the recirculating share from the authored case. Raising the pump
          speed here does not move it, so nothing on this page should be read as showing what speed
          does to recirculation at the bedside.
        </ModelBoundary>
      </section>

      <GuidedValue
        guide={ecmoDerivedValueGuides.recirculationFraction}
        value={round(circuit.recirculationFraction, 3)}
        headingLevel={3}
      />
      <GuidedValue
        guide={ecmoDerivedValueGuides.recirculationAdjustedCircuitFlow}
        value={round(circuit.recirculationAdjustedCircuitFlowLpm, 2)}
        headingLevel={3}
      />
      <GuidedValue
        guide={ecmoDerivedValueGuides.venousLineSaturation}
        value={circuit.readouts.venousLineSaturation.displayed}
        headingLevel={3}
      />
      <GuidedValue
        guide={ecmoDerivedValueGuides.systemicVenousSaturationEstimate}
        value={round(patient.systemicVenousSaturationEstimate, 1)}
        headingLevel={3}
      />
    </div>
  )
}

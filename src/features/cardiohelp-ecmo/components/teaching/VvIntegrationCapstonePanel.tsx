import { ecmoDerivedValueGuides } from '../../content/ecmoValueGuides'
import type { EcmoChannelReadout, EcmoSimulationState } from '../../engine/types'
import {
  CapstoneMatrixCellBody,
  matrixCellEquivalent,
  rowQuotesGrammar,
  type CapstoneMatrixCell,
} from './capstoneGrammarCell'
import { GuidedValue, ModelBoundary, TextEquivalent, round, styles } from './shared'

/**
 * One presentation, four explanations, and the discipline of not acting on the flow display.
 *
 * The matrix is directional on purpose: what separates these four is which signal moves and in
 * which direction, not any cut point. Every cell also carries the finding that discriminates it and
 * — where this simulation cannot show the mechanism honestly — the limitation that applies.
 *
 * Two of those limitations are load-bearing and were read off the engine rather than assumed:
 *
 *   - the membrane-resistance preset in this simulation also constrains circuit flow, so its
 *     displayed flow falls rather than staying put, and the panel says so;
 *   - no preset isolates a patient-side deterioration while leaving the circuit untouched, so the
 *     patient-side column is a source-backed hypothesis card rather than a preview to load.
 *
 * The membrane and gas-path columns are two rows of the diagnostic grammar, so in the three pressure
 * rows their cells quote the grammar row rather than restating it — see `capstoneGrammarCell.tsx`.
 */

type HypothesisId =
  | 'recirculation'
  | 'membrane-dysfunction'
  | 'gas-side-interruption'
  | 'patient-side-change'

const hypotheses: readonly { readonly id: HypothesisId; readonly label: string }[] = [
  { id: 'recirculation', label: 'Recirculation has risen' },
  { id: 'membrane-dysfunction', label: 'The membrane is failing' },
  { id: 'gas-side-interruption', label: 'The gas side is interrupted' },
  { id: 'patient-side-change', label: 'The patient has changed' },
]

interface MatrixRow {
  readonly id: string
  readonly label: string
  readonly read: (state: EcmoSimulationState) => {
    readonly text: string
    /** Reason-specific text when a channel reports no number. */
    readonly reason?: string
  }
  readonly cells: Readonly<Record<HypothesisId, CapstoneMatrixCell>>
}

/** This panel describes a venovenous circuit; the grammar rows are resolved for that track. */
const SUPPORT_MODE = 'vv'

function channelText(readout: EcmoChannelReadout, unit: string, precision = 0) {
  return readout.displayed === null
    ? { text: '--', reason: readout.reason }
    : { text: `${readout.displayed.toFixed(precision)} ${unit}` }
}

const rows: readonly MatrixRow[] = [
  {
    id: 'displayed-circuit-flow',
    label: 'Displayed circuit flow',
    read: (state) => ({ text: `${state.circuit.bloodFlow.toFixed(2)} L/min` }),
    cells: {
      recirculation: {
        direction: 'Unchanged or higher — recirculated blood is counted the same as any other.',
        discriminator:
          'A flow that has risen while the patient has worsened is the pattern that should stop you.',
      },
      'membrane-dysfunction': {
        direction:
          'Falls in this simulation, because the membrane resistance also constrains flow.',
        discriminator:
          'Read the gradient rather than the flow. The gradient is what separates a membrane problem from a return-side one.',
        limitation:
          'A membrane can lose gas transfer at the bedside without its resistance having risen enough to constrain flow. This simulation couples the two, so do not take an unchanged flow here as ruling a membrane problem out.',
      },
      'gas-side-interruption': {
        direction: 'Unchanged. The pump keeps moving blood through a membrane receiving no gas.',
        discriminator:
          'This is the failure the flow display is completely silent about, in this simulation and at the bedside.',
      },
      'patient-side-change': {
        direction: 'Unchanged. Nothing about the circuit has been altered.',
        discriminator:
          'The circuit is doing what it was doing before, against a demand that has changed.',
      },
    },
  },
  {
    id: 'pVen',
    label: 'pVen (drainage)',
    read: (state) => channelText(state.circuit.readouts.pVen, 'mmHg'),
    cells: {
      recirculation: {
        direction: 'Little changed, or slightly more negative as the circuit pulls harder.',
        discriminator:
          'Drainage is not the limit here, which is what separates this from a preload problem.',
      },
      'membrane-dysfunction': {
        grammarRowId: 'membrane-resistance',
        discriminator:
          'A drainage pressure that has not moved argues against the drainage side; the problem sits downstream of the pump.',
      },
      'gas-side-interruption': {
        grammarRowId: 'gas-path-failure',
        discriminator:
          'The gas path has no pressure channel in it at all, so every circuit pressure staying still while gas exchange collapses is itself the finding.',
      },
      'patient-side-change': {
        direction:
          'Depends entirely on the change: a volume or intrathoracic-pressure change moves it, a rise in demand does not.',
        discriminator:
          'A drainage pressure that has become more negative points at volume or at what is around the cannula, not at consumption.',
        limitation:
          'This simulation has no preset that raises demand while leaving the circuit alone, so this row cannot be demonstrated here.',
      },
    },
  },
  {
    id: 'pInt-and-pArt',
    label: 'pInt and pArt',
    read: (state) => {
      const pInt = channelText(state.circuit.readouts.pInt, 'mmHg')
      const pArt = channelText(state.circuit.readouts.pArt, 'mmHg')
      return {
        text: `pInt ${pInt.text} · pArt ${pArt.text}`,
        ...(pInt.reason || pArt.reason
          ? { reason: [pInt.reason, pArt.reason].filter(Boolean).join(' ') }
          : {}),
      }
    },
    cells: {
      recirculation: {
        direction: 'Both drift up together with the higher flow the pump is producing.',
        discriminator: 'They move because flow moved. Nothing has separated them from one another.',
      },
      'membrane-dysfunction': {
        grammarRowId: 'membrane-resistance',
        discriminator:
          'Separation between the two is the membrane signature; rising together is the return-side one.',
      },
      'gas-side-interruption': {
        grammarRowId: 'gas-path-failure',
        discriminator:
          'Both unchanged: gas transfer has failed with the blood path entirely undisturbed.',
      },
      'patient-side-change': {
        direction: 'Unchanged.',
        discriminator: 'A patient-side change leaves the membrane-side pressures where they were.',
      },
    },
  },
  {
    id: 'deltaP-trend',
    label: 'ΔP across the membrane, over time',
    read: (state) => channelText(state.circuit.readouts.deltaP, 'mmHg'),
    cells: {
      recirculation: {
        direction: 'Higher, but only in proportion to the higher flow carrying it.',
        discriminator:
          'A gradient read without its flow is not interpretable. Compare it at a similar flow before calling it a membrane change.',
      },
      'membrane-dysfunction': {
        grammarRowId: 'membrane-resistance',
        discriminator:
          'This is the single most useful row for this explanation, provided the flow it was measured at is known — and a widening that continues over a run says more than any one reading.',
      },
      'gas-side-interruption': {
        grammarRowId: 'gas-path-failure',
        discriminator: 'Unchanged: the membrane is intact, and nothing is reaching its gas side.',
      },
      'patient-side-change': {
        direction: 'Unchanged.',
        discriminator: 'The gradient belongs to the device, not to the patient.',
      },
    },
  },
  {
    id: 'venous-line-svo2',
    label: 'Venous-line SvO₂ (device-displayed)',
    read: (state) => channelText(state.circuit.readouts.venousLineSaturation, '', 1),
    cells: {
      recirculation: {
        direction:
          'Rises, because freshly oxygenated return blood is being drawn straight back into the drainage limb.',
        discriminator:
          'A rising drainage saturation alongside a worsening patient is the recirculation signature and the reason this value is not reassurance.',
      },
      'membrane-dysfunction': {
        direction: 'Falls, following the systemic value down.',
        discriminator: 'It falls here rather than rising, which is the opposite of recirculation.',
      },
      'gas-side-interruption': {
        direction: 'Falls, and falls with the systemic value rather than away from it.',
        discriminator:
          'The gap between this value and the systemic estimate stays small, which recirculation would widen.',
      },
      'patient-side-change': {
        direction: 'Falls if extraction has risen or delivery has fallen.',
        discriminator:
          'It moves with the systemic value, so it does not separate a patient-side change from a membrane one on its own.',
      },
    },
  },
  {
    id: 'systemic-venous-estimate',
    label: 'Systemic venous saturation (model estimate)',
    read: (state) => ({
      text: state.patient.systemicVenousSaturationEstimate.toFixed(1),
    }),
    cells: {
      recirculation: {
        direction: 'Falls while the displayed venous-line value rises.',
        discriminator:
          'The two moving in opposite directions is what makes recirculation visible at all.',
        limitation:
          'No sensor reads this. It exists only inside this simulation and is shown to make the divergence legible.',
      },
      'membrane-dysfunction': {
        direction: 'Falls, together with the venous-line value.',
        discriminator: 'Both fall together, so the divergence recirculation produces is absent.',
        limitation: 'Modeled, not measured.',
      },
      'gas-side-interruption': {
        direction: 'Falls, together with the venous-line value.',
        discriminator:
          'The direction is shared with a membrane problem; the gas-side status and the gradient are what separate them.',
        limitation: 'Modeled, not measured.',
      },
      'patient-side-change': {
        direction: 'Falls if consumption has risen or systemic flow has fallen.',
        discriminator:
          'A fall here with an entirely undisturbed circuit is what a patient-side change would look like.',
        limitation:
          'This simulation drives native cardiac output to a fixed value in VV and offers no preset that raises consumption alone, so this cannot be shown live here.',
      },
    },
  },
  {
    id: 'post-oxygenator-saturation',
    label: 'Post-oxygenator saturation',
    read: (state) => ({ text: state.circuit.postOxygenatorSaturation.toFixed(1) }),
    cells: {
      recirculation: {
        direction: 'Unchanged. The membrane is doing exactly what it was doing.',
        discriminator:
          'A normal-looking membrane output beside a rising drainage saturation points at where the blood went, not at the device.',
      },
      'membrane-dysfunction': {
        direction: 'Falls. Blood is crossing a device that is no longer transferring gas properly.',
        discriminator:
          'Comparing this value with the drainage value is the most direct look at whether the membrane is working.',
      },
      'gas-side-interruption': {
        direction: 'Falls, and falls sharply — there is no gradient for it to work against.',
        discriminator:
          'It falls here for the same reason it falls in membrane failure, so the gradient and the gas connection are what separate them.',
      },
      'patient-side-change': {
        direction: 'Little changed, because the membrane and its gas supply are untouched.',
        discriminator:
          'A membrane still producing its usual output while the patient worsens moves attention off the circuit.',
      },
    },
  },
  {
    id: 'paco2-and-ph',
    label: 'PaCO₂ and pH',
    read: (state) => ({
      text: `${state.patient.paCO2.toFixed(1)} mmHg · pH ${state.patient.pH.toFixed(2)}`,
    }),
    cells: {
      recirculation: {
        direction: 'Little changed in this simulation.',
        discriminator:
          'Carbon dioxide clearance is governed by the gas side, which recirculation has not touched.',
        limitation:
          'At the bedside a large fall in useful support can eventually affect clearance too. This simulation keeps the two separate.',
      },
      'membrane-dysfunction': {
        direction: 'Would be expected to rise as transfer is lost.',
        discriminator: 'A rise here alongside a rising gradient points firmly at the device.',
        limitation:
          'The membrane-resistance preset in this simulation leaves the carbon dioxide value unchanged, so this row cannot be demonstrated with it.',
      },
      'gas-side-interruption': {
        direction: 'Rises quickly, with the pH following it down.',
        discriminator:
          'Speed is the discriminator. Nothing else on this list moves carbon dioxide this fast.',
      },
      'patient-side-change': {
        direction:
          'Rises if production has risen or if the native lung has lost what it was contributing.',
        discriminator:
          'It moves more slowly than a gas-side interruption, and the gas connection is intact.',
        limitation: 'Not demonstrable in this simulation for the reason given above.',
      },
    },
  },
  {
    id: 'patient-spo2',
    label: 'Patient SpO₂',
    read: (state) => ({ text: state.patient.spo2.toFixed(1) }),
    cells: {
      recirculation: {
        direction: 'Falls, because the flow that reaches the tissues has fallen.',
        discriminator:
          'Falling systemic oxygenation with a rising displayed flow is the pairing that matters.',
      },
      'membrane-dysfunction': {
        direction: 'Falls.',
        discriminator: 'Shared with every other explanation here, so it discriminates nothing.',
      },
      'gas-side-interruption': {
        direction: 'Falls.',
        discriminator: 'Shared with every other explanation here, so it discriminates nothing.',
      },
      'patient-side-change': {
        direction: 'Falls.',
        discriminator:
          'Shared with every other explanation here. This is the presenting problem, not the finding that separates them.',
      },
    },
  },
  {
    id: 'gas-source-status',
    label: 'Gas-source connection and sweep setting',
    read: (state) => ({
      text: state.gas.sourceConnected
        ? `connected · sweep ${state.gas.sweepLpm.toFixed(1)} L/min`
        : `interrupted · sweep set to ${state.gas.sweepLpm.toFixed(1)} L/min`,
    }),
    cells: {
      recirculation: {
        direction: 'Intact.',
        discriminator: 'Checking it costs nothing and removes one explanation from the list.',
      },
      'membrane-dysfunction': {
        direction: 'Intact.',
        discriminator:
          'A membrane cannot be blamed for not exchanging until it has been established that gas is reaching it.',
      },
      'gas-side-interruption': {
        direction: 'Interrupted — this is the finding itself.',
        discriminator:
          'A sweep setting on a control does not establish that gas is arriving at the membrane. The connection has to be looked at.',
      },
      'patient-side-change': {
        direction: 'Intact.',
        discriminator: 'Same reasoning: check the cheap, fast, reversible path first.',
      },
    },
  },
  {
    id: 'bedside-and-ventilator-findings',
    label: 'Bedside and ventilator findings',
    read: (state) => ({
      text: `work of breathing ${state.patient.workOfBreathing} · respiratory rate ${state.patient.respiratoryRate} · airway pressure ${state.patient.airwayPressure} cmH₂O · lung sliding ${state.patient.lungSliding} · MAP ${state.patient.meanArterialPressure} mmHg · lactate ${state.patient.lactate}`,
    }),
    cells: {
      recirculation: {
        direction:
          'Unremarkable, or reflecting the fall in support rather than a new lung finding.',
        discriminator:
          'A cannula that has moved may have moved for a reason that is visible at the bedside — position changes, coughing, a volume shift.',
      },
      'membrane-dysfunction': {
        direction: 'Unremarkable. The problem is in the device.',
        discriminator: 'The absence of a new bedside finding moves attention onto the circuit.',
      },
      'gas-side-interruption': {
        direction:
          'Unremarkable, apart from a disconnected or occluded gas line that is found by looking at it.',
        discriminator:
          'The finding is at the gas panel and the tubing, not on the patient. It is found by inspection.',
      },
      'patient-side-change': {
        direction:
          'This is where a patient-side change shows itself: new ventilator mechanics, a new chest finding, a change in temperature, sedation, agitation, or rising demand.',
        discriminator:
          'A new bedside or ventilator finding with an entirely undisturbed circuit is the strongest evidence for this explanation.',
        limitation:
          'This simulation holds these findings essentially fixed across the VV presets, so the row is authored teaching rather than something the modeled case will show you.',
      },
    },
  },
]

/**
 * Where the differential runs out of what this simulation can show.
 *
 * Kept as content rather than a comment so it is rendered to the learner rather than only to a
 * reviewer. Both entries were established by running the engine, not by assumption.
 */
const modelLimitations: readonly { readonly id: string; readonly text: string }[] = [
  {
    id: 'no-isolated-patient-side-preset',
    text: 'No state in this simulation isolates a patient-side deterioration while leaving the circuit untouched. Native cardiac output is driven to a fixed value in venovenous support, the modeled oxygen consumption is authored per case rather than something a case changes over time, and the presets that do deteriorate a patient — a volume loss, a tension pneumothorax — also limit drainage, so their circuit does change. The column beside is therefore authored teaching supported by the sources, not a preview you can load.',
  },
  {
    id: 'membrane-preset-also-constrains-flow',
    text: 'The membrane-resistance preset in this simulation also constrains circuit flow, so its displayed flow falls rather than staying where it was, and it leaves the carbon dioxide value unchanged. Both are simplifications. Read that preview for the gradient it produces, not as an example of an unchanged flow display.',
  },
]

export function VvIntegrationCapstonePanel({ state }: { readonly state: EcmoSimulationState }) {
  const { circuit, patient, gas } = state

  return (
    <div className={styles.panel} data-teaching-panel="vv-integration-capstone">
      <section className={styles.section} aria-labelledby="capstone-flow-heading">
        <h3 id="capstone-flow-heading" className={styles.heading}>
          The one signal that cannot settle this
        </h3>
        <p className="mt-2 text-sm leading-6" data-flow-cannot-discriminate>
          Displayed circuit flow is {circuit.bloodFlow.toFixed(2)} L/min. Every explanation on this
          page is compatible with that number, which is exactly why it is the wrong place to act
          from. Work instead from what each explanation predicts somewhere else.
        </p>
        <p className="mt-2 text-sm leading-6">
          Begin by naming what has actually gone wrong in front of you: oxygenation, ventilation, or
          both. Patient SpO₂ is {patient.spo2.toFixed(1)}, the arterial carbon dioxide value is{' '}
          {patient.paCO2.toFixed(1)} mmHg and the pH is {patient.pH.toFixed(2)}. The gas source is{' '}
          {gas.sourceConnected ? 'connected' : 'interrupted'}.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="hypothesis-matrix-heading">
        <h3 id="hypothesis-matrix-heading" className={styles.heading}>
          What each explanation predicts, and what this case shows
        </h3>
        <p className="mt-2 text-sm leading-6">
          Directions, not numbers. A hypothesis is not excluded because one modeled value is absent
          or because one row does not separate it — a row that discriminates nothing is reported as
          discriminating nothing.
        </p>
        <p className="mt-2 text-sm leading-6" data-grammar-reference-note>
          Two of these explanations — the membrane and the gas path — are two of the four pressure
          patterns taught with the pump and its pressures. In the three pressure rows their cells
          quote that pattern rather than restating it, and the other columns are marked as patterns
          the four do not cover.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[64rem] text-left text-sm" data-hypothesis-matrix>
            <caption className="sr-only">
              Each observed signal with its live value in the case currently loaded, and the
              direction each of the four explanations predicts for it, together with what makes that
              row useful and any limitation that applies.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="pb-1 pr-3 align-bottom font-semibold">
                  Signal
                </th>
                <th scope="col" className="pb-1 pr-3 align-bottom font-semibold">
                  In this case now
                </th>
                {hypotheses.map((hypothesis) => (
                  <th
                    key={hypothesis.id}
                    scope="col"
                    className="pb-1 pr-3 align-bottom font-semibold"
                    data-hypothesis-column={hypothesis.id}
                  >
                    {hypothesis.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const live = row.read(state)
                return (
                  <tr key={row.id} data-matrix-row={row.id} className="align-top">
                    <th scope="row" className="py-2 pr-3 font-medium">
                      {row.label}
                    </th>
                    <td className="py-2 pr-3" data-live-finding={row.id}>
                      {live.text}
                      {live.reason ? (
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {live.reason}
                        </span>
                      ) : null}
                    </td>
                    {hypotheses.map((hypothesis) => (
                      <td
                        key={hypothesis.id}
                        className="py-2 pr-3"
                        data-matrix-cell={`${row.id}:${hypothesis.id}`}
                      >
                        <CapstoneMatrixCellBody
                          cell={row.cells[hypothesis.id]}
                          supportMode={SUPPORT_MODE}
                          outsideGrammar={rowQuotesGrammar(row.cells)}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {hypotheses.map((hypothesis) => (
          <TextEquivalent key={hypothesis.id}>
            <span className="font-semibold">{hypothesis.label}. </span>
            {rows
              .map(
                (row) =>
                  `${row.label}: ${matrixCellEquivalent(row.cells, hypothesis.id, SUPPORT_MODE)}`,
              )
              .join(' ')}{' '}
            {rows
              .filter((row) => row.cells[hypothesis.id].limitation)
              .map((row) => `Limitation for ${row.label}: ${row.cells[hypothesis.id].limitation}`)
              .join(' ')}
          </TextEquivalent>
        ))}

        <ModelBoundary>
          The directions in the matrix are what these mechanisms do. The magnitudes and the speed at
          which the modeled values reach them belong to this simulation, and two of the rows cannot
          be shown live here at all — the limitations below say which and why.
        </ModelBoundary>
      </section>

      <section className={styles.section} aria-labelledby="patient-side-heading">
        <h3 id="patient-side-heading" className={styles.heading}>
          The patient-side explanation
        </h3>
        <div className="mt-3 rounded-xl border border-dashed p-3" data-patient-side-hypothesis>
          <p className="text-sm leading-6">
            The patient may simply have changed. Native lung injury can progress, consumption can
            rise with fever, agitation, work of breathing or a new infection, and native cardiac
            output can move — and in every one of those the circuit goes on doing precisely what it
            was doing before, against a demand that is no longer the same.
          </p>
          <p className="mt-2 text-sm leading-6">
            What it predicts is findings away from the console: new ventilator mechanics or a
            changed compliance, a new chest examination or imaging finding, a temperature or
            sedation change, a rise in the work of breathing, or a fall in hemoglobin. The circuit
            pressures, the gradient, the post-membrane saturation and the gas connection would all
            be undisturbed.
          </p>
          <p className="mt-2 text-sm leading-6">
            It is a full member of this differential and not a diagnosis of exclusion. Reaching it
            by ruling everything else out is a different, and weaker, piece of reasoning than
            reaching it by finding what it predicts.
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="capstone-limitations-heading">
        <h3 id="capstone-limitations-heading" className={styles.heading}>
          Where this simulation stops
        </h3>
        <ul className="mt-3 grid gap-2" data-model-limitations>
          {modelLimitations.map((limitation) => (
            <li
              key={limitation.id}
              className="rounded-xl border px-3 py-2 text-sm leading-6"
              data-model-limitation={limitation.id}
            >
              {limitation.text}
            </li>
          ))}
        </ul>
      </section>

      <GuidedValue
        guide={ecmoDerivedValueGuides.transmembraneDeltaP}
        value={circuit.readouts.deltaP.displayed}
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
      <GuidedValue
        guide={ecmoDerivedValueGuides.recirculationAdjustedCircuitFlow}
        value={round(circuit.recirculationAdjustedCircuitFlowLpm, 2)}
        headingLevel={3}
      />
    </div>
  )
}

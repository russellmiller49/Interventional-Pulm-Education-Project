'use client'

import { ecmoLocalizationRow, type EcmoLocalizationRowId } from '../../../content/localizationCards'
import type { EcmoSimulationState } from '../../../engine/types'
import { isInterpretable } from '../../channelReadout'
import { DrillLivePanelFrame } from './DrillLivePanelFrame'
import { Discriminators, PatternReading, type DrillPatternRow } from './drillPanelPrimitives'

/**
 * The live readings for the two post-pump resistance drills: a load on the return path, and a load
 * in the membrane.
 *
 * They are one reading taught twice. Flow falls at an unchanged speed in both; what separates them
 * is whether the two post-pump pressures rose together or drew apart, which is the gradient across
 * the membrane. So both panels list the same channels in the same order, live, and ask the same
 * questions of them. Nothing here says which way the pattern came out: the cause and the response
 * stay in the drill's written explanation under this panel, exactly as they were.
 *
 * The reading prompts and the first and last question are the drainage panel's own, word for word,
 * because they are the same channels read the same way; the model limit is the localization
 * row's. No sentence here uses the words the return drill's own question holds back
 * (`precommitDenyPatterns`), since this panel is on the page before any answer.
 */

const CLINICAL_QUESTION =
  'Flow has fallen at an unchanged pump speed. Which of this circuit’s pressures moved with it, and what does the gradient across the membrane say about where the load is?'

function PostPumpResistanceLivePanel({
  state,
  rowId,
  showsPostOxygenatorSaturation,
}: {
  readonly state: EcmoSimulationState
  readonly rowId: EcmoLocalizationRowId
  /** The membrane's own output belongs in the reading when the membrane is the question. */
  readonly showsPostOxygenatorSaturation: boolean
}) {
  const row = ecmoLocalizationRow(rowId)
  const va = state.supportMode === 'va'
  const { readouts } = state.circuit
  // A direction read off channels that are not reporting would be a fabricated one.
  const downstreamReadable = isInterpretable(readouts.pInt) && isInterpretable(readouts.pArt)

  const rows: DrillPatternRow[] = [
    {
      label: 'Flow against speed',
      reading: `Flow ${state.circuit.bloodFlow.toFixed(2)} L/min at ${state.device.rpmSetpoint} rpm`,
      movement: `The speed this case opened at is ${state.scenario.baselineRpmSetpoint} rpm.`,
    },
    {
      label: 'Upstream of the pump',
      reading: `pVen ${readouts.pVen.displayed === null ? 'is not reporting' : `${readouts.pVen.displayed.toFixed(0)} mmHg`}`,
      movement:
        'The one channel upstream of the pump. Note which way it has moved and by how much.',
    },
    {
      label: 'Downstream of the pump',
      reading: downstreamReadable
        ? `pInt ${readouts.pInt.displayed?.toFixed(0)} mmHg, pArt ${readouts.pArt.displayed?.toFixed(0)} mmHg`
        : 'Not reporting in this state',
      movement: downstreamReadable
        ? 'Read these against the flow beside them, and against where they have sat all shift.'
        : 'No direction can be read off channels that are not reporting.',
    },
    {
      label: 'Across the membrane',
      reading:
        readouts.deltaP.displayed === null
          ? 'Not reporting in this state'
          : `Δp ${readouts.deltaP.displayed.toFixed(0)} mmHg`,
      movement: 'Note whether it has widened or narrowed, and compare that with what the flow did.',
    },
  ]
  if (showsPostOxygenatorSaturation) {
    rows.push({
      label: 'Leaving the membrane',
      reading: `Post-oxygenator saturation ${state.circuit.postOxygenatorSaturation.toFixed(1)} %`,
      movement: 'A sampled circuit value, not a channel on this console.',
    })
  }
  if (va) {
    rows.push({
      label: 'The patient’s own pressure',
      reading: `Mean arterial pressure ${state.patient.meanArterialPressure} mmHg`,
      movement: 'Read from its own monitor beside the circuit pressures, never inferred from them.',
    })
  }

  return (
    <DrillLivePanelFrame
      scenarioId={state.scenario.scenarioId}
      supportMode={state.supportMode}
      clinicalQuestion={CLINICAL_QUESTION}
      boundary={row.modelBoundary}
    >
      <PatternReading
        title="The readings, in the order they are read"
        headingId="drill-live-pattern-heading"
        rows={rows}
        summary={`Flow ${state.circuit.bloodFlow.toFixed(2)} L/min at ${state.device.rpmSetpoint} rpm. The pressure channels are ${downstreamReadable ? 'reporting' : 'not all reporting in this state'}. The channel upstream of the pump, the two downstream of it and the gradient between those two are listed separately, because which of them moved is what has to be established.`}
      />

      <Discriminators
        items={[
          {
            question:
              'Did the pressures downstream of the pump rise against the falling flow, or fall with it?',
            whereToLook: 'pInt and pArt above, read together with the flow beside them.',
          },
          {
            question: 'Did the two pressures downstream of the pump move together, or draw apart?',
            whereToLook:
              'Δp is the difference between them. Read it at similar blood flow, against this circuit’s own earlier value.',
          },
          {
            question:
              'If a setting were changed now, would that be a treatment for whatever is limiting this circuit, or something else?',
            whereToLook:
              'Nothing listed above is a setting the circuit is short of. Ask what a change would and would not correct.',
          },
        ]}
      />
    </DrillLivePanelFrame>
  )
}

/** Return obstruction: flow falls and the circuit's pressures are read for where the load is. */
export function ReturnObstructionLivePanel({ state }: { readonly state: EcmoSimulationState }) {
  return (
    <PostPumpResistanceLivePanel
      state={state}
      rowId="return-path-resistance"
      showsPostOxygenatorSaturation={false}
    />
  )
}

/** Oxygenator resistance: the same reading, with the membrane's own output beside it. */
export function OxygenatorResistanceLivePanel({ state }: { readonly state: EcmoSimulationState }) {
  return (
    <PostPumpResistanceLivePanel
      state={state}
      rowId="membrane-resistance"
      showsPostOxygenatorSaturation
    />
  )
}

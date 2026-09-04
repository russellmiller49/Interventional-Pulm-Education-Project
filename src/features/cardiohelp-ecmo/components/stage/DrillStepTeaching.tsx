'use client'

import { ECMO_CONTROL_PANEL } from '../../content/controlPanel'
import { ecmoDrillSpecs, type EcmoKnobState, type EcmoKnobStrip } from '../../content/drillSpecs'
import type { ScenarioDefinition } from '../../engine/types'
import { EcmoSourceList } from '../evidence/EcmoSourceList'
import { useStageSourcesCollected } from './StageSourcesScope'
import { EcmoLocalizationCard } from '../teaching/EcmoLocalizationCard'
import { styles as teachingStyles } from '../teaching/shared'
import type { StageStep } from './stageModel'

const KNOB_STATE_LABEL: Readonly<Record<EcmoKnobState, string>> = {
  'this-knob': 'this is the control',
  'not-this-knob': 'not this control',
  'harmful-reflex': 'the reflex that does harm here',
  'not-a-control': 'not a control in this state',
}

/**
 * The small control panel, reused at every drill's Explain: which of the three knobs — if any —
 * the pattern lived on, in the same order the foundations introduced them.
 */
function KnobStrip({ strip }: { readonly strip: EcmoKnobStrip }) {
  const states: readonly { readonly id: string; readonly name: string; readonly state: string }[] =
    [
      {
        id: 'pump-speed',
        name: ECMO_CONTROL_PANEL.knobs[0].plainName,
        state: KNOB_STATE_LABEL[strip.pumpSpeed],
      },
      {
        id: 'sweep',
        name: ECMO_CONTROL_PANEL.knobs[1].plainName,
        state: KNOB_STATE_LABEL[strip.sweep],
      },
      {
        id: 'oxygen-fraction',
        name: ECMO_CONTROL_PANEL.knobs[2].plainName,
        state: KNOB_STATE_LABEL[strip.oxygenFraction],
      },
      {
        id: 'clamps',
        name: ECMO_CONTROL_PANEL.emergencyOnly[0].plainName,
        state: strip.clamps === 'this-emergency' ? 'this emergency' : 'emergency only',
      },
    ]
  return (
    <section
      className={teachingStyles.section}
      aria-labelledby="drill-knob-strip-heading"
      data-knob-strip={strip.verdict}
    >
      <h3 id="drill-knob-strip-heading" className={teachingStyles.heading}>
        The control panel, for this pattern
      </h3>
      <p className="mt-2">{strip.sentence}</p>
      <dl className="mt-3 grid gap-1">
        {states.map((knob) => (
          <div
            key={knob.id}
            className="flex flex-wrap gap-1"
            data-knob={knob.id}
            data-knob-state={knob.state}
          >
            <dt className="font-semibold">{knob.name}:</dt>
            <dd className="text-muted-foreground">{knob.state}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * Explain, from data, for every drill.
 *
 * Six drills carry an authored live teaching panel whose post-commitment blocks are their Explain.
 * The other fourteen used to show a card saying no panel had been written. This renders what every
 * scenario already carries — its diagnosis, causal chain, the response that fits and its safety
 * notes — once the prediction is committed and the step has moved past it. Before commitment it
 * says what to read and nothing about why, so the pane beside the question cannot answer it.
 */
export function DrillStepTeaching({
  scenario,
  step,
  predictionCommitted,
  hasAuthoredPanel,
}: {
  readonly scenario: ScenarioDefinition | undefined
  readonly step: StageStep
  readonly predictionCommitted: boolean
  readonly hasAuthoredPanel: boolean
}) {
  const sourcesCollectedElsewhere = useStageSourcesCollected()
  if (!scenario) return null

  if (!predictionCommitted || step.phase === 'recognize' || step.phase === 'predict') {
    if (hasAuthoredPanel) return null
    return (
      <section
        className={teachingStyles.section}
        aria-labelledby="drill-reading-note-heading"
        data-drill-reading-note
      >
        <h3 id="drill-reading-note-heading" className={teachingStyles.heading}>
          Read before you decide
        </h3>
        <p className="mt-2">
          Use the panels this step opened and compare the readings the instruction names. What
          explains the pattern, the response that fits it, and the reflex to avoid are held here
          until you have committed a prediction.
        </p>
      </section>
    )
  }

  const spec = ecmoDrillSpecs[scenario.id]
  const knobStrip = spec ? <KnobStrip strip={spec.controlPanel} /> : null

  if (hasAuthoredPanel) {
    // The authored panel carries the mechanism, the fitting response and its own grammar row; the
    // knob strip is the one thing every drill's Explain adds beside it.
    return knobStrip ? (
      <div className="grid gap-4" data-drill-explain={scenario.id}>
        {knobStrip}
      </div>
    ) : null
  }

  return (
    <div className="grid gap-4" data-drill-explain={scenario.id}>
      <section className={teachingStyles.section} aria-labelledby="drill-explain-heading">
        <h3 id="drill-explain-heading" className={teachingStyles.heading}>
          What explains it
        </h3>
        <p className="mt-2 font-semibold">{scenario.debrief.diagnosis}</p>
        <ol className="mt-3 grid gap-2 pl-5">
          {scenario.debrief.causalChain.map((link) => (
            <li key={link}>{link}</li>
          ))}
        </ol>
      </section>
      <section className={teachingStyles.section} aria-labelledby="drill-response-heading">
        <h3 id="drill-response-heading" className={teachingStyles.heading}>
          The response that fits
        </h3>
        <ol className="mt-2 grid gap-2 pl-5">
          {scenario.debrief.correctWorkflow.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>
      {scenario.debrief.safetyNotes.length > 0 ? (
        <section className={teachingStyles.section} aria-labelledby="drill-safety-heading">
          <h3 id="drill-safety-heading" className={teachingStyles.heading}>
            Safety notes
          </h3>
          <ul className="mt-2 grid gap-2 pl-5">
            {scenario.debrief.safetyNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {spec?.localizationRowId ? (
        <EcmoLocalizationCard
          mode="revealed-row"
          rowId={spec.localizationRowId}
          supportMode={scenario.supportMode}
        />
      ) : null}
      {knobStrip}
      {step.phase === 'transfer' && spec ? (
        <section className={teachingStyles.section} aria-labelledby="drill-transfer-heading">
          <h3 id="drill-transfer-heading" className={teachingStyles.heading}>
            What carries forward
          </h3>
          <p className="mt-2">{spec.transferPrinciple}</p>
        </section>
      ) : null}
      {/*
        Provenance, where the panel stands on its own. Inside the stage the footer cites this
        drill's whole set in one place, so the heading goes with the list rather than staying
        behind as an empty section. See `stage/StageSourcesScope`.
      */}
      {sourcesCollectedElsewhere ? null : (
        <section className={teachingStyles.section} aria-labelledby="drill-sources-heading">
          <h3 id="drill-sources-heading" className={teachingStyles.heading}>
            Sources for this pattern
          </h3>
          <div className="mt-2" data-drill-sources>
            <EcmoSourceList
              compact
              evidenceIds={scenario.evidenceIds}
              labelledBy="drill-sources-heading"
            />
          </div>
        </section>
      )}
    </div>
  )
}

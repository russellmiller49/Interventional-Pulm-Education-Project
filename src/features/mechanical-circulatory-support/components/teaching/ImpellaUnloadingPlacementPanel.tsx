import {
  HeldDisagreement,
  MeasurementClarification,
} from '@/features/critical-care/components/teaching/EvidenceRenderers'
import { criticalCareMeasurementClarificationById } from '@/features/critical-care/content/measurementClarifications'
import { criticalCareSourceConflictById } from '@/features/critical-care/content/sourceConflicts'

import { MCS_PRODUCT_FLOW_BOUNDARY } from '../../content/supportPathways'
import type { McsTeachingPanelProps } from './panelProps'
import { mcsComparesAgainstActionBaseline, mcsMechanismDisclosed } from './revealStage'
import {
  MCS_ESTIMATED_FLOW_BOUNDARY,
  activeAlarms,
  beforeAfterReadings,
  displaySignalNumber,
  flowAccountView,
  impellaView,
  mcsComparisonPathways,
  reading,
} from './selectors'
import {
  AfterCommitment,
  AlarmBand,
  BeforeAfter,
  DEADBAND_CAPTION,
  FigureScope,
  FlowAccount,
  LiveSetting,
  LiveValue,
  ModelBoundary,
  PanelSection,
  PathwayGraphic,
  TextEquivalent,
  TransferState,
  alarmSentence,
  beforeAfterSentence,
  flowAccountSentence,
  pathwaySentence,
  styles,
} from './shared'

/**
 * Section 5 — the chain from where the inlet is sitting to what the circulation receives.
 *
 * Drawn as a chain rather than as a dashboard, because the section's whole claim is that these five
 * things are links: position, then what the pump has available to draw and the gradient it works
 * across, then the flow it estimates, then whether the chamber is actually smaller, then what
 * reaches the body. A learner who sees them as five independent readouts reaches for the setting;
 * a learner who sees them as a chain looks at the first link.
 *
 * The two Impella evidence surfaces sit at the bottom and mean different things. The manufacturer
 * figures are a *measurement clarification* — several numbers measuring different quantities. The
 * textbook pair is a *held disagreement* — one source contradicting itself. Neither is rendered as
 * the other, and nothing here averages anything.
 */

/**
 * The two evidence records this section is required to render, resolved at import.
 *
 * Resolved eagerly and loudly: a missing record would otherwise render as a silently absent
 * disclosure, and the absence of a held disagreement looks exactly like agreement.
 */
function requireClarification(id: string) {
  const record = criticalCareMeasurementClarificationById.get(id)
  if (!record)
    throw new Error(`MCS placement panel: measurement clarification ${id} is not registered`)
  return record
}

function requireConflict(id: string) {
  const record = criticalCareSourceConflictById.get(id)
  if (!record) throw new Error(`MCS placement panel: source conflict ${id} is not registered`)
  return record
}

const clarification = requireClarification('clarification.mcs.impella-cp-flow-measurands')
const conflict = requireConflict('conflict.mcs.impella-cp-textbook-flow')

interface ChainLink {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly kind: string
  readonly detail: string
}

export function ImpellaUnloadingPlacementPanel({
  contract,
  state,
  reveal,
  beforeMetrics,
}: McsTeachingPanelProps) {
  const disclosed = mcsMechanismDisclosed(reveal)
  const metrics = state.metrics
  const pump = impellaView(state)
  const account = flowAccountView(state)
  const alarms = activeAlarms(state)
  const gradient = displaySignalNumber(state, 'leftPressureGradientMmHg')
  const rows = beforeAfterReadings(
    [
      {
        metric: 'leftDeviceFlowLMin',
        label: 'Displayed pump flow',
        unit: 'L/min',
        kind: 'estimated',
      },
      {
        metric: 'effectiveSystemicFlowLMin',
        label: 'Effective systemic delivery',
        unit: 'L/min',
        kind: 'reasoned',
      },
      { metric: 'nativeFlowLMin', label: 'Native contribution', unit: 'L/min', kind: 'modeled' },
      {
        metric: 'lvedvMl',
        label: 'Left ventricular end-diastolic volume',
        unit: 'mL',
        digits: 0,
        kind: 'modeled',
      },
      { metric: 'pcwpMmHg', label: 'Wedge pressure', unit: 'mm Hg', digits: 0, kind: 'modeled' },
      {
        metric: 'mapMmHg',
        label: 'Mean arterial pressure',
        unit: 'mm Hg',
        digits: 0,
        kind: 'modeled',
      },
    ],
    beforeMetrics,
    metrics,
  )

  const chain: readonly ChainLink[] = [
    {
      id: 'position',
      label: '1 · Where the inlet is sitting',
      value: pump?.leftPositionWords ?? 'no transvalvular pathway in place',
      kind: 'modeled placement state',
      detail:
        'An anatomical relationship between the inlet, the aortic valve and the outlet — not a depth reading.',
    },
    {
      id: 'gradient',
      label: '2 · What the pump works across',
      value:
        gradient === null
          ? 'not reported in this state'
          : `${reading(gradient, 0)} mm Hg between the aorta and the left-sided filling pressure`,
      kind: 'modeled',
      detail:
        'The pressure difference the pump has to move blood across, together with whatever is available to draw from inside the chamber.',
    },
    {
      id: 'estimated-flow',
      label: '3 · What the pump estimates it is moving',
      value: `${reading(metrics.leftDeviceFlowLMin, 1)} L/min`,
      kind: 'estimated',
      detail: `At performance level ${pump ? pump.leftLevel : '—'}. The level is a setting; this figure is what the pump believes it achieved.`,
    },
    {
      id: 'unloading',
      label: '4 · Whether the chamber is actually smaller',
      value: `${reading(metrics.lvedvMl, 0)} mL end-diastolic volume · wedge ${reading(metrics.pcwpMmHg, 0)} mm Hg · aortic valve ${metrics.aorticValveOpening ? 'opening' : 'not opening'}`,
      kind: 'modeled',
      detail:
        'Unloading is the removal of volume. This is where the claim in the link above is checked against the chamber it was supposed to relieve.',
    },
    {
      id: 'effective',
      label: '5 · What reaches the circulation',
      value: `${reading(metrics.effectiveSystemicFlowLMin, 1)} L/min`,
      kind: 'reasoned',
      detail:
        'Native contribution and pump flow reconciled, with anything that regurgitates back into the chamber taken out.',
    },
  ]

  return (
    <div className={styles.panel} data-teaching-panel={contract.sectionId}>
      <PanelSection title="The pathway, and the position it depends on" id="placement-pathway">
        <PathwayGraphic pathway={mcsComparisonPathways.impellaLeft} />
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          <LiveSetting
            label="Placement state"
            value={pump?.leftPositionWords ?? 'not applicable'}
            kind="modeled"
            note="A teaching state this simulation holds, moved by a control rather than by a catheter."
          />
          <LiveValue
            label="Performance level"
            value={pump ? pump.leftLevel : null}
            digits={0}
            kind="displayed"
            note="The selected level. It sets what the pump is asked for, not what it delivers."
          />
        </div>
        <TextEquivalent>
          {pathwaySentence(mcsComparisonPathways.impellaLeft)} The modeled placement state is{' '}
          {pump?.leftPositionWords ?? 'not applicable'}, at performance level{' '}
          {pump ? pump.leftLevel : '—'}.
        </TextEquivalent>
        <ModelBoundary>
          The three placement states in this simulation — aligned, too deep, too shallow — are
          teaching states, not measurements, and the figure is a schematic rather than an image.
          Real position is confirmed with imaging and the placement signal, by qualified operators,
          under the current instructions for the specific device in use and local procedure
          standards. Nothing in this module is an insertion, advancement, or repositioning
          instruction.
        </ModelBoundary>
        <FigureScope
          establishes="Which compartment the pump draws from and which one it returns to, and what the modeled placement state currently is."
          doesNotEstablish="Where the inlet actually is in a patient. That is an imaging question, and this panel is not a placement guide."
        />
      </PanelSection>

      <PanelSection title="Position, gradient, flow, unloading, delivery" id="placement-chain">
        <ol className="mt-3 grid gap-2" data-unloading-chain>
          {chain.map((link) => (
            <li
              key={link.id}
              className="min-w-0 rounded-xl border-l-4 border-solid p-3"
              data-chain-link={link.id}
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{link.label}</p>
              <p className="mt-1 text-base font-semibold">{link.value}</p>
              <p className="text-xs leading-5 text-muted-foreground">{link.kind}</p>
              <p className="mt-1 text-xs leading-5">{link.detail}</p>
            </li>
          ))}
        </ol>
        <TextEquivalent>
          {chain.map((link) => `${link.label.replace(/^\d+ · /, '')}: ${link.value}`).join('. ')}.
        </TextEquivalent>
        {disclosed ? (
          <p className="mt-2 text-xs leading-5" data-chain-claim>
            These five readings are links, not five independent gauges. A fall at link three is a
            question about links one and two before it is a question about the setting, and link
            four is where the unloading claim is checked rather than assumed.
          </p>
        ) : null}
        <ModelBoundary>
          Left ventricular end-diastolic volume in this simulation is an educational surrogate
          derived from loading, contractility, valve recirculation and unloading, not a volume
          traced from an image. Read it as a direction, not as a measurement.
        </ModelBoundary>
      </PanelSection>

      <PanelSection title="The flow account on this pathway" id="placement-flow">
        <FlowAccount account={account} disclosed={disclosed} />
        <TextEquivalent>{flowAccountSentence(account, disclosed)}</TextEquivalent>
        <ModelBoundary>{MCS_ESTIMATED_FLOW_BOUNDARY}</ModelBoundary>
        <AlarmBand alarms={alarms} />
        <TextEquivalent>{alarmSentence(alarms)}.</TextEquivalent>
      </PanelSection>

      {mcsComparesAgainstActionBaseline(reveal) ? (
        <PanelSection title="Before the placement change, and now" id="placement-before-after">
          <BeforeAfter
            rows={rows}
            baselineLabel="On entering the task"
            caption="Displayed pump flow, effective delivery, and the two chamber readings that check the unloading claim."
          />
          <TextEquivalent>{beforeAfterSentence(rows)}.</TextEquivalent>
          <ModelBoundary>{DEADBAND_CAPTION}</ModelBoundary>
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="placement-transfer">
          <TransferState principle="A displayed pump flow that falls at an unchanged setting is a statement about the pathway — position, filling, or the pressure at the outlet. Which of the three it is has to be worked out before the setting is touched.">
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
              <LiveSetting
                label="Placement state"
                value={pump?.leftPositionWords ?? 'not applicable'}
                kind="modeled"
              />
              <LiveValue
                label="Pressure the pump works across"
                value={gradient}
                unit="mm Hg"
                digits={0}
                kind="modeled"
              />
              <LiveValue
                label="Systemic vascular resistance"
                value={state.patient.systemicVascularResistanceDynSecCm5}
                unit="dyn·s·cm⁻⁵"
                digits={0}
                kind="modeled"
              />
              <LiveValue
                label="Mean arterial pressure"
                value={metrics.mapMmHg}
                unit="mm Hg"
                digits={0}
                kind="modeled"
              />
            </div>
            <FlowAccount account={account} disclosed={disclosed} />
            <TextEquivalent>
              In the transfer patient the placement state is{' '}
              {pump?.leftPositionWords ?? 'not applicable'}, the pump works across{' '}
              {reading(gradient, 0)} mm Hg, systemic vascular resistance is{' '}
              {reading(state.patient.systemicVascularResistanceDynSecCm5, 0)} dyn·s·cm⁻⁵ and mean
              arterial pressure is {reading(metrics.mapMmHg, 0)} mm Hg.{' '}
              {flowAccountSentence(account, disclosed)}
            </TextEquivalent>
          </TransferState>
        </PanelSection>
      ) : null}

      {disclosed ? (
        <PanelSection title="What a published flow figure is a figure of" id="placement-evidence">
          <AfterCommitment summary="Several published flow numbers for the same pump — what each one measures">
            <MeasurementClarification clarification={clarification} headingLevel={5} />
            <p className="mt-3 text-xs leading-5" data-clarification-note>
              These figures do not contradict each other. They are different quantities: a maximum
              mean flow, a peak flow at systole, and an average observed during support. None of
              them substitutes for another, and none of them is averaged with another anywhere in
              this module.
            </p>
          </AfterCommitment>

          <AfterCommitment summary="One textbook, two different maximum-flow statements — held rather than resolved">
            <HeldDisagreement conflict={conflict} headingLevel={5} />
            <p className="mt-3 text-xs leading-5" data-conflict-note>
              This is an inconsistency inside a single textbook, not a disagreement between that
              textbook and the manufacturer, and neither of its two figures is used as the current
              device specification. Both are kept as they were published.
            </p>
          </AfterCommitment>

          <ModelBoundary>{MCS_PRODUCT_FLOW_BOUNDARY}</ModelBoundary>
        </PanelSection>
      ) : null}
    </div>
  )
}

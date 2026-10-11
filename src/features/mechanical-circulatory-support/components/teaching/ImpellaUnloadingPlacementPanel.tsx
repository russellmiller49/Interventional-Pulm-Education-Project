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
  FlowAccount,
  LiveSetting,
  LiveValue,
  ModelBoundary,
  PanelSection,
  ReferenceValues,
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
      kind: 'placement state',
      detail:
        'Where the inlet and outlet sit relative to the aortic valve: inlet in the ventricle, outlet in the aorta.',
    },
    {
      id: 'gradient',
      label: '2 · What the pump works across',
      value:
        gradient === null
          ? 'not available'
          : `${reading(gradient, 0)} mm Hg between the aorta and the left-sided filling pressure`,
      kind: 'modeled',
      detail:
        'The pressure difference the pump moves blood across. The higher it is, the less flow at the same P-level.',
    },
    {
      id: 'estimated-flow',
      label: '3 · What the pump estimates it is moving',
      value: `${reading(metrics.leftDeviceFlowLMin, 1)} L/min`,
      kind: 'estimated',
      detail: `At P-${pump ? pump.leftLevel : '—'}. The P-level is the setting; the flow is the controller’s estimate of what it delivers.`,
    },
    {
      id: 'unloading',
      label: '4 · Whether the chamber is actually smaller',
      value: `${reading(metrics.lvedvMl, 0)} mL end-diastolic volume · wedge ${reading(metrics.pcwpMmHg, 0)} mm Hg · aortic valve ${metrics.aorticValveOpening ? 'opening' : 'not opening'}`,
      kind: 'modeled',
      detail:
        'Unloading is the removal of volume. A pump that is unloading leaves a smaller ventricle and a lower wedge pressure.',
    },
    {
      id: 'effective',
      label: '5 · What reaches the circulation',
      value: `${reading(metrics.effectiveSystemicFlowLMin, 1)} L/min`,
      kind: 'reasoned',
      detail:
        'Native output plus pump flow, minus anything that leaks back through the aortic valve.',
    },
  ]

  return (
    <div className={styles.panel} data-teaching-panel={contract.sectionId}>
      <PanelSection title="The pathway, and the position it depends on" id="placement-pathway">
        <PathwayGraphic pathway={mcsComparisonPathways.impellaLeft} />
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
          <LiveSetting
            label="Placement state"
            value={pump?.leftPositionWords ?? 'not applicable'}
            kind="modeled"
            note="Aligned, too deep or too shallow."
          />
          <LiveValue
            label="Performance level"
            value={pump ? pump.leftLevel : null}
            digits={0}
            kind="displayed"
            note="The P-level sets motor speed. Flow at that level depends on filling, position and afterload."
          />
        </div>
        <TextEquivalent>
          {pathwaySentence(mcsComparisonPathways.impellaLeft)} The placement state is{' '}
          {pump?.leftPositionWords ?? 'not applicable'}, at performance level{' '}
          {pump ? pump.leftLevel : '—'}.
        </TextEquivalent>
        <p className="mt-3 text-xs leading-5" data-placement-teaching>
          At the bedside, position is confirmed with echo and the placement signal on the
          controller. Check position before you change the P-level.
        </p>
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
            These five readings are links in a chain. When flow falls at link three, check position
            and filling at links one and two before you touch the P-level. Link four tells you
            whether the ventricle is unloading.
          </p>
        ) : null}
        <ModelBoundary>
          Left ventricular end-diastolic volume here is a simulator surrogate, not a volume traced
          on echo. Read its direction, not its value.
        </ModelBoundary>
      </PanelSection>

      <PanelSection title="The flow account on this pathway" id="placement-flow">
        <FlowAccount account={account} disclosed={disclosed} />
        <TextEquivalent>{flowAccountSentence(account, disclosed)}</TextEquivalent>
        <ReferenceValues
          title="Impella: mean flow to expect at each P-level"
          ids={['impella-cp-flow-by-level', 'impella-cp-peak-flow', 'impella-55-flow-by-level']}
        >
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            The displayed flow is calculated by the controller; no probe measures it. A flow below
            the range for the P-level in use means suction, malposition or a high afterload.
          </p>
        </ReferenceValues>
        <AlarmBand alarms={alarms} disclosed={disclosed} />
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
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="placement-transfer">
          <TransferState principle="When displayed pump flow falls at an unchanged P-level, the cause is position, filling or the pressure at the outlet. Work out which before you touch the P-level.">
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
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
        <PanelSection title="Which flow figure is which" id="placement-evidence">
          <AfterCommitment summary="Three flow numbers for the Impella CP, and what each one measures">
            <MeasurementClarification clarification={clarification} headingLevel={5} />
            <p className="mt-3 text-xs leading-5" data-clarification-note>
              Three different quantities: a maximum mean flow, a peak flow in systole, and an
              average observed during support. Compare a displayed flow with the mean, never with
              the peak.
            </p>
          </AfterCommitment>

          <AfterCommitment summary="One textbook gives two different maximum flows">
            <HeldDisagreement conflict={conflict} headingLevel={5} />
            <p className="mt-3 text-xs leading-5" data-conflict-note>
              The textbook contradicts itself. Use the instructions for use for the device
              specification.
            </p>
          </AfterCommitment>

          <p className="mt-3 text-xs leading-5">{MCS_PRODUCT_FLOW_BOUNDARY}</p>
        </PanelSection>
      ) : null}
    </div>
  )
}

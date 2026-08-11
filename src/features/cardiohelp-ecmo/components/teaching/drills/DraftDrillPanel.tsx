import { evidenceById } from '../../../content/evidence'
import { cardiohelpScenarioById } from '../../../content/scenarios'
import type { EcmoSimulationState, FaultId, SupportMode } from '../../../engine/types'
import { TextEquivalent, VaConfigurationLabel, styles } from '../shared'
import {
  AfterCommitment,
  CompetingExplanations,
  Discriminators,
  DrillPanelFrame,
  FittingResponse,
  HarmfulReflex,
  Mechanism,
  PatternReading,
  SignalRegister,
  ThreeDomainResponse,
  type DrillCompetingExplanation,
  type DrillDiscriminator,
  type DrillPatternRow,
  type DrillSignalRow,
} from './drillPanelPrimitives'

type LiveText = string | ((state: EcmoSimulationState) => string)

export interface DraftPanelSourceSupport {
  readonly evidenceId: string
  /** The limited claim this panel takes from the registered source. */
  readonly claim: string
}

export interface DraftDrillPanelConfig {
  readonly scenarioId: string
  readonly supportMode: SupportMode
  /** Must remain a real question and must not name the diagnosis or best response. */
  readonly clinicalQuestion: LiveText
  readonly signalRows: (state: EcmoSimulationState) => readonly DrillSignalRow[]
  readonly signalSummary: LiveText
  readonly patternRows: (state: EcmoSimulationState) => readonly DrillPatternRow[]
  readonly patternSummary: LiveText
  readonly discriminators: readonly DrillDiscriminator[]
  readonly mechanism: LiveText
  readonly competingExplanations: readonly DrillCompetingExplanation[]
  readonly fittingResponse: LiveText
  readonly responseByDomain: {
    readonly device: LiveText
    readonly circuitOrGas: LiveText
    readonly patient: LiveText
    readonly circuitOrGasLabel?: 'Circuit' | 'Gas path'
  }
  readonly harmfulReflex: {
    readonly action: string
    readonly explanation: LiveText
  }
  readonly boundaries: readonly LiveText[]
  readonly textEquivalent: LiveText
  readonly sourceSupport: readonly DraftPanelSourceSupport[]
}

function liveText(value: LiveText, state: EcmoSimulationState): string {
  return typeof value === 'function' ? value(state) : value
}

/** Format a finite modeled value without allowing `NaN` or `Infinity` into learner copy. */
export function liveNumber(
  value: number,
  unit: string,
  precision = 0,
  unavailable = 'Not available in this state',
): string {
  return Number.isFinite(value) ? `${value.toFixed(precision)} ${unit}` : unavailable
}

export function livePercent(value: number, precision = 0): string {
  return liveNumber(value, '%', precision)
}

export function faultState(
  state: EcmoSimulationState,
  fault: FaultId,
): 'active' | 'corrected' | 'not active' {
  // The arterial-bubble workflow intentionally preserves the active-fault entry while the source
  // is corrected but the console latch remains set. Only that workflow lets the corrected record
  // take precedence. Any other fault present in both arrays has been reactivated and is active.
  if (
    fault === 'arterial-bubble' &&
    state.scenario.correctedFaults.includes(fault) &&
    !state.circuit.arterialBubbleDetected
  ) {
    return 'corrected'
  }
  if (state.scenario.activeFaults.includes(fault)) return 'active'
  if (state.scenario.correctedFaults.includes(fault)) return 'corrected'
  return 'not active'
}

function DraftStatusNotice() {
  return (
    <aside
      className="rounded-2xl border border-dashed px-4 py-3 text-sm"
      data-draft-panel-notice
      role="note"
    >
      <p className="font-semibold">Synthetic-review draft · non-credit</p>
      <p className="mt-1 text-muted-foreground">
        This teaching panel is outside the frozen six-panel human-test build. It does not award
        credit, record progress, or change Practice, Assess, or publication status.
      </p>
    </aside>
  )
}

function SourceSupport({ items }: { readonly items: readonly DraftPanelSourceSupport[] }) {
  return (
    <section className={styles.section} aria-labelledby="draft-panel-sources-heading">
      <h3 id="draft-panel-sources-heading" className={styles.heading}>
        Source support and limits
      </h3>
      <ul className="mt-3 grid gap-2" data-panel-source-support>
        {items.map((item) => {
          const evidence = evidenceById.get(item.evidenceId)
          if (!evidence) {
            return (
              <li key={item.evidenceId} data-evidence-id={item.evidenceId}>
                Registered source unavailable. This panel must not be promoted.
              </li>
            )
          }
          return (
            <li
              key={item.evidenceId}
              className="rounded-xl border px-3 py-2"
              data-evidence-id={item.evidenceId}
            >
              <p className="font-semibold">{evidence.title}</p>
              <p className="mt-1">{item.claim}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Limit: {evidence.limitations}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function CorrectedStateNotice() {
  return (
    <aside className="rounded-2xl border px-4 py-3 text-sm" data-corrected-state-note role="note">
      <p className="font-semibold">Current live status: authored cause marked corrected</p>
      <p className="mt-1 text-muted-foreground">
        The signal tables show the current state. The mechanism below describes the earlier
        active-fault pattern, while the fitting response describes the full intended workflow. Use
        the current state and event history to determine which steps are complete and which remain;
        do not assume that correcting the cause completed every response step.
      </p>
    </aside>
  )
}

const correctedClinicalQuestion =
  'The authored cause has been marked corrected. Which current device, circuit or gas-path, and patient findings show what has changed, and which response or reassessment steps still remain?'

const preEventClinicalQuestion =
  'The authored cause is not active in the current state. Which baseline device, circuit or gas-path, and patient findings should be established before the scenario changes?'

/**
 * One deliberately constrained renderer for the fourteen B6 draft panels.
 *
 * The renderer is shared; the clinical question, live signals, discriminators, mechanism,
 * competing explanation, response, harmful reflex, boundaries, sources, and text equivalent are
 * all authored independently in the VV and VA configuration files. That keeps structure
 * consistent without copying one lesson fourteen times.
 */
export function DraftDrillPanel({
  config,
  state,
}: {
  readonly config: DraftDrillPanelConfig
  readonly state: EcmoSimulationState
}) {
  const signalRows = config.signalRows(state)
  const boundaries = config.boundaries.map((boundary) => liveText(boundary, state))
  const scenario = cardiohelpScenarioById.get(config.scenarioId)
  if (!scenario) throw new Error(`No authored scenario for draft panel ${config.scenarioId}`)
  const causeStatus = faultState(state, scenario.expectation.correctiveFault)
  const isCorrected = causeStatus === 'corrected'
  const committed = state.scenario.prediction.committed

  return (
    <DrillPanelFrame
      scenarioId={config.scenarioId}
      supportMode={config.supportMode}
      clinicalQuestion={
        isCorrected
          ? correctedClinicalQuestion
          : causeStatus === 'not active'
            ? preEventClinicalQuestion
            : liveText(config.clinicalQuestion, state)
      }
      boundaries={committed ? boundaries : []}
      reviewStatus="draft"
      creditEligible={false}
    >
      <DraftStatusNotice />
      {config.supportMode === 'va' ? <VaConfigurationLabel /> : null}
      <SignalRegister
        rows={signalRows}
        summary={liveText(config.signalSummary, state)}
        taxonomy="b6-draft"
      />
      <PatternReading
        rows={config.patternRows(state)}
        summary={liveText(config.patternSummary, state)}
      />
      <Discriminators items={config.discriminators} />
      <AfterCommitment state={state}>
        {isCorrected ? <CorrectedStateNotice /> : null}
        <Mechanism>{liveText(config.mechanism, state)}</Mechanism>
        <CompetingExplanations items={config.competingExplanations} />
        <FittingResponse>{liveText(config.fittingResponse, state)}</FittingResponse>
        <ThreeDomainResponse
          device={liveText(config.responseByDomain.device, state)}
          circuitOrGas={liveText(config.responseByDomain.circuitOrGas, state)}
          patient={liveText(config.responseByDomain.patient, state)}
          circuitOrGasLabel={config.responseByDomain.circuitOrGasLabel}
        />
        <HarmfulReflex action={config.harmfulReflex.action}>
          {liveText(config.harmfulReflex.explanation, state)}
        </HarmfulReflex>
        <SourceSupport items={config.sourceSupport} />
        <TextEquivalent>
          {isCorrected
            ? `Current live status: the authored cause is marked corrected. The signal register earlier in this panel is current. The mechanism describes the earlier active-fault state, while the fitting response describes the full intended workflow; the current state and event history determine which steps remain. ${liveText(config.textEquivalent, state)}`
            : liveText(config.textEquivalent, state)}
        </TextEquivalent>
      </AfterCommitment>
    </DrillPanelFrame>
  )
}

/** Component factory keeps registry entries referentially stable and typed. */
export function draftPanelFor(config: DraftDrillPanelConfig) {
  return function AuthoredDraftDrillPanel({ state }: { readonly state: EcmoSimulationState }) {
    return <DraftDrillPanel config={config} state={state} />
  }
}

/** Exported only to make exhaustive configuration review possible without rendering. */
export type { LiveText }

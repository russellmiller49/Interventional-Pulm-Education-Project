'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  crrtCircuitOverlay,
  crrtPressureSignalDetail,
  crrtPressureSignalDetails,
  type CrrtCircuitNodeId,
  type CrrtCircuitOverlayId,
  type CrrtCircuitPathId,
} from '../content/circuitModel'
import {
  calculateCrrtPredictedConsequences,
  crrtConstructionFlowRates,
} from '../stagedPrescriptionModel'
import { CRRT_FOUNDATION_CONSTRUCTION, projectFoundationFluidBalance } from '../foundationModel'
import { calculateCrrtMachineFluidLedger } from '../circuitFluidLedger'
import { createSyntheticPressureLocalizationResult } from '../pressureLocalizationLabModel'
import type { CrrtFoundationTool } from '../content/foundationLessons'
import { CrrtLessonVisual, useCrrtLessonVisualPlacement } from './CrrtLessonVisual'
import { CrrtPilotCircuit, type CrrtPilotPressureSignals } from './CrrtPilotCircuit'
import { CrrtLivePressureStation } from './CrrtLivePressureStation'
import { CrrtMembraneTransport, type CrrtTransportMechanism } from './CrrtMembraneTransport'
import { CrrtPressureArithmetic } from './CrrtPressureArithmetic'
import styles from './crrt-foundations.module.css'

const noPressures: CrrtPilotPressureSignals = {
  access: null,
  filter: null,
  return: null,
  effluent: null,
  TMP: null,
  filterDrop: null,
}
const bloodPathIds = crrtCircuitOverlay('blood-path').activePathIds
const bloodStops: readonly { id: CrrtCircuitNodeId; label: string; text: string }[] = [
  {
    id: 'access-lumen',
    label: 'Patient access',
    text: 'Blood leaves the patient through the access lumen. This starts the extracorporeal blood path.',
  },
  {
    id: 'access-pressure',
    label: 'Pre-pump segment',
    text: 'The access segment lies before the blood pump. Access pressure is measured here; resistance on this side can make it more negative at the same flow.',
  },
  {
    id: 'blood-pump',
    label: 'Blood pump',
    text: 'The blood pump draws from the access side and drives blood onward. Blood flow is expressed in mL/min; fluid pump rates use mL/h.',
  },
  {
    id: 'filter',
    label: 'Filter',
    text: 'Blood and the fluid compartment are separated by a membrane. Water and eligible solutes can cross it; the two bulk flows do not merge.',
  },
  {
    id: 'return-pressure',
    label: 'Return segment',
    text: 'Blood travels through the return segment after the filter. Return pressure is a measurement site, not the filter pressure drop.',
  },
  {
    id: 'return-lumen',
    label: 'Patient return',
    text: 'Blood returns through the return lumen. Trace the entire path again before adding other fluid lines.',
  },
]
const fluidStops: readonly { id: CrrtCircuitPathId; label: string; text: string }[] = [
  {
    id: 'dialysate-supply',
    label: 'Dialysate',
    text: 'Bulk dialysate flow stays on the fluid side. Solutes exchange with blood across the membrane; dialysate is not a direct patient infusion.',
  },
  {
    id: 'pre-filter-replacement',
    label: 'Pre-filter replacement',
    text: 'Replacement enters blood before the membrane. It changes the concentration presented to the filter.',
  },
  {
    id: 'post-filter-replacement',
    label: 'Post-filter replacement',
    text: 'Replacement enters blood after the filter. It replaces some of the water removed across the membrane.',
  },
  {
    id: 'pbp-citrate-infusion',
    label: 'PBP',
    text: 'Pre-blood-pump fluid enters blood before the blood pump. A location is not a solution identity or a citrate dosing instruction.',
  },
  {
    id: 'effluent-line',
    label: 'Effluent',
    text: 'The effluent path carries spent dialysate and ultrafiltered water to collection. Its total flow is distinct from net removal attributable to CRRT.',
  },
]
const modalityIds = ['scuf', 'cvvh', 'cvvhd', 'cvvhdf'] as const
/** What each acronym stands for, printed on its own button so it is read before it is pressed. */
const modalityNames: Record<(typeof modalityIds)[number], string> = {
  scuf: 'Slow continuous ultrafiltration',
  cvvh: 'Continuous venovenous hemofiltration',
  cvvhd: 'Continuous venovenous hemodialysis',
  cvvhdf: 'Continuous venovenous hemodiafiltration',
}
/** What the selected modality does, shown under the buttons beside the circuit. */
const modalityText: Record<(typeof modalityIds)[number], string> = {
  scuf: 'SCUF removes water only. No dialysate and no replacement fluid run, so little solute is cleared.',
  cvvh: 'CVVH filters water out of the blood, and solute is carried across with it (convection). Replacement fluid enters the blood path to put most of that volume back.',
  cvvhd:
    'CVVHD runs dialysate on the other side of the membrane. Solute crosses down its concentration gradient (diffusion), and the dialysate leaves as effluent without entering the blood.',
  cvvhdf: 'CVVHDF runs both: dialysate for diffusion and replacement fluid for convection.',
}

function Circuit({
  overlay = 'blood-path',
  node,
  paths,
  pressure = noPressures,
}: {
  overlay?: CrrtCircuitOverlayId
  node?: CrrtCircuitNodeId
  paths?: readonly CrrtCircuitPathId[]
  pressure?: CrrtPilotPressureSignals
}) {
  return (
    <CrrtPilotCircuit
      presentation="focused"
      overlayId={overlay}
      highlightedNodeId={node}
      visiblePathIds={paths}
      running={false}
      setReady
      fluidsReady
      bloodFlowMlMin={null}
      dialysateFlowMlHour={null}
      patientFluidRemovalMlHour={null}
      pressure={pressure}
    />
  )
}

/** The circuit as lesson 1 introduces it: the blood path, no modality and no readings. */
export function CrrtReferenceCircuit() {
  return <Circuit />
}

/**
 * Local layout only: the existing circuit and selection state remain authoritative.
 *
 * In a two-pane lesson the drawing goes to the right pane and the selections stay in the text,
 * under the instruction; anywhere else the drawing follows its selections as it always has.
 */
function CircuitWorkbench({ controls, children }: { controls: ReactNode; children: ReactNode }) {
  const placement = useCrrtLessonVisualPlacement()
  return (
    <div
      className={styles.circuitWorkbench}
      data-crrt-circuit-workbench
      data-crrt-drawing={placement}
    >
      <div className={styles.circuitControls}>{controls}</div>
      <CrrtLessonVisual>
        <div className={styles.circuitVisual}>{children}</div>
      </CrrtLessonVisual>
    </div>
  )
}

/**
 * How far a learner has got through one guided tool's own selections — a count of real local
 * operations ("2 of 6 stops selected"), used to say what is left before "Review observations and
 * continue" is available. It is not stored, graded or required; skipping stays open.
 */
export interface CrrtToolProgress {
  readonly completed: number
  readonly total: number
  readonly noun: string
  readonly remaining: readonly string[]
  readonly ordered: boolean
  /** The pressure-site tool also asks for the changed-resistance comparison. */
  readonly comparisonPending: boolean
}

const toolNoun: Partial<Record<CrrtFoundationTool, string>> = {
  'blood-walk': 'stops',
  'fluid-walk': 'fluid paths',
  modalities: 'modalities',
  'pressure-sites': 'pressure readouts',
  mechanisms: 'mechanisms',
  'transport-comparison': 'changes',
}

/** Labels per tool: the same id can name different things in two tools (a blood stop "filter"
    and the "Filter pressure" readout), so labels are never looked up across tools. */
const toolItemLabels: Partial<Record<CrrtFoundationTool, Readonly<Record<string, string>>>> = {
  'blood-walk': Object.fromEntries(bloodStops.map((stop) => [stop.id, stop.label])),
  'fluid-walk': Object.fromEntries(fluidStops.map((stop) => [stop.id, stop.label])),
  modalities: Object.fromEntries(modalityIds.map((id) => [id, id.toUpperCase()])),
  'pressure-sites': Object.fromEntries(
    crrtPressureSignalDetails.map((detail) => [detail.id, detail.label]),
  ),
  mechanisms: {
    diffusion: 'Diffusion',
    convection: 'Convection',
    ultrafiltration: 'Ultrafiltration',
  },
  'transport-comparison': {
    dialysate: 'Dialysate +500 mL/h',
    replacement: 'Post-filter replacement +500 mL/h',
    removal: 'Net CRRT removal +100 mL/h',
  },
}

/** A component-local selection is a guided observation; the parent must explicitly review it. */
export function CrrtFoundationToolView({
  tool,
  onReady,
  onProgress,
}: {
  tool: CrrtFoundationTool
  onReady?: (response: string) => void
  onProgress?: (progress: CrrtToolProgress) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [visited, setVisited] = useState<readonly string[]>([])
  const [changed, setChanged] = useState(false)
  const [showRecordedComparison, setShowRecordedComparison] = useState(false)
  const ids =
    tool === 'blood-walk'
      ? bloodStops.map((s) => s.id)
      : tool === 'fluid-walk'
        ? fluidStops.map((s) => s.id)
        : tool === 'modalities'
          ? modalityIds
          : tool === 'pressure-sites'
            ? crrtPressureSignalDetails.map((s) => s.id)
            : tool === 'mechanisms'
              ? ['diffusion', 'convection', 'ultrafiltration']
              : tool === 'transport-comparison'
                ? ['dialysate', 'replacement', 'removal']
                : []
  const ready =
    ids.length > 0 &&
    ids.every((id) => visited.includes(id)) &&
    (tool !== 'pressure-sites' || changed)
  const response = visited.join(',')
  useEffect(() => {
    if (ready) onReady?.(response)
  }, [ready, response, onReady])
  const noun = toolNoun[tool]
  useEffect(() => {
    if (!noun || ids.length === 0) return
    onProgress?.({
      completed: ids.filter((id) => visited.includes(id)).length,
      total: ids.length,
      noun,
      remaining: ids
        .filter((id) => !visited.includes(id))
        .map((id) => toolItemLabels[tool]?.[id] ?? id),
      ordered: tool === 'blood-walk',
      comparisonPending: tool === 'pressure-sites' && !changed,
    })
    // `ids` is derived from `tool`; the progress changes only with the selections themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, noun, response, changed, onProgress])
  function select(id: string) {
    setSelected(id)
    setVisited((current) => (current.includes(id) ? current : [...current, id]))
  }
  const selectedCount = ids.filter((id) => visited.includes(id)).length
  const controls = (
    items: readonly { id: string; label: string; detail?: string }[],
    ordered = false,
  ) => (
    // The count sits in the same row as the buttons, so it adds no height between the controls
    // and the circuit they drive (the pair must stay on one screen).
    <div className={styles.controlRow}>
      <div className={styles.controls} role="group" aria-label="Teaching selections">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            disabled={ordered && index > visited.length}
            aria-pressed={selected === item.id}
            onClick={() => select(item.id)}
          >
            {item.detail ? (
              <>
                <span className={styles.controlName}>
                  {item.label}
                  {visited.includes(item.id) ? ' ✓' : ''}
                </span>{' '}
                <small className={styles.controlDetail}>{item.detail}</small>
              </>
            ) : (
              <>
                {item.label}
                {visited.includes(item.id) ? ' ✓' : ''}
              </>
            )}
          </button>
        ))}
      </div>
      {noun ? (
        // A count of this visit's own selections, beside the buttons that make them. Not stored.
        <p className={styles.toolStatus} aria-live="polite" data-crrt-tool-status>
          {selectedCount} of {ids.length} {noun} selected
          {ordered && selectedCount < ids.length ? ' · select them in order' : ''}
        </p>
      ) : null}
    </div>
  )

  if (tool === 'overview')
    return (
      <>
        <p className={styles.caption}>
          Follow the blood: access lumen → blood pump → filter → return lumen.
        </p>
        <CrrtLessonVisual>
          <Circuit />
        </CrrtLessonVisual>
      </>
    )
  if (tool === 'blood-walk' || tool === 'fluid-walk') {
    const blood = bloodStops.find((s) => s.id === selected)
    const fluid = fluidStops.find((s) => s.id === selected)
    // The explanation of the selection sits under the buttons, beside the circuit, so it appears
    // where the learner is looking rather than below the drawing (tester report, 2026-11-05).
    return (
      <CircuitWorkbench
        controls={
          <>
            {controls(tool === 'blood-walk' ? bloodStops : fluidStops, tool === 'blood-walk')}
            <p className={styles.observation} aria-live="polite" data-crrt-selection-explanation>
              {tool === 'blood-walk'
                ? (blood?.text ?? 'Select Patient access to begin.')
                : (fluid?.text ?? 'Select a fluid path to trace it.')}
            </p>
          </>
        }
      >
        <Circuit
          overlay={tool === 'fluid-walk' ? 'cvvhdf' : 'blood-path'}
          node={blood?.id}
          paths={
            tool === 'fluid-walk' ? [...bloodPathIds, ...(fluid ? [fluid.id] : [])] : undefined
          }
        />
      </CircuitWorkbench>
    )
  }
  if (tool === 'modalities') {
    const modality = modalityIds.find((id) => id === selected)
    const overlay = (
      modality === 'cvvh' ? 'cvvh-post' : (modality ?? 'blood-path')
    ) as CrrtCircuitOverlayId
    return (
      <CircuitWorkbench
        controls={
          <>
            {controls(
              modalityIds.map((id) => ({
                id,
                label: id.toUpperCase(),
                detail: modalityNames[id],
              })),
            )}
            <p className={styles.observation} aria-live="polite" data-crrt-selection-explanation>
              {modality
                ? modalityText[modality]
                : 'Select a modality to see what it does and which paths it uses.'}
            </p>
          </>
        }
      >
        <Circuit overlay={overlay} />
      </CircuitWorkbench>
    )
  }
  if (tool === 'pressure-sites') {
    const result = createSyntheticPressureLocalizationResult('obstruction', 'return-line')
    const detail = selected
      ? crrtPressureSignalDetail(selected as Parameters<typeof crrtPressureSignalDetail>[0])
      : null
    const snap = changed ? result.revealed : result.baseline
    return (
      <>
        <CircuitWorkbench
          controls={
            <>
              {controls(
                crrtPressureSignalDetails.map((detail) => ({ id: detail.id, label: detail.label })),
              )}
              <button type="button" onClick={() => setChanged((value) => !value)}>
                {changed ? 'Return to normal reference' : 'Compare return-side resistance'}
              </button>
            </>
          }
        >
          <CrrtPilotCircuit
            presentation="focused"
            overlayId="pressure-profile"
            highlightedSignalId={detail?.id}
            running={false}
            setReady
            fluidsReady
            bloodFlowMlMin={100}
            dialysateFlowMlHour={null}
            patientFluidRemovalMlHour={null}
            pressure={{
              access: snap.accessPressureMmHg,
              filter: snap.filterPressureMmHg,
              return: snap.returnPressureMmHg,
              effluent: snap.effluentPressureMmHg,
              TMP: snap.tmpMmHg,
              filterDrop: snap.filterPressureDropMmHg,
            }}
          />
        </CircuitWorkbench>
        <p className={styles.observation} aria-live="polite">
          {detail
            ? `${detail.label}: ${detail.physicalLocation} ${detail.whatProducesTheValue}`
            : 'Select a pressure readout to locate its site or contributing sites.'}
        </p>
        <p>
          Reference blood flow: 100 mL/min in both states.{' '}
          {changed ? 'Only modeled return resistance is increased.' : 'Unobstructed circuit.'}
        </p>
        <dl className={styles.metrics}>
          {result.signals.map((signal) => (
            <div key={signal.id}>
              <dt>
                {signal.label}
                {['tmp', 'filter-drop'].includes(signal.id) ? ' · calculated' : ' · site'}
              </dt>
              <dd>{changed ? signal.revealedMmHg : signal.baselineMmHg} mmHg</dd>
            </div>
          ))}
        </dl>
        {/* F-14: the two calculated readings above, worked from the same three site readings. */}
        <div className={styles.arithmeticPair}>
          {(['tmp', 'filter-drop'] as const).map((signal) => (
            <CrrtPressureArithmetic
              key={signal}
              signal={signal}
              raw={{
                filterMmHg: snap.filterPressureMmHg,
                returnMmHg: snap.returnPressureMmHg,
                effluentMmHg: snap.effluentPressureMmHg,
              }}
              displayedMmHg={signal === 'tmp' ? snap.tmpMmHg : snap.filterPressureDropMmHg}
            />
          ))}
        </div>
        <details onToggle={(event) => setShowRecordedComparison(event.currentTarget.open)}>
          <summary>Recorded comparison from the simulation</summary>
          {showRecordedComparison ? <CrrtLivePressureStation /> : null}
        </details>
      </>
    )
  }
  if (tool === 'unknown-access' || tool === 'unknown-return') {
    const result = createSyntheticPressureLocalizationResult(
      'obstruction',
      tool === 'unknown-access' ? 'access-line' : 'return-line',
    )
    return (
      <>
        <table className={styles.table}>
          <caption>Pressure comparison · same blood flow, 100 mL/min</caption>
          <thead>
            <tr>
              <th>Reading (mmHg)</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {result.signals.map((s) => (
              <tr key={s.id}>
                <th scope="row">{s.label}</th>
                <td>{s.baselineMmHg}</td>
                <td>{s.revealedMmHg}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <CrrtLessonVisual>
          <Circuit overlay="pressure-profile" />
        </CrrtLessonVisual>
        <p>
          No fault label or physical finding is supplied. Localize only as far as these readings
          support.
        </p>
      </>
    )
  }
  if (tool === 'mechanisms') {
    return (
      <div className={styles.mechanismWorkbench}>
        <CircuitWorkbench
          controls={controls([
            { id: 'diffusion', label: 'Diffusion' },
            { id: 'convection', label: 'Convection' },
            { id: 'ultrafiltration', label: 'Ultrafiltration' },
          ])}
        >
          <Circuit
            overlay={
              selected === 'diffusion' ? 'cvvhd' : selected === 'convection' ? 'cvvh-post' : 'scuf'
            }
            node="filter"
          />
        </CircuitWorkbench>
        <CrrtLessonVisual slot="support">
          <CrrtMembraneTransport
            selected={(selected as CrrtTransportMechanism | null) ?? 'diffusion'}
          />
        </CrrtLessonVisual>
      </div>
    )
  }
  if (tool === 'transport-comparison') {
    const baseline = {
      ...crrtConstructionFlowRates(CRRT_FOUNDATION_CONSTRUCTION),
      dialysateFlowMlHour: 1000,
      postReplacementFlowMlHour: 1000,
    }
    const flows = {
      ...baseline,
      ...(selected === 'dialysate'
        ? { dialysateFlowMlHour: 1500 }
        : selected === 'replacement'
          ? { postReplacementFlowMlHour: 1500 }
          : selected === 'removal'
            ? { patientFluidRemovalMlHour: 200 }
            : {}),
    }
    const before = calculateCrrtMachineFluidLedger(baseline)
    const after = calculateCrrtMachineFluidLedger(flows)
    const observation =
      selected === 'dialysate'
        ? 'Dialysate-supported diffusion changes. Total effluent increases; membrane water flow and net CRRT removal remain fixed.'
        : selected === 'replacement'
          ? 'Replacement-supported filtration increases, supporting convective transport. Membrane water flow and effluent rise; net CRRT removal stays fixed.'
          : selected === 'removal'
            ? 'Net CRRT removal increases. Membrane water flow and effluent also rise; no patient laboratory or tolerance response is modeled.'
            : 'Select one change. Each comparison starts from the same baseline.'
    return (
      <>
        {controls([
          { id: 'dialysate', label: 'Dialysate +500 mL/h' },
          { id: 'replacement', label: 'Post-filter replacement +500 mL/h' },
          { id: 'removal', label: 'Net CRRT removal +100 mL/h' },
        ])}
        <p className={styles.observation} aria-live="polite">
          {observation}
        </p>
        <table className={styles.table}>
          <caption>Canonical fluid ledger · mL/h while running</caption>
          <thead>
            <tr>
              <th>Quantity</th>
              <th>Baseline</th>
              <th>Selected change</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['Total effluent', before.totalEffluentMlHour, after.totalEffluentMlHour],
                [
                  'Water crossing membrane',
                  before.crossingMembraneMlHour,
                  after.crossingMembraneMlHour,
                ],
                [
                  'Net CRRT removal',
                  before.machinePatientFluidRemovalMlHour,
                  after.machinePatientFluidRemovalMlHour,
                ],
              ] as const
            ).map(([name, a, b]) => (
              <tr key={name}>
                <th>{name}</th>
                <td>{a ?? 'Unavailable'}</td>
                <td>{b ?? 'Unavailable'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <CrrtLessonVisual>
          <Circuit
            overlay="cvvhdf"
            paths={crrtCircuitOverlay('cvvhdf').activePathIds.filter(
              (id) => id !== 'pre-filter-replacement',
            )}
          />
        </CrrtLessonVisual>
      </>
    )
  }
  if (tool === 'worked-dose' || tool === 'fluid-balance') {
    const construction =
      tool === 'worked-dose'
        ? CRRT_FOUNDATION_CONSTRUCTION
        : { ...CRRT_FOUNDATION_CONSTRUCTION, patientFluidRemovalMlPerHour: 0 }
    const result = calculateCrrtPredictedConsequences(construction)
    const patient = projectFoundationFluidBalance(construction)
    return (
      <>
        <dl className={styles.metrics}>
          <div>
            <dt>Example weight</dt>
            <dd>80 kg</dd>
          </div>
          <div>
            <dt>Assumed running time</dt>
            <dd>21 of 24 h</dd>
          </div>
          <div>
            <dt>Total effluent</dt>
            <dd>{result.ledger.totalEffluentMlHour} mL/h</dd>
          </div>
          <div>
            <dt>Projected time-averaged dose</dt>
            <dd>{result.intensity.deliveredDoseMlPerKgHour.toFixed(3)} mL/kg/h</dd>
          </div>
          <div>
            <dt>Projected net CRRT removal</dt>
            <dd>{patient?.totals.machinePatientFluidRemovalMl ?? 'Unavailable'} mL / 24 h</dd>
          </div>
          <div>
            <dt>Projected patient balance</dt>
            <dd>{patient?.netBalanceMl ?? 'Unavailable'} mL / 24 h</dd>
          </div>
        </dl>
        <p>
          External intake 150 mL/h; urine/other output 50 mL/h throughout all 24 hours. CRRT
          contributes only during the assumed 21 running hours. All results are projected from
          entered assumptions.
        </p>
        <CrrtLessonVisual>
          <Circuit overlay="cvvhd" />
        </CrrtLessonVisual>
      </>
    )
  }
  return null
}

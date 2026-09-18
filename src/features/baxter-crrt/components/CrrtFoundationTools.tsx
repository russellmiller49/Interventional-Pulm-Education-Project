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
import { CrrtPilotCircuit, type CrrtPilotPressureSignals } from './CrrtPilotCircuit'
import { CrrtLivePressureStation } from './CrrtLivePressureStation'
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
const modalityText: Record<string, string> = {
  scuf: 'SCUF — slow continuous ultrafiltration: water removal without dialysate or replacement-supported filtration in this simplified view.',
  cvvh: 'CVVH — continuous venovenous hemofiltration: replacement-supported filtration carries solute with water by convection.',
  cvvhd:
    'CVVHD — continuous venovenous hemodialysis: dialysate supports diffusion across the membrane.',
  cvvhdf:
    'CVVHDF — continuous venovenous hemodiafiltration: dialysate and replacement-supported filtration combine diffusive and convective transport.',
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

/** Local layout only: the existing circuit and selection state remain authoritative. */
function CircuitWorkbench({ controls, children }: { controls: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.circuitWorkbench} data-crrt-circuit-workbench>
      <div className={styles.circuitControls}>{controls}</div>
      <div className={styles.circuitVisual}>{children}</div>
    </div>
  )
}

/** A component-local selection is a guided observation; the parent must explicitly review it. */
export function CrrtFoundationToolView({
  tool,
  onReady,
}: {
  tool: CrrtFoundationTool
  onReady?: (response: string) => void
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
  function select(id: string) {
    setSelected(id)
    setVisited((current) => (current.includes(id) ? current : [...current, id]))
  }
  const controls = (items: readonly { id: string; label: string }[], ordered = false) => (
    <div className={styles.controls} role="group" aria-label="Teaching selections">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          disabled={ordered && index > visited.length}
          aria-pressed={selected === item.id}
          onClick={() => select(item.id)}
        >
          {item.label}
          {visited.includes(item.id) ? ' ✓' : ''}
        </button>
      ))}
    </div>
  )

  if (tool === 'overview')
    return (
      <>
        <p className={styles.caption}>
          Normal circuit orientation · follow access → blood pump → filter → return. No patient run
          is active.
        </p>
        <Circuit />
      </>
    )
  if (tool === 'blood-walk' || tool === 'fluid-walk') {
    const blood = bloodStops.find((s) => s.id === selected)
    const fluid = fluidStops.find((s) => s.id === selected)
    return (
      <>
        <CircuitWorkbench
          controls={controls(
            tool === 'blood-walk' ? bloodStops : fluidStops,
            tool === 'blood-walk',
          )}
        >
          <Circuit
            overlay={tool === 'fluid-walk' ? 'cvvhdf' : 'blood-path'}
            node={blood?.id}
            paths={
              tool === 'fluid-walk' ? [...bloodPathIds, ...(fluid ? [fluid.id] : [])] : undefined
            }
          />
        </CircuitWorkbench>
        <p className={styles.observation} aria-live="polite">
          {tool === 'blood-walk'
            ? (blood?.text ?? 'Select Patient access to begin.')
            : (fluid?.text ?? 'Select a fluid path to trace it.')}
        </p>
      </>
    )
  }
  if (tool === 'modalities') {
    const overlay = (
      selected === 'cvvh' ? 'cvvh-post' : (selected ?? 'blood-path')
    ) as CrrtCircuitOverlayId
    return (
      <>
        <CircuitWorkbench
          controls={controls(modalityIds.map((id) => ({ id, label: id.toUpperCase() })))}
        >
          <Circuit overlay={overlay} />
        </CircuitWorkbench>
        <p className={styles.observation} aria-live="polite">
          {selected ? modalityText[selected] : 'Select a modality to reveal its active paths.'}
        </p>
        <p className={styles.caption}>
          Conceptual configuration only. No numeric flows or device settings are applied.
        </p>
      </>
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
          Reference blood flow: 100 mL/min in both synthetic states.{' '}
          {changed
            ? 'Only modeled return resistance is increased.'
            : 'Normal reference; not a clinical normal range.'}
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
        <details onToggle={(event) => setShowRecordedComparison(event.currentTarget.open)}>
          <summary>Engine-generated recorded comparison</summary>
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
          <caption>Synthetic pressure comparison · same blood flow, 100 mL/min</caption>
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
        <Circuit overlay="pressure-profile" />
        <p>
          No fault label or physical finding is supplied. Localize only as far as these readings
          support.
        </p>
      </>
    )
  }
  if (tool === 'mechanisms') {
    return (
      <>
        <CircuitWorkbench
          controls={
            <>
              {controls([
                { id: 'diffusion', label: 'Diffusion' },
                { id: 'convection', label: 'Convection' },
                { id: 'ultrafiltration', label: 'Ultrafiltration' },
              ])}
              <FilterInset mechanism={selected ?? 'diffusion'} />
            </>
          }
        >
          <Circuit
            overlay={
              selected === 'diffusion' ? 'cvvhd' : selected === 'convection' ? 'cvvh-post' : 'scuf'
            }
            node="filter"
          />
        </CircuitWorkbench>
      </>
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
        <Circuit
          overlay="cvvhdf"
          paths={crrtCircuitOverlay('cvvhdf').activePathIds.filter(
            (id) => id !== 'pre-filter-replacement',
          )}
        />
        <p>
          Conceptual transport direction and calculated fluid flows; no applied device prescription
          or quantitative patient solute response.
        </p>
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
        <Circuit overlay="cvvhd" />
      </>
    )
  }
  return null
}

function FilterInset({ mechanism }: { mechanism: string }) {
  const diffusion = mechanism === 'diffusion'
  const caption = diffusion
    ? 'Solute moves down its concentration gradient across the membrane. Bulk dialysate remains on the fluid side; solute exchange is not a direct dialysate infusion.'
    : mechanism === 'convection'
      ? 'Water carries eligible dissolved solute across the membrane. Replacement enters the blood path to replace part of this filtered water.'
      : 'Water moves from blood across the membrane. Net patient removal equals that water loss after blood-path infusions are accounted for.'
  return (
    <figure className={styles.inset}>
      <figcaption>
        <strong>Filter inset · {mechanism}</strong>
        <p>{caption}</p>
      </figcaption>
      <svg viewBox="0 0 640 190" role="img" aria-label={caption}>
        <rect x="10" y="15" width="280" height="150" rx="12" fill="#702e42" />
        <rect x="320" y="15" width="310" height="150" rx="12" fill="#224e50" />
        <path d="M305 10 V175" stroke="#eee" strokeWidth="5" strokeDasharray="8 5" />
        <text x="35" y="48" fill="white">
          Blood side
        </text>
        <text x="370" y="48" fill="white">
          Fluid side
        </text>
        <text x="260" y="187" fill="white">
          Membrane
        </text>
        <path
          d="M180 105 H435 l-18 -12 M435 105 l-18 12"
          stroke="#ffd979"
          strokeWidth="5"
          fill="none"
        />
        <text x="90" y="145" fill="white">
          {diffusion
            ? 'Solute gradient → diffusion'
            : mechanism === 'convection'
              ? 'Water + eligible solute → convection'
              : 'Water → ultrafiltration'}
        </text>
      </svg>
      <p className={styles.caption}>
        Conceptual inset of the highlighted filter, not a quantitative clearance or patient model.
      </p>
    </figure>
  )
}

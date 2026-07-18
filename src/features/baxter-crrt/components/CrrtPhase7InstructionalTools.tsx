'use client'

import { useId, useState, type ChangeEvent, type CSSProperties } from 'react'

import { baxterCrrtInstructionalToolManifest } from '../content/instructionalTools'
import {
  calculateSyntheticFluidLedger,
  calculateSyntheticTransport,
  fluidLedgerCandidateSourceIds,
  getQualitativeEffluentProfile,
  transportMechanismCandidateSourceIds,
  type QualitativeCrrtModality,
  type SyntheticFluidLedgerInputs,
  type SyntheticFlowArrangement,
  type SyntheticMoleculeClass,
  type SyntheticTransportInputs,
} from '../instructionalToolsModel'
import { CrrtPhase7PrescriptionWorkbench } from './CrrtPrescriptionWorkbench'
import { CrrtPressureLocalizationLab } from './CrrtPressureLocalizationLab'
import styles from './crrt-phase7-instructional-tools.module.css'

function requireCitrateDashboardManifest() {
  const manifest = baxterCrrtInstructionalToolManifest.find(
    ({ id }) => id === 'LAB-CITRATE-DASHBOARD',
  )
  if (!manifest) throw new Error('Missing LAB-CITRATE-DASHBOARD instructional-tool manifest.')
  return manifest
}
const citrateDashboardManifest = requireCitrateDashboardManifest()

const citrateDashboardDomains = Object.freeze([
  'Systemic ionized-calcium direction',
  'Total-calcium relationship direction',
  'Acid-base direction',
  'Circuit-delivery direction',
])

const initialTransportInputs: SyntheticTransportInputs = Object.freeze({
  concentrationDifferenceLevel: 60,
  diffusivePassageLevel: 70,
  waterMovementLevel: 40,
  convectivePassageLevel: 50,
  adsorptiveAffinityLevel: 60,
  availableBindingSurfaceLevel: 80,
  moleculeClass: 'small-analogue',
  flowArrangement: 'countercurrent',
})

const initialFluidInputs: SyntheticFluidLedgerInputs = Object.freeze({
  durationHours: 2,
  externalInputMlHour: 150,
  externalOutputMlHour: 45,
  machinePatientFluidRemovalMlHour: 75,
})

function numericValue(event: ChangeEvent<HTMLInputElement>): number {
  const value = event.currentTarget.valueAsNumber
  return Number.isFinite(value) && value >= 0 ? value : 0
}

function signedVolume(value: number): string {
  if (value === 0) return '0 mL'
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toLocaleString()} mL`
}

function volume(value: number): string {
  return `${value.toLocaleString()} mL`
}

interface SourceLimitationNoteProps {
  readonly sourceIds: readonly string[]
  readonly limitation: string
}

function SourceLimitationNote({ sourceIds, limitation }: SourceLimitationNoteProps) {
  return (
    <aside className={styles.sourceNote} aria-label="Source and limitation records">
      <strong>Source and limitation records</strong>
      <p>
        {sourceIds.map((sourceId, index) => (
          <span key={sourceId}>
            {index > 0 ? ', ' : null}
            <code>{sourceId}</code>
          </span>
        ))}
      </p>
      <small>{limitation}</small>
    </aside>
  )
}

interface IndexBarProps {
  readonly label: string
  readonly value: number
  readonly variant: 'diffusion' | 'convection' | 'ultrafiltration' | 'adsorption'
}

function IndexBar({ label, value, variant }: IndexBarProps) {
  return (
    <div className={styles.indexRow} data-variant={variant}>
      <div>
        <span>{label}</span>
        <strong>{value.toFixed(1)} / 100</strong>
      </div>
      <div
        className={styles.indexTrack}
        role="img"
        aria-label={`${label}: ${value.toFixed(1)} out of 100 synthetic index points`}
      >
        <span style={{ '--index-width': `${value}%` } as CSSProperties} />
      </div>
    </div>
  )
}

interface SyntheticRangeProps {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly value: number
  readonly onChange: (value: number) => void
}

function SyntheticRange({ id, label, description, value, onChange }: SyntheticRangeProps) {
  const descriptionId = `${id}-description`
  return (
    <div className={styles.rangeControl}>
      <div className={styles.rangeLabelRow}>
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{value}</output>
      </div>
      <input
        id={id}
        type="range"
        min="0"
        max="100"
        step="5"
        value={value}
        aria-describedby={descriptionId}
        onChange={(event) => onChange(numericValue(event))}
      />
      <small id={descriptionId}>{description}</small>
    </div>
  )
}

interface ConceptSelectProps {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly value: string
  readonly options: readonly { readonly value: string; readonly label: string }[]
  readonly onChange: (value: string) => void
}

function ConceptSelect({ id, label, description, value, options, onChange }: ConceptSelectProps) {
  const descriptionId = `${id}-description`
  return (
    <div className={styles.selectControl}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        aria-describedby={descriptionId}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <small id={descriptionId}>{description}</small>
    </div>
  )
}

const qualitativeModalities: readonly QualitativeCrrtModality[] = [
  'scuf',
  'cvvh',
  'cvvhd',
  'cvvhdf',
]

export function QualitativeEffluentExplorer() {
  const idPrefix = useId()
  const [modality, setModality] = useState<QualitativeCrrtModality>('scuf')
  const profile = getQualitativeEffluentProfile(modality)

  return (
    <section className={styles.effluentExplorer} aria-labelledby={`${idPrefix}-heading`}>
      <header>
        <span>Qualitative stream explorer</span>
        <h4 id={`${idPrefix}-heading`}>What can contribute to collected effluent?</h4>
      </header>

      <fieldset className={styles.modalityFieldset}>
        <legend>Select a conceptual modality</legend>
        <div className={styles.modalityOptions}>
          {qualitativeModalities.map((candidate) => {
            const candidateProfile = getQualitativeEffluentProfile(candidate)
            return (
              <label key={candidate}>
                <input
                  type="radio"
                  name={`${idPrefix}-modality`}
                  value={candidate}
                  checked={modality === candidate}
                  onChange={() => setModality(candidate)}
                />
                <span>{candidateProfile.label}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className={styles.effluentProfile} aria-live="polite" aria-atomic="true">
        <div className={styles.profileHeading}>
          <h5>{profile.label} conceptual effluent map</h5>
          <ul aria-label={`${profile.label} mechanisms represented`}>
            {profile.mechanismLabels.map((mechanism) => (
              <li key={mechanism}>{mechanism}</li>
            ))}
          </ul>
        </div>
        <p>{profile.summary}</p>
        <dl>
          {profile.terms.map((term) => (
            <div key={term.label}>
              <dt>{term.label}</dt>
              <dd>
                <strong>{term.status}</strong>
                <span>{term.description}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className={styles.profileBoundary}>{profile.boundary}</p>
      </div>

      <p className={styles.effluentReminder}>
        Effluent volume and patient-fluid removal are not interchangeable terms. This qualitative
        map intentionally provides no amounts.
      </p>
    </section>
  )
}

export function TransportMechanismLab() {
  const idPrefix = useId()
  const [inputs, setInputs] = useState<SyntheticTransportInputs>(initialTransportInputs)
  const result = calculateSyntheticTransport(inputs)

  function updateInput<Key extends keyof SyntheticTransportInputs>(
    key: Key,
    value: SyntheticTransportInputs[Key],
  ) {
    setInputs((current) => ({ ...current, [key]: value }))
  }

  return (
    <section
      className={styles.toolCard}
      aria-labelledby={`${idPrefix}-heading`}
      data-reviewer-only="false"
      data-review-status="pending"
      data-analytics="allowlisted"
      data-scoring="tool-specific"
      data-progress-write="learner-mode-only"
      data-persistence="learner-mode-only"
      data-competency="none"
    >
      <header className={styles.toolHeader}>
        <div>
          <span className={styles.toolNumber}>Instructional tool 01</span>
          <h3 id={`${idPrefix}-heading`}>Transport Mechanism Lab</h3>
        </div>
        <span className={styles.pendingBadge}>Learner tool</span>
      </header>

      <p className={styles.intro}>
        Explore deliberately simplified relationships among diffusion, convection, pressure-driven
        water movement (ultrafiltration), and conceptual solute binding at a membrane surface
        (adsorption).
      </p>

      <SourceLimitationNote
        sourceIds={transportMechanismCandidateSourceIds}
        limitation="These records provide mechanism context only; they do not validate the unitless index formulas, a membrane, a device setting, or a patient-specific prediction."
      />

      <div className={styles.conceptEquation} role="note" aria-label="Concept equations">
        <span>Diffusion index = concentration difference × diffusive passage</span>
        <span>Convection index = water movement × convective passage</span>
        <span>Ultrafiltration index = pressure-driven water movement</span>
        <span>Adsorption index = binding affinity × available surface</span>
      </div>

      <fieldset className={styles.controlFieldset}>
        <legend>Adjust synthetic concept levels</legend>
        <div className={styles.controlGrid}>
          <SyntheticRange
            id={`${idPrefix}-concentration`}
            label="Concentration difference (synthetic level)"
            description="Changes only the diffusion side of this teaching model."
            value={inputs.concentrationDifferenceLevel}
            onChange={(value) => updateInput('concentrationDifferenceLevel', value)}
          />
          <SyntheticRange
            id={`${idPrefix}-diffusive-passage`}
            label="Diffusive membrane passage (synthetic level)"
            description="Represents a unitless membrane-passage concept, not a filter specification."
            value={inputs.diffusivePassageLevel}
            onChange={(value) => updateInput('diffusivePassageLevel', value)}
          />
          <SyntheticRange
            id={`${idPrefix}-water-movement`}
            label="Pressure-driven water movement (synthetic level)"
            description="Represents ultrafiltration and supplies the water-movement term for convection."
            value={inputs.waterMovementLevel}
            onChange={(value) => updateInput('waterMovementLevel', value)}
          />
          <SyntheticRange
            id={`${idPrefix}-convective-passage`}
            label="Convective solute passage (synthetic level)"
            description="Represents a unitless passage concept, not a patient or device value."
            value={inputs.convectivePassageLevel}
            onChange={(value) => updateInput('convectivePassageLevel', value)}
          />
          <SyntheticRange
            id={`${idPrefix}-adsorptive-affinity`}
            label="Membrane-binding affinity (synthetic level)"
            description="A unitless solute-surface binding tendency, not a membrane specification."
            value={inputs.adsorptiveAffinityLevel}
            onChange={(value) => updateInput('adsorptiveAffinityLevel', value)}
          />
          <SyntheticRange
            id={`${idPrefix}-available-surface`}
            label="Available binding surface (synthetic level)"
            description="Lower levels represent fewer unoccupied conceptual binding sites."
            value={inputs.availableBindingSurfaceLevel}
            onChange={(value) => updateInput('availableBindingSurfaceLevel', value)}
          />
        </div>
      </fieldset>

      <fieldset className={styles.controlFieldset}>
        <legend>Compare qualitative context</legend>
        <div className={styles.contextControls}>
          <ConceptSelect
            id={`${idPrefix}-molecule-class`}
            label="Illustrative molecule class"
            description="Compares relative tendencies only; no named solute or clearance estimate."
            value={inputs.moleculeClass}
            options={[
              { value: 'small-analogue', label: 'Small-molecule analogue' },
              { value: 'middle-analogue', label: 'Middle-molecule analogue' },
            ]}
            onChange={(value) => updateInput('moleculeClass', value as SyntheticMoleculeClass)}
          />
          <ConceptSelect
            id={`${idPrefix}-flow-arrangement`}
            label="Blood/dialysate path relationship"
            description="A conceptual membrane-path comparison, not a device control."
            value={inputs.flowArrangement}
            options={[
              { value: 'countercurrent', label: 'Countercurrent (opposite directions)' },
              { value: 'concurrent', label: 'Concurrent (same direction)' },
            ]}
            onChange={(value) => updateInput('flowArrangement', value as SyntheticFlowArrangement)}
          />
        </div>
      </fieldset>

      <div className={styles.resultPanel} aria-labelledby={`${idPrefix}-results-heading`}>
        <h4 id={`${idPrefix}-results-heading`}>Synthetic mechanism comparison</h4>
        <IndexBar label="Diffusion index" value={result.diffusionIndex} variant="diffusion" />
        <IndexBar label="Convection index" value={result.convectionIndex} variant="convection" />
        <IndexBar
          label="Ultrafiltration index"
          value={result.ultrafiltrationIndex}
          variant="ultrafiltration"
        />
        <IndexBar label="Adsorption index" value={result.adsorptionIndex} variant="adsorption" />
        <output className={styles.resultSummary} aria-live="polite">
          Diffusion {result.diffusionIndex.toFixed(1)}; convection{' '}
          {result.convectionIndex.toFixed(1)}; ultrafiltration{' '}
          {result.ultrafiltrationIndex.toFixed(1)}; adsorption {result.adsorptionIndex.toFixed(1)}.{' '}
          {result.comparisonText}
        </output>
        <dl className={styles.qualitativeObservations}>
          <div>
            <dt>Small versus middle molecules</dt>
            <dd>{result.moleculeObservation}</dd>
          </div>
          <div>
            <dt>Blood/dialysate direction</dt>
            <dd>{result.flowObservation}</dd>
          </div>
          <div>
            <dt>Adsorption</dt>
            <dd>{result.adsorptionObservation}</dd>
          </div>
        </dl>
      </div>

      <QualitativeEffluentExplorer />

      <p className={styles.boundaryText}>
        Unitless concept model only. It does not calculate clearance, effluent dose, membrane
        capacity, a prescription, a device setting, or a patient-specific result.
      </p>
    </section>
  )
}

interface LedgerNumberInputProps {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly value: number
  readonly step?: number
  readonly onChange: (value: number) => void
}

function LedgerNumberInput({
  id,
  label,
  description,
  value,
  step = 5,
  onChange,
}: LedgerNumberInputProps) {
  const descriptionId = `${id}-description`
  return (
    <div className={styles.numberControl}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min="0"
        step={step}
        value={value}
        aria-describedby={descriptionId}
        onChange={(event) => onChange(numericValue(event))}
      />
      <small id={descriptionId}>{description}</small>
    </div>
  )
}

export function FluidBalanceLedger() {
  const idPrefix = useId()
  const [inputs, setInputs] = useState<SyntheticFluidLedgerInputs>(initialFluidInputs)
  const result = calculateSyntheticFluidLedger(inputs)

  function updateInput<Key extends keyof SyntheticFluidLedgerInputs>(
    key: Key,
    value: SyntheticFluidLedgerInputs[Key],
  ) {
    setInputs((current) => ({ ...current, [key]: value }))
  }

  const balanceExplanation =
    result.direction === 'even'
      ? 'Modeled inputs and combined modeled outputs are equal in this exercise.'
      : result.direction === 'positive'
        ? `Modeled inputs exceed combined modeled outputs by ${volume(
            Math.abs(result.wholePatientNetBalanceMl),
          )} in this exercise.`
        : `Combined modeled outputs exceed modeled inputs by ${volume(
            Math.abs(result.wholePatientNetBalanceMl),
          )} in this exercise.`

  return (
    <section
      className={styles.toolCard}
      aria-labelledby={`${idPrefix}-heading`}
      data-reviewer-only="false"
      data-review-status="pending"
      data-analytics="allowlisted"
      data-scoring="tool-specific"
      data-progress-write="learner-mode-only"
      data-persistence="learner-mode-only"
      data-competency="none"
    >
      <header className={styles.toolHeader}>
        <div>
          <span className={styles.toolNumber}>Instructional tool 02</span>
          <h3 id={`${idPrefix}-heading`}>Fluid Balance Ledger</h3>
        </div>
        <span className={styles.pendingBadge}>Learner tool</span>
      </header>

      <p className={styles.intro}>
        Compare whole-patient accounting with the machine-removal term. The ledger keeps external
        inputs, non-machine outputs, and modeled machine patient-fluid removal visible as separate
        quantities.
      </p>

      <SourceLimitationNote
        sourceIds={fluidLedgerCandidateSourceIds}
        limitation="These records provide accounting context only; they do not validate the synthetic values or establish a fluid-removal target."
      />

      <fieldset className={styles.controlFieldset}>
        <legend>Enter synthetic ledger values</legend>
        <div className={styles.ledgerControls}>
          <LedgerNumberInput
            id={`${idPrefix}-duration`}
            label="Modeled interval (hours)"
            description="Synthetic exercise duration; not a treatment recommendation."
            value={inputs.durationHours}
            step={0.5}
            onChange={(value) => updateInput('durationHours', value)}
          />
          <LedgerNumberInput
            id={`${idPrefix}-inputs`}
            label="All external inputs (mL/hour)"
            description="A combined synthetic input term for this exercise."
            value={inputs.externalInputMlHour}
            onChange={(value) => updateInput('externalInputMlHour', value)}
          />
          <LedgerNumberInput
            id={`${idPrefix}-outputs`}
            label="All non-machine outputs (mL/hour)"
            description="A combined synthetic non-machine output term."
            value={inputs.externalOutputMlHour}
            onChange={(value) => updateInput('externalOutputMlHour', value)}
          />
          <LedgerNumberInput
            id={`${idPrefix}-machine-removal`}
            label="Modeled machine patient-fluid removal (mL/hour)"
            description="One ledger term only; not a prescribed setting or target."
            value={inputs.machinePatientFluidRemovalMlHour}
            onChange={(value) => updateInput('machinePatientFluidRemovalMlHour', value)}
          />
        </div>
      </fieldset>

      <div
        className={styles.tableRegion}
        role="region"
        aria-label="Synthetic fluid ledger; horizontally scrollable"
        tabIndex={0}
      >
        <table className={styles.ledgerTable}>
          <caption>Integrated volumes for the modeled interval</caption>
          <thead>
            <tr>
              <th scope="col">Ledger term</th>
              <th scope="col">Direction</th>
              <th scope="col">Integrated volume</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">External inputs</th>
              <td>Into patient ledger</td>
              <td>{volume(result.externalInputMl)}</td>
            </tr>
            <tr>
              <th scope="row">Non-machine outputs</th>
              <td>Out of patient ledger</td>
              <td>{volume(result.externalOutputMl)}</td>
            </tr>
            <tr>
              <th scope="row">Modeled machine patient-fluid removal</th>
              <td>Out of patient ledger</td>
              <td>{volume(result.machinePatientFluidRemovalMl)}</td>
            </tr>
            <tr>
              <th scope="row">Combined outputs</th>
              <td>Out of patient ledger</td>
              <td>{volume(result.combinedOutputMl)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <output className={styles.balanceResult} aria-live="polite">
        <span>Whole-patient net balance</span>
        <strong data-direction={result.direction}>
          {signedVolume(result.wholePatientNetBalanceMl)}
        </strong>
        <small>{balanceExplanation}</small>
      </output>

      <p className={styles.boundaryText}>
        Conservation exercise only. The values are synthetic, omit local charting conventions, and
        do not establish a fluid goal, prescription, treatment response, or device instruction.
      </p>
    </section>
  )
}

export function CitrateCalciumDashboardScaffold() {
  const idPrefix = useId()
  const [directions, setDirections] = useState<Record<string, string>>(
    Object.fromEntries(citrateDashboardDomains.map((domain) => [domain, 'unknown'])),
  )
  const [checks, setChecks] = useState<string[]>([])
  const [escalated, setEscalated] = useState(false)
  const safetyChecks = [
    'Verify sampling and timing',
    'Verify circuit and delivery context',
    'Verify authorized local-protocol context',
  ] as const

  return (
    <section
      className={`${styles.toolCard} ${styles.blockedDashboard}`}
      aria-labelledby={`${idPrefix}-heading`}
      data-reviewer-only="false"
      data-review-status="pending"
      data-conceptual-only="true"
      data-analytics="allowlisted"
      data-scoring="recognition"
      data-progress-write="learner-mode-only"
      data-persistence="learner-mode-only"
      data-competency="none"
    >
      <header className={styles.toolHeader}>
        <div>
          <span className={styles.toolNumber}>Instructional tool 06</span>
          <h3 id={`${idPrefix}-heading`}>Conceptual Citrate-Calcium Dashboard</h3>
        </div>
        <span className={styles.pendingBadge}>Direction-only education</span>
      </header>

      <div className={styles.blockedStatus} role="note" aria-label="Conceptual safety boundary">
        <strong>Recognition, verification, reassessment, and escalation only.</strong>
        <p>
          This dashboard represents linked trend directions and safety checks. Medication-specific
          clinical instructions remain outside this general educational module.
        </p>
      </div>

      <section aria-labelledby={`${idPrefix}-domains`}>
        <h4 id={`${idPrefix}-domains`}>Link the observed directions</h4>
        <ul className={styles.blockedDomainGrid} aria-label="Citrate-calcium trend directions">
          {citrateDashboardDomains.map((domain) => (
            <li key={domain}>
              <label>
                <span>{domain}</span>
                <select
                  value={directions[domain]}
                  onChange={(event) =>
                    setDirections((current) => ({ ...current, [domain]: event.target.value }))
                  }
                >
                  <option value="unknown">Unknown</option>
                  <option value="stable">Stable</option>
                  <option value="rising">Rising</option>
                  <option value="falling">Falling</option>
                </select>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <fieldset className={styles.blockedRequirements}>
        <legend>Required safety checks</legend>
        {safetyChecks.map((check) => (
          <label key={check}>
            <input
              type="checkbox"
              checked={checks.includes(check)}
              onChange={(event) =>
                setChecks((current) =>
                  event.target.checked
                    ? [...current, check]
                    : current.filter((candidate) => candidate !== check),
                )
              }
            />
            {check}
          </label>
        ))}
      </fieldset>

      <button
        type="button"
        disabled={checks.length !== safetyChecks.length}
        onClick={() => setEscalated(true)}
      >
        Record escalation and reassessment
      </button>
      <p role="status">
        {escalated
          ? 'Conceptual pattern communicated to the responsible clinical team; reassessment remains required.'
          : 'Complete all safety checks before recording escalation.'}
      </p>

      <SourceLimitationNote
        sourceIds={citrateDashboardManifest.sourceRecordIds}
        limitation="These records support conceptual trend recognition only; they do not supply a local clinical protocol."
      />

      <div className={styles.blockedRequirementList} role="note">
        <strong>Unavailable expressions</strong>
        <ul>
          {citrateDashboardManifest.blockingInputs.map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function CrrtPhase7InstructionalTools() {
  return (
    <section
      className={styles.reviewerTools}
      aria-labelledby="baxter-crrt-phase7-instructional-tools-heading"
      data-reviewer-only="false"
      data-review-status="pending"
      data-analytics="allowlisted"
      data-scoring="tool-specific"
      data-progress-write="learner-mode-only"
      data-persistence="learner-mode-only"
      data-competency="none"
    >
      <header className={styles.sectionHeader}>
        <div>
          <span className={styles.kicker}>Six instructional tools</span>
          <h2 id="baxter-crrt-phase7-instructional-tools-heading">Interactive concept labs</h2>
        </div>
        <span className={styles.reviewBadge}>Learner workspace</span>
      </header>

      <div className={styles.reviewBoundary} role="note" aria-label="Educational boundary">
        <strong>General educational use; not patient-specific guidance.</strong>
        <p>
          These exercises use synthetic values and manual-reference device concepts. Unresolved
          expressions stay visibly unavailable without disabling the surrounding lab.
        </p>
      </div>

      <div className={styles.toolGrid}>
        <TransportMechanismLab />
        <CrrtPhase7PrescriptionWorkbench />
        <CrrtPressureLocalizationLab />
        <FluidBalanceLedger />
        <CitrateCalciumDashboardScaffold />
      </div>
    </section>
  )
}

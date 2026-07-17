'use client'

import { ChevronRight, LibraryBig } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'

import {
  selectPrescriptionSummary,
  type CrrtFlowRateKey,
  type CrrtLearningSessionState,
} from '../engine'
import styles from './crrt-reference-drawer.module.css'

const referenceTabs = [
  { id: 'prescription', label: 'Prescription' },
  { id: 'history', label: 'History' },
  { id: 'events', label: 'Events' },
  { id: 'trends', label: 'Trends' },
  { id: 'equations', label: 'Equations' },
] as const

type CrrtReferenceTabId = (typeof referenceTabs)[number]['id']

const prescriptionFlowRows: readonly {
  readonly key: CrrtFlowRateKey
  readonly label: string
  readonly unit: 'mL/min' | 'mL/h'
}[] = [
  { key: 'bloodFlowMlMin', label: 'Blood flow', unit: 'mL/min' },
  { key: 'dialysateFlowMlHour', label: 'Dialysate flow', unit: 'mL/h' },
  { key: 'pbpFlowMlHour', label: 'Pre-blood-pump flow', unit: 'mL/h' },
  { key: 'preReplacementFlowMlHour', label: 'Pre-replacement flow', unit: 'mL/h' },
  { key: 'postReplacementFlowMlHour', label: 'Post-replacement flow', unit: 'mL/h' },
  { key: 'patientFluidRemovalMlHour', label: 'Patient fluid removal', unit: 'mL/h' },
  { key: 'syringeFlowMlHour', label: 'Syringe flow', unit: 'mL/h' },
  { key: 'makeupFlowMlHour', label: 'Makeup flow', unit: 'mL/h' },
]

const historyTypeLabels: Readonly<
  Record<CrrtLearningSessionState['timeline'][number]['type'], string>
> = {
  'prediction-committed': 'Prediction committed',
  'intervention-performed': 'Intervention performed',
  'device-action': 'Device action',
  'time-advanced': 'Time advanced',
  'hint-used': 'Hint used',
  'reassessment-committed': 'Reassessment committed',
  'debrief-revealed': 'Debrief revealed',
}

interface CrrtReferenceDrawerProps {
  readonly session: CrrtLearningSessionState
}

function formatSimulationTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'Unavailable'
  if (seconds === 0) return '0 min'
  if (seconds % 3_600 === 0) return `${seconds / 3_600} hr`
  if (seconds % 60 === 0) return `${seconds / 60} min`
  return `${seconds} sec`
}

function formatValue(value: number | null | undefined, unit: string, digits = 0): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable'
  return `${value.toFixed(digits)} ${unit}`
}

function historyReferenceLabel(
  session: CrrtLearningSessionState,
  entry: CrrtLearningSessionState['timeline'][number],
): string | null {
  if (entry.referenceId === null) return null
  if (entry.type === 'time-advanced') {
    const seconds = Number(entry.referenceId)
    return Number.isFinite(seconds) ? `+${formatSimulationTime(seconds)}` : entry.referenceId
  }
  const intervention = session.caseDefinition.interventions.find(
    ({ id }) => id === entry.referenceId,
  )
  if (intervention) return intervention.label
  const hint = session.caseDefinition.hintLadder.find(({ id }) => id === entry.referenceId)
  if (hint) return `Hint ${hint.sequence}`
  return entry.referenceId.replaceAll('-', ' ')
}

function PrescriptionReference({ session }: CrrtReferenceDrawerProps) {
  const prescription = selectPrescriptionSummary(session.simulation)

  if (prescription.status !== 'configured' || prescription.modality === null) {
    return <p className={styles.unavailable}>Prescription data is unavailable for this attempt.</p>
  }

  return (
    <>
      <p className={styles.panelLead}>
        Current simulation prescription. Values are synthetic and review-pending.
      </p>
      <dl className={styles.referenceGrid}>
        <div>
          <dt>Modality</dt>
          <dd>{prescription.modality.toUpperCase()}</dd>
        </div>
        {prescriptionFlowRows.map(({ key, label, unit }) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{formatValue(prescription.flows[key], unit)}</dd>
          </div>
        ))}
        <div>
          <dt>Prescribed effluent rate</dt>
          <dd>{formatValue(prescription.prescribedEffluentRateMlHour, 'mL/h')}</dd>
        </div>
        <div>
          <dt>Prescribed effluent dose</dt>
          <dd>{formatValue(prescription.prescribedEffluentDoseMlKgHour, 'mL/kg/h', 1)}</dd>
        </div>
        <div>
          <dt>Delivered dose</dt>
          <dd>{formatValue(prescription.deliveredDoseMlKgHour, 'mL/kg/h', 1)}</dd>
        </div>
      </dl>
    </>
  )
}

function HistoryReference({ session }: CrrtReferenceDrawerProps) {
  return (
    <>
      <p className={styles.panelLead}>Ordered actions recorded for this in-memory attempt.</p>
      {session.timeline.length > 0 ? (
        <ol className={styles.referenceList}>
          {session.timeline.map((entry) => {
            const referenceLabel = historyReferenceLabel(session, entry)
            return (
              <li key={entry.sequence}>
                <time>{formatSimulationTime(entry.atSeconds)}</time>
                <strong>{historyTypeLabels[entry.type]}</strong>
                {referenceLabel ? <span>{referenceLabel}</span> : null}
              </li>
            )
          })}
        </ol>
      ) : (
        <p className={styles.unavailable}>No attempt history has been recorded yet.</p>
      )}
    </>
  )
}

function EventsReference({ session }: CrrtReferenceDrawerProps) {
  const realizedEvents = session.simulation.scenario.eventQueue.filter((event) =>
    session.simulation.scenario.appliedEventIds.includes(event.id),
  )

  return (
    <>
      <p className={styles.panelLead}>
        Realized seeded engine events only. Future queued events are not exposed.
      </p>
      {realizedEvents.length > 0 ? (
        <ol className={styles.referenceList}>
          {realizedEvents.map((event) => (
            <li key={event.id}>
              <time>{formatSimulationTime(event.scheduledAtSeconds)}</time>
              <strong>{event.id.replaceAll('-', ' ')}</strong>
              <span>{event.action.type.replaceAll('_', ' ').toLowerCase()}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.unavailable}>No seeded engine events have occurred yet.</p>
      )}
    </>
  )
}

function TrendsReference({ session }: CrrtReferenceDrawerProps) {
  const samples = session.simulation.trends.slice(-6)

  return (
    <>
      <p className={styles.panelLead}>
        Latest synthetic pressure and dose samples from the current deterministic run.
      </p>
      {samples.length > 0 ? (
        <div
          className={styles.tableRegion}
          role="region"
          aria-label="Reference pressure and dose trends; horizontally scrollable on narrow screens"
          tabIndex={0}
        >
          <table>
            <caption>Review-pending simulation samples; not patient-care targets.</caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Access</th>
                <th scope="col">Filter</th>
                <th scope="col">Return</th>
                <th scope="col">TMP</th>
                <th scope="col">Prescribed dose</th>
                <th scope="col">Delivered dose</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => (
                <tr key={sample.timeSeconds}>
                  <th scope="row">{formatSimulationTime(sample.timeSeconds)}</th>
                  <td>{formatValue(sample.accessPressureMmHg, 'mmHg')}</td>
                  <td>{formatValue(sample.filterPressureMmHg, 'mmHg')}</td>
                  <td>{formatValue(sample.returnPressureMmHg, 'mmHg')}</td>
                  <td>{formatValue(sample.transmembranePressureMmHg, 'mmHg')}</td>
                  <td>{formatValue(sample.prescribedEffluentDoseMlKgHour, 'mL/kg/h', 1)}</td>
                  <td>{formatValue(sample.deliveredDoseMlKgHour, 'mL/kg/h', 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.unavailable}>No trend samples are available for this attempt.</p>
      )}
    </>
  )
}

function EquationsReference() {
  return (
    <div className={styles.unavailable} role="note" aria-label="Equation reference unavailable">
      <strong>Equation reference unavailable.</strong>
      <p>
        Learner-facing equations and explanations are not approved in this review candidate. Hidden
        calibration terms remain educator-only in development and are not reproduced here.
      </p>
    </div>
  )
}

export function CrrtReferenceDrawer({ session }: CrrtReferenceDrawerProps) {
  const idPrefix = `crrt-reference-${useId().replaceAll(':', '')}`
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<CrrtReferenceTabId>('prescription')
  const tabRefs = useRef<Partial<Record<CrrtReferenceTabId, HTMLButtonElement | null>>>({})

  function selectTab(tabId: CrrtReferenceTabId) {
    setActiveTab(tabId)
    tabRefs.current[tabId]?.focus()
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, tabId: CrrtReferenceTabId) {
    const currentIndex = referenceTabs.findIndex(({ id }) => id === tabId)
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % referenceTabs.length
    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + referenceTabs.length) % referenceTabs.length
    }
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = referenceTabs.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    selectTab(referenceTabs[nextIndex].id)
  }

  return (
    <details
      className={styles.drawer}
      data-testid="crrt-reference-drawer"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary aria-controls={`${idPrefix}-content`} aria-expanded={isOpen}>
        <ChevronRight className={styles.disclosureIcon} aria-hidden="true" />
        <LibraryBig aria-hidden="true" />
        <span>
          <strong>Attempt reference drawer</strong>
          <small>Read-only prescription, history, events, trends, and equation status</small>
        </span>
        <em>Open / close</em>
      </summary>

      <div id={`${idPrefix}-content`} className={styles.drawerContent} aria-hidden={!isOpen}>
        <p className={styles.boundary} role="note">
          Synthetic attempt references only. This drawer contains no operational controls and no
          patient-care instructions.
        </p>

        <div
          className={styles.tabList}
          role="tablist"
          aria-label="Attempt reference sections"
          aria-orientation="horizontal"
        >
          {referenceTabs.map((tab) => {
            const selected = tab.id === activeTab
            return (
              <button
                key={tab.id}
                id={`${idPrefix}-tab-${tab.id}`}
                ref={(node) => {
                  tabRefs.current[tab.id] = node
                }}
                type="button"
                role="tab"
                aria-controls={`${idPrefix}-panel-${tab.id}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {referenceTabs.map((tab) => (
          <section
            key={tab.id}
            id={`${idPrefix}-panel-${tab.id}`}
            className={styles.tabPanel}
            role="tabpanel"
            aria-labelledby={`${idPrefix}-tab-${tab.id}`}
            hidden={tab.id !== activeTab}
          >
            {tab.id === 'prescription' ? <PrescriptionReference session={session} /> : null}
            {tab.id === 'history' ? <HistoryReference session={session} /> : null}
            {tab.id === 'events' ? <EventsReference session={session} /> : null}
            {tab.id === 'trends' ? <TrendsReference session={session} /> : null}
            {tab.id === 'equations' ? <EquationsReference /> : null}
          </section>
        ))}
      </div>
    </details>
  )
}

'use client'

import { BookOpen, BrainCircuit, ClipboardCheck, FlaskConical, ShieldAlert } from 'lucide-react'
import { useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from 'react'

import {
  BAXTER_CRRT_DEVICE_IDS,
  baxterCrrtCaseCatalog,
  baxterCrrtLearnerCases,
  baxterCrrtMasteryManifest,
  baxterCrrtPublicationStatus,
  baxterCrrtReleaseStage,
  baxterCrrtStationLabels,
  getBaxterCrrtCase,
  getBaxterCrrtDeviceProfile,
  type BaxterCrrtDeviceId,
  type CrrtCaseId,
} from '../content'
import {
  createCrrtLearningSession,
  createDefaultProgress,
  crrtLearningSessionReducer,
  getBaxterCrrtDeviceAdapter,
  readProgress,
  recordCaseResult,
  recordLessonCompletion,
  selectCrrtLearningOutcome,
  writeProgress,
  type BaxterCrrtProgressV3,
  type CrrtLearningExperience,
  type CrrtRoleLens,
  type CrrtRuntimeSessionMode,
} from '../engine'
import { CrrtLearningWorkflow, type CrrtMobileSurface } from './CrrtLearningWorkflow'
import { CrrtCrossDeviceTransferReview } from './CrrtCrossDeviceTransferReview'
import { CrrtPhase7InstructionalTools } from './CrrtPhase7InstructionalTools'
import { CrrtRapidDrillReview } from './CrrtRapidDrillReview'
import { SourcesPanel } from './SourcesPanel'
import styles from './baxter-crrt.module.css'

type WorkspaceTab = 'learn' | 'practice' | 'mastery' | 'drills' | 'tools'

interface BaxterCrrtLabProps {
  readonly locale?: string
  readonly sessionMode?: CrrtRuntimeSessionMode
}

const workspaceTabs: readonly {
  readonly id: WorkspaceTab
  readonly label: string
  readonly summary: string
  readonly icon: typeof BookOpen
}[] = [
  { id: 'learn', label: 'Learn', summary: '18 guided cases', icon: BookOpen },
  { id: 'practice', label: 'Practice', summary: 'New scored attempts', icon: ClipboardCheck },
  { id: 'mastery', label: 'Mastery', summary: 'Masked PrisMax capstone', icon: BrainCircuit },
  { id: 'drills', label: 'Drills', summary: '7 cause-first drills', icon: ShieldAlert },
  { id: 'tools', label: 'Tools', summary: '6 instructional labs', icon: FlaskConical },
]

const mobileSurfaces: readonly { readonly id: CrrtMobileSurface; readonly label: string }[] = [
  { id: 'case', label: 'Case' },
  { id: 'machine', label: 'Machine' },
  { id: 'circuit', label: 'Circuit' },
  { id: 'patient', label: 'Patient / trends' },
  { id: 'debrief', label: 'Debrief' },
]

const roleLabels: Readonly<Record<CrrtRoleLens, string>> = {
  integrated: 'Integrated team',
  operator: 'Operator',
  prescriber: 'Prescriber',
}

function experienceForTab(tab: WorkspaceTab): CrrtLearningExperience {
  if (tab === 'mastery') return 'mastery'
  return tab === 'practice' ? 'practice' : 'learn'
}

function isCrrtCaseId(value: string): value is CrrtCaseId {
  return baxterCrrtLearnerCases.some((definition) => definition.id === value)
}

export default function BaxterCrrtLab({
  locale = 'en',
  sessionMode = 'learner',
}: BaxterCrrtLabProps) {
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('learn')
  const [deviceId, setDeviceId] = useState<BaxterCrrtDeviceId>('prismax-aw8035-2xx')
  const [roleLens, setRoleLens] = useState<CrrtRoleLens>('integrated')
  const [selectedCaseId, setSelectedCaseId] = useState<CrrtCaseId>('CRRT-01')
  const [mobileSurface, setMobileSurface] = useState<CrrtMobileSurface>('case')
  const [progress, setProgress] = useState<BaxterCrrtProgressV3>(() => createDefaultProgress())
  const [progressHydrated, setProgressHydrated] = useState(false)
  const workspaceTabRefs = useRef<Partial<Record<WorkspaceTab, HTMLButtonElement>>>({})
  const mobileTabRefs = useRef<Partial<Record<CrrtMobileSurface, HTMLButtonElement>>>({})

  const experience = experienceForTab(workspaceTab)
  const effectiveCaseId = experience === 'mastery' ? 'CRRT-16' : selectedCaseId
  const caseDefinition = getBaxterCrrtCase(effectiveCaseId)
  const effectiveDeviceId = experience === 'mastery' ? baxterCrrtMasteryManifest.deviceId : deviceId
  const profile = getBaxterCrrtDeviceProfile(effectiveDeviceId)
  const adapter = getBaxterCrrtDeviceAdapter(effectiveDeviceId)

  const initialSessionOptions = useMemo(
    () => ({
      caseDefinition,
      experience,
      roleLens,
      attempt: 1,
      deviceId: effectiveDeviceId,
      mode: sessionMode,
    }),
    // The reducer is explicitly reloaded by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [session, dispatch] = useReducer(
    crrtLearningSessionReducer,
    initialSessionOptions,
    createCrrtLearningSession,
  )

  useEffect(() => {
    if (sessionMode === 'learner') setProgress(readProgress())
    setProgressHydrated(true)
  }, [sessionMode])

  useEffect(() => {
    if (workspaceTab === 'drills' || workspaceTab === 'tools') return
    dispatch({
      type: 'LOAD_CASE',
      caseDefinition,
      experience,
      roleLens,
      attempt: 1,
      deviceId: effectiveDeviceId,
      mode: sessionMode,
    })
    setMobileSurface('case')
  }, [caseDefinition, effectiveDeviceId, experience, roleLens, sessionMode, workspaceTab])

  function chooseTab(tab: WorkspaceTab) {
    setWorkspaceTab(tab)
    if (tab === 'mastery') setDeviceId('prismax-aw8035-2xx')
  }

  function moveTabFocus<T extends string>(
    event: KeyboardEvent<HTMLButtonElement>,
    ids: readonly T[],
    currentId: T,
    select: (id: T) => void,
    refs: Readonly<Partial<Record<T, HTMLButtonElement>>>,
  ) {
    const currentIndex = ids.indexOf(currentId)
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % ids.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + ids.length) % ids.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = ids.length - 1
    }
    if (nextIndex === null) return
    event.preventDefault()
    const nextId = ids[nextIndex]
    select(nextId)
    refs[nextId]?.focus()
  }

  function chooseCase(caseId: string) {
    if (!isCrrtCaseId(caseId)) return
    setSelectedCaseId(caseId)
  }

  function persistProgress(next: BaxterCrrtProgressV3) {
    setProgress(next)
    if (progressHydrated) writeProgress(next, undefined, sessionMode)
  }

  function recordDebrief() {
    if (!session.persistenceEnabled) return
    const outcome = selectCrrtLearningOutcome(session)
    if (session.experience === 'learn') {
      persistProgress(
        recordLessonCompletion(progress, `${session.caseDefinition.id.toLowerCase()}.learn`),
      )
      return
    }
    if (!outcome.scored || outcome.score === null) return
    const resultId =
      session.experience === 'mastery'
        ? baxterCrrtMasteryManifest.id
        : session.caseDefinition.id.toLowerCase()
    persistProgress(
      recordCaseResult(progress, {
        caseId: resultId,
        device: session.simulation.deviceId,
        roleLens: session.roleLens,
        pathway: session.experience === 'mastery' ? 'mastery' : 'practice',
        score: outcome.score,
        criticalError: outcome.criticalErrorIds.length > 0,
        hintCount: session.usedHintIds.length,
        reassessmentCompleted: outcome.reassessmentComplete,
        masteryCompleted: outcome.mastery,
      }),
    )
  }

  const caseGroups = ([1, 2, 3, 4, 5, 6] as const).map((station) => ({
    station,
    label: baxterCrrtStationLabels[station],
    cases: baxterCrrtCaseCatalog.filter((entry) => entry.station === station),
  }))

  return (
    <main
      className={styles.moduleShell}
      data-release-stage={baxterCrrtReleaseStage}
      data-publication-status={baxterCrrtPublicationStatus}
      data-session-mode={sessionMode}
      data-analytics={sessionMode === 'review-preview' ? 'suppressed' : 'allowlisted'}
      data-progress-write={sessionMode === 'review-preview' ? 'suppressed' : 'v3'}
      data-no-handoff-translate={locale === 'en' ? undefined : 'true'}
    >
      <section className={styles.hero} aria-labelledby="baxter-crrt-heading">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Adult ICU CRRT · clinical simulation</p>
          <h1 id="baxter-crrt-heading">Baxter CRRT Learn, Practice &amp; Mastery</h1>
          <p className={styles.heroLead}>
            Work through 18 clinical cases, seven rapid safety drills, six concept labs, two
            manufacturer-manual-based device interfaces, and a masked PrisMax capstone.
          </p>
          <div className={styles.heroBadges}>
            <span>18 clinical cases</span>
            <span>
              {sessionMode === 'review-preview'
                ? 'SME preview · progress not saved'
                : 'Progress saved on this device'}
            </span>
            <span>English</span>
          </div>
        </div>
      </section>

      <section className={styles.safetyBanner} role="note" aria-label="Educational safety notice">
        <ShieldAlert aria-hidden="true" />
        <div>
          <strong>Education only—never patient-specific advice or a local operating policy.</strong>
          <p>
            Case values and responses are simulated for practice. They are not treatment targets,
            alarm limits, or proof of competency. For patient care, use current device instructions,
            authorized local protocols, supervision, and clinical judgment.
          </p>
        </div>
      </section>

      {locale !== 'en' ? (
        <section className={styles.languageFallback} role="note">
          <BookOpen aria-hidden="true" />
          <div>
            <strong>Reviewed-English fallback</strong>
            <p>English remains authoritative while localized CRRT content is unavailable.</p>
          </div>
        </section>
      ) : null}

      <dl className={styles.profileStrip} aria-label="CRRT workspace controls">
        <div>
          <dt>Device interface</dt>
          <dd>
            <select
              aria-label="Device profile"
              value={effectiveDeviceId}
              disabled={experience === 'mastery'}
              onChange={(event) => setDeviceId(event.target.value as BaxterCrrtDeviceId)}
            >
              {BAXTER_CRRT_DEVICE_IDS.map((id) => (
                <option key={id} value={id}>
                  {getBaxterCrrtDeviceProfile(id).displayName}
                </option>
              ))}
            </select>
          </dd>
        </div>
        <div>
          <dt>Role lens</dt>
          <dd>
            <select
              aria-label="Role lens"
              value={roleLens}
              onChange={(event) => setRoleLens(event.target.value as CrrtRoleLens)}
            >
              {Object.entries(roleLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </dd>
        </div>
        <div>
          <dt>Reference manual</dt>
          <dd>
            {profile.manualNumber} · {profile.manualRevision}
          </dd>
        </div>
        <div>
          <dt>Local configuration</dt>
          <dd>
            Not configured · confirm site-specific device, disposables, solutions, and protocols
          </dd>
        </div>
      </dl>

      <section className={styles.pathwaySection} aria-labelledby="workspace-pathways-heading">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.kicker}>Workspace</span>
            <h2 id="workspace-pathways-heading">Choose a learning experience</h2>
          </div>
        </div>
        <div className={styles.pathwayTabs} role="tablist" aria-label="CRRT learning experiences">
          {workspaceTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                id={`baxter-crrt-workspace-tab-${tab.id}`}
                ref={(node) => {
                  if (node) workspaceTabRefs.current[tab.id] = node
                }}
                type="button"
                role="tab"
                aria-selected={workspaceTab === tab.id}
                aria-controls={`baxter-crrt-${tab.id}-panel`}
                tabIndex={workspaceTab === tab.id ? 0 : -1}
                onClick={() => chooseTab(tab.id)}
                onKeyDown={(event) =>
                  moveTabFocus(
                    event,
                    workspaceTabs.map(({ id }) => id),
                    tab.id,
                    chooseTab,
                    workspaceTabRefs.current,
                  )
                }
              >
                <Icon aria-hidden="true" />
                <span>
                  <strong>{tab.label}</strong>
                  <small>{tab.summary}</small>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {workspaceTab === 'drills' ? (
        <section
          id="baxter-crrt-drills-panel"
          role="tabpanel"
          aria-labelledby="baxter-crrt-workspace-tab-drills"
        >
          <CrrtRapidDrillReview />
        </section>
      ) : workspaceTab === 'tools' ? (
        <section
          id="baxter-crrt-tools-panel"
          role="tabpanel"
          aria-labelledby="baxter-crrt-workspace-tab-tools"
        >
          <CrrtPhase7InstructionalTools />
        </section>
      ) : (
        <section
          id={`baxter-crrt-${workspaceTab}-panel`}
          className={styles.workbenchSection}
          role="tabpanel"
          aria-labelledby={`baxter-crrt-workspace-tab-${workspaceTab}`}
          aria-label={`${workspaceTab} workspace`}
        >
          <div className={styles.workspaceControls}>
            <label>
              <span>Station-grouped case</span>
              <select
                value={effectiveCaseId}
                disabled={experience === 'mastery'}
                onChange={(event) => chooseCase(event.target.value)}
              >
                {caseGroups.map((group) => (
                  <optgroup key={group.station} label={`${group.station}. ${group.label}`}>
                    {group.cases.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.id} · {entry.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className={styles.deviceSummary}>
              <strong>{profile.displayName}</strong>
              <span>
                {adapter.getSetupSteps().length} setup steps ·{' '}
                {effectiveDeviceId === 'prismax-aw8035-2xx'
                  ? 'procedure workflow'
                  : 'softkey workflow'}
              </span>
              <small>{profile.marketConfiguration}</small>
            </div>
          </div>

          <div
            className={styles.mobileSurfaceTabs}
            role="tablist"
            aria-label="CRRT mobile workspace surface"
          >
            {mobileSurfaces.map((surface) => (
              <button
                key={surface.id}
                id={`${workspaceTab}-${effectiveDeviceId}-baxter-crrt-mobile-tab-${surface.id}`}
                ref={(node) => {
                  if (node) mobileTabRefs.current[surface.id] = node
                }}
                type="button"
                role="tab"
                aria-selected={mobileSurface === surface.id}
                aria-controls={`${workspaceTab}-${effectiveDeviceId}-baxter-crrt-mobile-panel-${surface.id}`}
                tabIndex={mobileSurface === surface.id ? 0 : -1}
                onClick={() => setMobileSurface(surface.id)}
                onKeyDown={(event) =>
                  moveTabFocus(
                    event,
                    mobileSurfaces.map(({ id }) => id),
                    surface.id,
                    setMobileSurface,
                    mobileTabRefs.current,
                  )
                }
              >
                {surface.label}
              </button>
            ))}
          </div>

          <CrrtLearningWorkflow
            session={session}
            dispatch={dispatch}
            availableCases={
              experience === 'mastery' ? [getBaxterCrrtCase('CRRT-16')] : baxterCrrtLearnerCases
            }
            mobileSurface={mobileSurface}
            onCaseChange={chooseCase}
            onRoleChange={setRoleLens}
            onReset={() => dispatch({ type: 'RESET', attempt: session.attempt + 1 })}
            onDebriefRevealed={recordDebrief}
            idNamespace={`${workspaceTab}-${effectiveDeviceId}`}
          />
          {workspaceTab === 'mastery' ? <CrrtCrossDeviceTransferReview /> : null}
        </section>
      )}

      <SourcesPanel reviewPreview={sessionMode === 'review-preview'} />
    </main>
  )
}

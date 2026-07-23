'use client'

import type { Route } from 'next'
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldAlert, Stethoscope } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  getCriticalCareEligibleIcuAssessmentScenarioIds,
  getCriticalCareIcuScenarioReadiness,
  getCriticalCareIcuScenarioRecommendation,
  isIcuScenarioFamily,
} from '@/features/critical-care/progress/integrated'
import { Link, useRouter } from '@/i18n/navigation'
import type { CriticalCareProgressEnvelope } from '@/features/learning-module/activity'
import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'

import { getIcuScenario } from '../content'
import { icuScenarioFamilies, type IcuScenarioFamily } from '../engine'
import { IcuRemediationLinks } from './IcuRemediationLinks'
import { IcuSimulatorLab } from './IcuSimulatorLab'
import styles from './icu-simulation.module.css'

export interface IcuCapstoneEntryProps {
  readonly mode: 'practice' | 'assess'
  readonly locale?: string
  readonly requestedScenarioId?: string
}

interface ProgressState {
  readonly status: 'loading' | 'ready'
  readonly envelope: CriticalCareProgressEnvelope
  readonly loadFailed: boolean
}

const emptyProgress: CriticalCareProgressEnvelope = {
  version: 1,
  activities: [],
  updatedAt: '1970-01-01T00:00:00.000Z',
}

function IntegratedSimulatorLaunchGate({ children }: { readonly children: ReactNode }) {
  const router = useRouter()
  return (
    <SimulationLaunchGate
      activityTitle="Integrated ICU bedside simulator"
      minimumViewport="desktop"
      bandwidthClass="heavy"
      estimatedSizeLabel="Interactive bedside, device, and monitor assets"
      lightweightAlternativeHref="/icu-simulation"
      onSaveForLater={() => router.push('/critical-care' as Route)}
      theme="dark"
    >
      {children}
    </SimulationLaunchGate>
  )
}

function assessmentCaseLabel(scenarioId: IcuScenarioFamily): string {
  const index = icuScenarioFamilies.indexOf(scenarioId)
  return `Assessment case ${String(index + 1).padStart(2, '0')}`
}

function ProgressLoading({ mode }: { readonly mode: 'practice' | 'assess' }) {
  return (
    <main className={styles.capstoneGate}>
      <section className={styles.capstoneStatus} role="status">
        <span className={styles.panelKicker}>Integrated ICU capstone</span>
        <h1>Checking saved preparation…</h1>
        <p>
          {mode === 'practice'
            ? 'Practice remains open while compatible local progress is checked.'
            : 'Released prerequisites are verified before they can gate a masked course; pending-review preparation remains advisory.'}
        </p>
      </section>
    </main>
  )
}

function PracticeEntry({
  envelope,
  locale,
  requestedScenarioId,
  loadFailed,
}: {
  readonly envelope: CriticalCareProgressEnvelope
  readonly locale?: string
  readonly requestedScenarioId?: string
  readonly loadFailed: boolean
}) {
  const recommendation = getCriticalCareIcuScenarioRecommendation(envelope)
  const requested = isIcuScenarioFamily(requestedScenarioId) ? requestedScenarioId : undefined
  const scenarioId = requested ?? recommendation.scenarioId
  const readiness = getCriticalCareIcuScenarioReadiness(scenarioId, envelope)
  const scenario = getIcuScenario(scenarioId)
  const recommendationScenario = getIcuScenario(recommendation.scenarioId)

  return (
    <div className={styles.capstoneActivityRoute} data-icu-capstone-active="practice">
      <section className={styles.capstonePreparation} aria-labelledby="practice-preparation-title">
        <div className={styles.capstonePreparationHeader}>
          <div>
            <span className={styles.panelKicker}>Pathway-informed recommendation</span>
            <h2 id="practice-preparation-title">
              {requested ? `Preparation for ${scenario.shortTitle}` : recommendationScenario.title}
            </h2>
            <p>
              {requested
                ? 'This course was selected directly. The focused activities below are preparation suggestions, not a Practice gate.'
                : recommendation.reason === 'foundation'
                  ? 'This broad multiorgan course is the starting recommendation until focused-module completion provides a stronger match.'
                  : recommendation.reason === 'assess-ready'
                    ? 'Your completed focused activities align with this course and satisfy its assessment preparation groups.'
                    : 'Your completed focused activities most closely align with this integrated course.'}
            </p>
          </div>
          <div className={styles.readinessMeter}>
            <strong>{readiness.percentReady}%</strong>
            <span>
              {readiness.gateStatus === 'preview-open'
                ? 'advisory preparation'
                : 'released preparation'}
            </span>
          </div>
        </div>

        <div className={styles.practiceOpenNote} role="note">
          <Stethoscope aria-hidden="true" />
          <p>
            <strong>Practice remains open to experienced learners.</strong> Missing preparation is
            advisory; start the synthetic course now or use a direct refresher first.
          </p>
        </div>

        {readiness.gateStatus === 'preview-open' ? (
          <p className={styles.previewAccessNote} role="note">
            Preview access: these preparation groups are still in clinical review, so they inform
            the recommendation but do not hard-lock Practice or Assess.
          </p>
        ) : null}

        {loadFailed ? (
          <p className={styles.progressWarning} role="note">
            Compatible local progress could not be read. Practice is still available and no saved
            data was changed.
          </p>
        ) : null}

        <IcuRemediationLinks readiness={readiness} onlyIncomplete />

        {requested && requested !== recommendation.scenarioId ? (
          <Link
            className={styles.recommendedScenarioLink}
            href={`/icu-simulation/practice?case=${recommendation.scenarioId}` as Route}
          >
            Open recommended course: {recommendationScenario.shortTitle}
            <ArrowRight aria-hidden="true" />
          </Link>
        ) : null}
      </section>

      <div className={styles.capstoneActivityStage}>
        <IntegratedSimulatorLaunchGate>
          <IcuSimulatorLab
            mode="practice"
            locale={locale}
            initialScenarioId={scenarioId}
            embedded
          />
        </IntegratedSimulatorLaunchGate>
      </div>
    </div>
  )
}

function AssessmentGate({
  envelope,
  requestedScenarioId,
  loadFailed,
}: {
  readonly envelope: CriticalCareProgressEnvelope
  readonly requestedScenarioId?: string
  readonly loadFailed: boolean
}) {
  const requested = isIcuScenarioFamily(requestedScenarioId) ? requestedScenarioId : undefined
  const requestedReadiness = requested
    ? getCriticalCareIcuScenarioReadiness(requested, envelope)
    : null
  const hasAnyApprovedGate = icuScenarioFamilies.some(
    (scenarioId) =>
      getCriticalCareIcuScenarioReadiness(scenarioId, envelope).approvedGateRequirementCount > 0,
  )

  return (
    <main className={styles.capstoneGate}>
      <header className={styles.assessmentGateHeader}>
        <Link href={'/icu-simulation' as Route} className={styles.backLink}>
          ICU Simulator home
        </Link>
        <span className={styles.panelKicker}>Verified capstone entry</span>
        <h1>Assessment preparation</h1>
        <p>
          Each masked course lists focused preparation used by its longitudinal decisions. Only
          released, competency-eligible activities can create a hard prerequisite; preparation still
          in clinical review is labeled Preview and remains advisory.
        </p>
      </header>

      <div className={styles.assessmentSafety} role="note">
        <ShieldAlert aria-hidden="true" />
        <p>
          For clinician education and simulation only. These prerequisites organize synthetic
          learning activities; they are not patient-specific treatment recommendations.
        </p>
      </div>

      {loadFailed ? (
        <p className={styles.progressWarning} role="alert">
          Compatible local progress could not be verified. Your saved data was not overwritten.
          {hasAnyApprovedGate
            ? ' Courses with released prerequisites remain locked; Preview courses and Practice remain available.'
            : ' No released preparation gate is active, so Preview courses and Practice remain available.'}
        </p>
      ) : requestedReadiness && !requestedReadiness.eligibleForAssess ? (
        <section className={styles.selectedAssessmentGate} aria-labelledby="selected-gate-title">
          <LockKeyhole aria-hidden="true" />
          <div>
            <h2 id="selected-gate-title">
              {assessmentCaseLabel(requestedReadiness.scenarioId)} needs more preparation
            </h2>
            <p>
              {requestedReadiness.satisfiedApprovedGateRequirementCount} of{' '}
              {requestedReadiness.approvedGateRequirementCount} released prerequisite groups
              complete. The missing groups and direct refreshers are shown below.
            </p>
            <IcuRemediationLinks readiness={requestedReadiness} onlyIncomplete />
          </div>
        </section>
      ) : null}

      <section className={styles.assessmentCaseList} aria-labelledby="assessment-case-list-title">
        <h2 id="assessment-case-list-title">Masked assessment courses</h2>
        <div>
          {icuScenarioFamilies.map((scenarioId) => {
            const readiness = getCriticalCareIcuScenarioReadiness(scenarioId, envelope)
            const label = assessmentCaseLabel(scenarioId)
            return (
              <article key={scenarioId} data-ready={readiness.eligibleForAssess || undefined}>
                <header>
                  <div>
                    <span>{label}</span>
                    <strong>
                      {readiness.gateStatus === 'preview-open'
                        ? `${readiness.completedRequirementCount}/${readiness.totalRequirementCount} advisory preparation groups complete · Preview`
                        : `${readiness.satisfiedApprovedGateRequirementCount}/${readiness.approvedGateRequirementCount} released prerequisite groups complete`}
                    </strong>
                  </div>
                  {readiness.eligibleForAssess ? (
                    <CheckCircle2 aria-label="Assessment unlocked" />
                  ) : (
                    <LockKeyhole aria-label="Assessment locked" />
                  )}
                </header>

                {readiness.eligibleForAssess ? (
                  <Link href={`/icu-simulation/assess?case=${scenarioId}` as Route}>
                    Start {label}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                ) : (
                  <details>
                    <summary>Why this course is locked</summary>
                    <IcuRemediationLinks readiness={readiness} onlyIncomplete />
                  </details>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <Link className={styles.practiceFallbackLink} href={'/icu-simulation/practice' as Route}>
        Open unrestricted Practice
        <ArrowRight aria-hidden="true" />
      </Link>
    </main>
  )
}

export function IcuCapstoneEntry({
  mode,
  locale = 'en',
  requestedScenarioId,
}: IcuCapstoneEntryProps) {
  const [progressState, setProgressState] = useState<ProgressState>({
    status: 'loading',
    envelope: emptyProgress,
    loadFailed: false,
  })

  useEffect(() => {
    let active = true
    void import('@/features/critical-care/progress')
      .then(({ readMergedCriticalCareProgress }) => {
        if (!active) return
        const result = readMergedCriticalCareProgress()
        setProgressState({ status: 'ready', envelope: result.envelope, loadFailed: false })
      })
      .catch(() => {
        if (!active) return
        setProgressState({ status: 'ready', envelope: emptyProgress, loadFailed: true })
      })
    return () => {
      active = false
    }
  }, [])

  const eligibleAssessmentScenarioIds = useMemo(
    () => getCriticalCareEligibleIcuAssessmentScenarioIds(progressState.envelope),
    [progressState.envelope],
  )
  const requested = isIcuScenarioFamily(requestedScenarioId) ? requestedScenarioId : undefined
  const requestedReadiness = requested
    ? getCriticalCareIcuScenarioReadiness(requested, progressState.envelope)
    : null

  if (progressState.status === 'loading') return <ProgressLoading mode={mode} />

  if (mode === 'practice') {
    return (
      <PracticeEntry
        envelope={progressState.envelope}
        locale={locale}
        requestedScenarioId={requestedScenarioId}
        loadFailed={progressState.loadFailed}
      />
    )
  }

  if (requested && eligibleAssessmentScenarioIds.includes(requested)) {
    return (
      <div className={styles.capstoneActivityRoute} data-icu-capstone-active="assess">
        <section className={styles.assessmentVerified} role="status">
          <CheckCircle2 aria-hidden="true" />
          <p>
            <strong>
              {assessmentCaseLabel(requested)}{' '}
              {requestedReadiness?.gateStatus === 'preview-open'
                ? 'opened in Preview.'
                : 'unlocked.'}
            </strong>{' '}
            {requestedReadiness?.gateStatus === 'preview-open'
              ? 'Preparation activities are still under clinical review and are advisory, not a hard lock.'
              : 'Released prerequisites were verified for this session.'}{' '}
            Coaching remains withheld until debrief.
          </p>
        </section>
        <div className={styles.capstoneActivityStage}>
          <IntegratedSimulatorLaunchGate>
            <IcuSimulatorLab
              mode="assess"
              locale={locale}
              initialScenarioId={requested}
              availableScenarioIds={[requested]}
              embedded
            />
          </IntegratedSimulatorLaunchGate>
        </div>
      </div>
    )
  }

  return (
    <AssessmentGate
      envelope={progressState.envelope}
      requestedScenarioId={requestedScenarioId}
      loadFailed={progressState.loadFailed}
    />
  )
}

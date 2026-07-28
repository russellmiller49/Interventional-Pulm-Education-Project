'use client'

import { useEffect, useState } from 'react'
import type { Route } from 'next'
import { ArrowLeft, ArrowRight, BadgeCheck, BookOpenCheck, ClipboardCheck } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import type { CriticalCareActivityMode } from '@/features/learning-module/activity'

import {
  mechanicalVentilationCasesByStation,
  ventilationStations,
  ventilatorDeviceProfiles,
} from '../content'
import {
  createDefaultProgress,
  hasCaseMastery,
  readProgress,
  setLastDevice,
  writeProgress,
  type MechanicalVentilationProgressV2,
  type VentilatorDeviceId,
} from '../engine'

type PracticeSetupStep = 'device' | 'support' | 'case'
type PracticeSupportMode = Extract<CriticalCareActivityMode, 'guided' | 'practice'>

function progressLabel(progress: MechanicalVentilationProgressV2, caseId: string): string {
  if (hasCaseMastery(progress, caseId) || progress.completedCases.includes(caseId))
    return 'Worked through'
  return 'Not started'
}

export function MechanicalVentilationPracticeSetupV2({
  compatibilityNotice,
}: {
  readonly compatibilityNotice?: string
}) {
  const [step, setStep] = useState<PracticeSetupStep>('device')
  const [deviceId, setDeviceId] = useState<VentilatorDeviceId>('hamilton-c6')
  const [supportMode, setSupportMode] = useState<PracticeSupportMode>('guided')
  const [progress, setProgress] = useState<MechanicalVentilationProgressV2>(createDefaultProgress)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readProgress()
      setProgress(stored)
      setDeviceId(stored.lastDeviceId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  function confirmDevice() {
    const next = setLastDevice(progress, deviceId)
    setProgress(next)
    writeProgress(next)
    setStep('support')
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-7 px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Practice setup ·{' '}
          {step === 'device' ? 'console' : step === 'support' ? 'guidance' : 'case'}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {step === 'device'
            ? 'Choose one training console.'
            : step === 'support'
              ? 'Choose the amount of guidance.'
              : 'Choose one clean case.'}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          {step === 'device'
            ? 'Your choice becomes the preferred console and stays fixed until you exit the case.'
            : step === 'support'
              ? 'Guided reveals the teaching targets. Practice lets you record an initial frame while keeping all controls available.'
              : 'All fifteen source cases remain available. The live workspace opens only after this final setup choice.'}
        </p>
      </header>

      {compatibilityNotice ? (
        <div
          className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
          role="status"
        >
          <strong>Safe setup restart.</strong> {compatibilityNotice}
        </div>
      ) : null}

      {step === 'device' ? (
        <section aria-labelledby="practice-device-heading">
          <h2 id="practice-device-heading" className="sr-only">
            Training console
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {ventilatorDeviceProfiles.map((profile) => (
              <button
                type="button"
                key={profile.id}
                aria-pressed={deviceId === profile.id}
                className="min-h-32 rounded-2xl border bg-card p-5 text-left shadow-sm aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/30"
                onClick={() => setDeviceId(profile.id)}
              >
                <span className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
                  {profile.manufacturer}
                </span>
                <strong className="mt-2 block text-lg">{profile.displayName}</strong>
                <small className="mt-2 block leading-5 text-muted-foreground">
                  {profile.softwareVersion} · {profile.patientGroup} · educational facsimile
                </small>
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              onClick={confirmDevice}
            >
              Save console and continue <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      {step === 'support' ? (
        <section aria-labelledby="practice-support-heading">
          <h2 id="practice-support-heading" className="sr-only">
            Learning support
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              aria-pressed={supportMode === 'guided'}
              className="rounded-2xl border bg-card p-6 text-left shadow-sm aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/30"
              onClick={() => setSupportMode('guided')}
            >
              <BookOpenCheck className="size-6 text-primary" aria-hidden="true" />
              <strong className="mt-3 block text-xl">Guided</strong>
              <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                Teaching targets, mechanism framing, and freely available hints. The underlying case
                model is unchanged, while support remains visible as you work.
              </span>
            </button>
            <button
              type="button"
              aria-pressed={supportMode === 'practice'}
              className="rounded-2xl border bg-card p-6 text-left shadow-sm aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/30"
              onClick={() => setSupportMode('practice')}
            >
              <ClipboardCheck className="size-6 text-primary" aria-hidden="true" />
              <strong className="mt-3 block text-xl">Practice</strong>
              <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                Commit a mechanism, safety priority, and expected response before acting, then
                examine the modeled consequence and causal debrief.
              </span>
            </button>
          </div>
          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold"
              onClick={() => setStep('device')}
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Back to console
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              onClick={() => setStep('case')}
            >
              Continue to cases <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      {step === 'case' ? (
        <section className="grid gap-6" aria-labelledby="practice-case-heading">
          <h2 id="practice-case-heading" className="sr-only">
            Practice cases
          </h2>
          {ventilationStations.map((station, stationIndex) => (
            <section key={station.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
                    Station {stationIndex + 1}
                  </span>
                  <h3 className="mt-1 text-xl font-bold">{station.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{station.description}</p>
                </div>
                <span className="rounded-full border px-3 py-1 text-xs">
                  {supportMode === 'guided' ? 'Guided' : 'Practice'} ·{' '}
                  {ventilatorDeviceProfiles.find((profile) => profile.id === deviceId)?.shortName}
                </span>
              </div>
              <ol className="mt-4 grid gap-3 lg:grid-cols-3">
                {mechanicalVentilationCasesByStation[station.id].map((caseDefinition) => (
                  <li key={caseDefinition.id} className="flex flex-col rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-sm text-primary">{caseDefinition.id}</strong>
                      {hasCaseMastery(progress, caseDefinition.id) ||
                      progress.completedCases.includes(caseDefinition.id) ? (
                        <BadgeCheck
                          className="size-4 text-emerald-600"
                          aria-label="Worked through"
                        />
                      ) : null}
                    </div>
                    <span className="mt-2 flex-1 text-sm font-semibold leading-5">
                      {caseDefinition.title}
                    </span>
                    <small className="mt-2 text-muted-foreground">
                      {progressLabel(progress, caseDefinition.id)}
                    </small>
                    <Link
                      href={
                        `/mechanical-ventilation/practice?case=${caseDefinition.id}&device=${deviceId}&mode=${supportMode}` as Route
                      }
                      className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                    >
                      Start {supportMode === 'guided' ? 'guided case' : 'practice run'}
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <button
            type="button"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold"
            onClick={() => setStep('support')}
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to support
          </button>
        </section>
      ) : null}
    </main>
  )
}

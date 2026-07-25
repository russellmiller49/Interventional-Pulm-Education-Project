'use client'

import { useEffect, useState } from 'react'
import type { Route } from 'next'
import { ArrowRight, GitCompareArrows, ShieldCheck } from 'lucide-react'

import { useRouter } from '@/i18n/navigation'

import { MECHANICAL_VENTILATION_ASSESSMENT_ID, ventilatorDeviceProfiles } from '../content'
import { readProgress, setLastDevice, writeProgress, type VentilatorDeviceId } from '../engine'

export function MechanicalVentilationAssessSetupV2({
  compatibilityNotice,
}: {
  readonly compatibilityNotice?: string
}) {
  const router = useRouter()
  const [deviceId, setDeviceId] = useState<VentilatorDeviceId>('hamilton-c6')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDeviceId(readProgress().lastDeviceId), 0)
    return () => window.clearTimeout(timer)
  }, [])

  function launchAssessment() {
    const progress = readProgress()
    writeProgress(setLastDevice(progress, deviceId))
    const attempts = Object.values(progress.attemptsByDeviceCase).reduce(
      (total, count) => total + count,
      0,
    )
    const seed = `${Date.now().toString(36)}-${attempts + 1}`
    router.push(
      `/mechanical-ventilation/assess?case=${MECHANICAL_VENTILATION_ASSESSMENT_ID}&seed=${seed}&device=${deviceId}` as Route,
    )
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-7 px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Challenge setup · locally varied
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Choose the console before the case opens.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          A local variation selects one of the fifteen cases. You will see the patient context, case
          identity, references, and evidence from the start; teaching feedback is collected for the
          debrief so you can reason without interruption.
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

      {!ready ? (
        <section aria-labelledby="assess-device-heading">
          <h2 id="assess-device-heading" className="text-xl font-bold">
            Training console
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This console stays fixed for the challenge. Exiting and changing it creates a clean new
            run.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {ventilatorDeviceProfiles.map((profile) => (
              <button
                type="button"
                key={profile.id}
                aria-pressed={deviceId === profile.id}
                className="rounded-2xl border bg-card p-5 text-left shadow-sm aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/30"
                onClick={() => setDeviceId(profile.id)}
              >
                <span className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
                  {profile.manufacturer}
                </span>
                <strong className="mt-2 block text-lg">{profile.displayName}</strong>
                <small className="mt-2 block text-muted-foreground">
                  {profile.softwareVersion} · educational facsimile
                </small>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            onClick={() => setReady(true)}
          >
            Keep this console <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </section>
      ) : (
        <section
          className="rounded-3xl border bg-card p-6 shadow-sm lg:p-8"
          aria-labelledby="challenge-boundary-heading"
        >
          <div className="flex items-start gap-4">
            <GitCompareArrows className="mt-1 size-7 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 id="challenge-boundary-heading" className="text-2xl font-bold">
                Challenge ready
              </h2>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
                <li>
                  You can record an initial frame before acting, but all therapy controls remain
                  available.
                </li>
                <li>The challenge timer behavior is enabled and coaching is deferred.</li>
                <li>
                  Patient context, case identity, references, and source boundaries stay visible.
                </li>
                <li>The end state is a causal debrief and an explicit transfer check.</li>
              </ul>
              <div className="mt-5 flex items-center gap-2 rounded-xl bg-muted/40 p-3 text-sm">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                Synthetic educational case. No patient-specific guidance is provided.
              </div>
              <button
                type="button"
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                onClick={launchAssessment}
              >
                Open challenge <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

'use client'

import { useState } from 'react'

import { surveillancePlanColumns } from '../../content/clinicalDecisionFramework'

export type SurveillancePlanMode = 'device' | 'no-device'

const examplePlans: Readonly<Record<SurveillancePlanMode, readonly string[]>> = {
  device: [
    'Loss of patency, secretion burden, migration, tissue response, branch compromise, or a change in the ongoing indication',
    'New or worsening symptoms, secretion change, imaging change, planned clinical review, or bronchoscopic concern',
    'Evaluate airway patency and the device-disease interface; restore patency or treat infection when indicated',
    'Reassess fit, position, treatment trajectory, ongoing benefit, and exchange or removal options',
  ],
  'no-device': [
    'Recurrent obstruction, new instability, or loss of the initial clinical benefit',
    'New or worsening symptoms, imaging change, or a change in the treatment trajectory',
    'Reassess morphology, distal-airway patency, viable lung, attributable symptoms, and goals',
    'Continue without a device unless a new residual structural job and expected downstream benefit are demonstrated',
  ],
}

export function SurveillancePlanBuilder({
  completed = false,
  mode = 'device',
  onComplete,
}: {
  completed?: boolean
  mode?: SurveillancePlanMode
  onComplete?: () => void
}) {
  const [confirmedColumns, setConfirmedColumns] = useState<string[]>(
    completed ? [...surveillancePlanColumns] : [],
  )
  const [committed, setCommitted] = useState(completed)

  return (
    <section
      className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
      aria-labelledby="surveillance-plan-title"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-200">
        Surveillance and exit
      </p>
      <h3 id="surveillance-plan-title" className="mt-2 text-2xl font-bold tracking-tight">
        {mode === 'no-device'
          ? 'Prescribe reassessment and the conditions for reconsidering a stent'
          : 'Prescribe follow-up with the stent plan'}
      </h3>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
        {mode === 'no-device'
          ? 'Define what recurrence would look like, how it will be recognized, and which new finding would justify reopening the device decision.'
          : 'Define what failure might look like, how it will be recognized, how patency will be restored, and when the device should be revised, exchanged, or removed.'}
      </p>

      <div className="mt-5 overflow-hidden rounded-2xl border">
        <div className="grid md:grid-cols-4">
          {surveillancePlanColumns.map((column, index) => {
            const confirmed = confirmedColumns.includes(column)
            return (
              <label
                key={column}
                className="cursor-pointer border-b p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
              >
                <span className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={() =>
                      setConfirmedColumns((current) =>
                        confirmed
                          ? current.filter((item) => item !== column)
                          : [...current, column],
                      )
                    }
                    className="mt-0.5 accent-indigo-600"
                  />
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-[0.1em]">
                      {column}
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                      {examplePlans[mode][index]}
                    </span>
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-muted-foreground" role="note">
        {mode === 'no-device'
          ? 'A no-device plan follows the treated disease, symptoms, distal function, and overall treatment trajectory. It does not create a device-surveillance obligation.'
          : 'Context-specific evidence: the malignant-airway-stenting WABIP guideline suggests surveillance bronchoscopy even without symptoms and, when stronger evidence is absent, suggests an initial examination at approximately 4–6 weeks. This conditional guidance is not a universal schedule for every benign and malignant case.'}
      </p>
      <button
        type="button"
        onClick={() => {
          if (completed || committed) return
          setCommitted(true)
          onComplete?.()
        }}
        disabled={
          confirmedColumns.length !== surveillancePlanColumns.length || completed || committed
        }
        className="mt-4 min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {completed || committed ? 'Surveillance plan committed' : 'Commit surveillance plan'}
      </button>
    </section>
  )
}

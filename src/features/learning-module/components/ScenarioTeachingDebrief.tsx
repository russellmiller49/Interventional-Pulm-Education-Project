'use client'

import type { Route } from 'next'
import { useId, useState } from 'react'
import { ArrowRight, BookOpen, GitCompareArrows } from 'lucide-react'

import { criticalCareConceptById } from '@/features/critical-care/content/concepts'
import type {
  ScenarioDecisionTraceEntry,
  ScenarioExpertTraceStep,
  ScenarioFeedbackEvent,
} from '@/features/learning-module/scenarioFeedback'
import { Link } from '@/i18n/navigation'

import { ScenarioFeedbackCard } from './ScenarioFeedbackCard'

export interface ScenarioTeachingDebriefProps {
  readonly scenarioTitle: string
  readonly decisionTrace: readonly ScenarioDecisionTraceEntry[]
  readonly expertTrace: readonly ScenarioExpertTraceStep[]
  readonly feedbackEvents: readonly ScenarioFeedbackEvent[]
  readonly conceptIds: readonly string[]
  readonly evidence: readonly {
    readonly id: string
    readonly title: string
    readonly citation: string
  }[]
  readonly onContinue: () => void
}

const divergenceOptions = [
  'The initial frame',
  'Which cue I trusted',
  'How I localized the problem',
  'When I committed to an action',
  'How I reassessed the response',
] as const

export function ScenarioTeachingDebrief({
  scenarioTitle,
  decisionTrace,
  expertTrace,
  feedbackEvents,
  conceptIds,
  evidence,
  onContinue,
}: ScenarioTeachingDebriefProps) {
  const headingId = useId()
  const frameId = useId()
  const [frameDraft, setFrameDraft] = useState('')
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null)
  const [divergence, setDivergence] = useState<string | null>(null)

  if (capturedFrame === null) {
    return (
      <section className="mx-auto grid max-w-3xl gap-5 p-5 sm:p-7" aria-labelledby={headingId}>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-300">
            Debrief · frame capture
          </p>
          <h2 id={headingId} className="mt-2 text-2xl font-bold text-white">
            Before we look at what happened—what did you think was going on?
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Articulate the model you were using in {scenarioTitle}. This note stays in this browser
            session and is never written to learning history.
          </p>
        </div>
        <label htmlFor={frameId} className="grid gap-2 text-sm font-bold text-white">
          My working frame
          <textarea
            id={frameId}
            rows={6}
            value={frameDraft}
            onChange={(event) => setFrameDraft(event.target.value)}
            className="rounded-xl border border-white/20 bg-slate-950/70 p-3 font-normal text-white"
          />
        </label>
        <button
          type="button"
          disabled={frameDraft.trim().length === 0}
          onClick={() => setCapturedFrame(frameDraft.trim())}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-300 px-4 text-sm font-bold text-slate-950 disabled:opacity-50"
        >
          Capture this frame and reveal the trace
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </section>
    )
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-8 p-5 sm:p-7" aria-labelledby={headingId}>
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-300">
          Teaching debrief
        </p>
        <h2 id={headingId} className="mt-2 text-2xl font-bold text-white">
          Reconstruct the reasoning
        </h2>
        <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Your captured frame
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-100">
            {capturedFrame}
          </p>
        </div>
      </header>

      <section aria-labelledby="decision-trace-heading">
        <h3 id="decision-trace-heading" className="text-xl font-bold text-white">
          1. Decision trace
        </h3>
        <ol className="mt-4 grid gap-3">
          {decisionTrace.map((entry) => (
            <li
              key={entry.id}
              className="grid gap-2 rounded-2xl border border-white/15 p-4 sm:grid-cols-[7rem_1fr]"
            >
              <p className="font-mono text-xs text-sky-200">
                Model +{entry.timeSeconds.toFixed(1)} s
              </p>
              <div>
                <p className="font-bold text-white">{entry.action}</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">{entry.systemState}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="expert-contrast-heading">
        <h3
          id="expert-contrast-heading"
          className="flex items-center gap-2 text-xl font-bold text-white"
        >
          <GitCompareArrows className="size-5 text-sky-300" aria-hidden="true" />
          2. Expert reasoning contrast
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          This is an authored example of cue use and commitment timing, not the only acceptable
          path.
        </p>
        <ol className="mt-4 grid gap-4 lg:grid-cols-3">
          {expertTrace.map((step) => (
            <li key={step.id} className="rounded-2xl border border-sky-300/25 bg-sky-950/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-sky-300">
                {step.moment}
              </p>
              <p className="mt-3 text-sm text-slate-200">
                <strong className="text-white">Cue:</strong> {step.cue}
              </p>
              <p className="mt-2 text-sm text-slate-200">
                <strong className="text-white">Read:</strong> {step.reasoning}
              </p>
              <p className="mt-2 text-sm text-slate-200">
                <strong className="text-white">Commitment:</strong> {step.commitment}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {feedbackEvents.length > 0 ? (
        <section aria-labelledby="action-feedback-heading">
          <h3 id="action-feedback-heading" className="text-xl font-bold text-white">
            3. Action feedback
          </h3>
          <div className="mt-4 grid gap-4">
            {feedbackEvents.map((event) => (
              <ScenarioFeedbackCard key={event.id} event={event} headingLevel={4} />
            ))}
          </div>
        </section>
      ) : null}

      <fieldset className="rounded-2xl border border-white/15 p-5">
        <legend className="px-2 text-xl font-bold text-white">
          4. Where did your path diverge?
        </legend>
        <p className="mt-1 text-sm text-slate-300">
          Choose the point that would be most useful to revisit. The selection only shapes the
          concept links below.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {divergenceOptions.map((option) => (
            <label
              key={option}
              className="flex min-h-11 items-center gap-3 rounded-xl border border-white/15 p-3 text-sm text-slate-100"
            >
              <input
                type="radio"
                name="scenario-divergence"
                checked={divergence === option}
                onChange={() => setDivergence(option)}
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>

      {divergence ? (
        <section
          className="rounded-2xl border border-sky-300/25 bg-sky-950/20 p-5"
          aria-labelledby="concept-links-heading"
        >
          <h3
            id="concept-links-heading"
            className="flex items-center gap-2 text-xl font-bold text-white"
          >
            <BookOpen className="size-5 text-sky-300" aria-hidden="true" />
            5. Concepts for this divergence point
          </h3>
          <p className="mt-2 text-sm text-slate-300">
            You chose “{divergence}.” Use one focused explanation now or continue to the transfer
            variant.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {conceptIds.flatMap((conceptId) => {
              const concept = criticalCareConceptById.get(conceptId)
              return concept
                ? [
                    <Link
                      key={concept.id}
                      href={`/critical-care/concepts/${concept.id}` as Route}
                      className="inline-flex min-h-10 items-center rounded-full border border-sky-300/30 bg-sky-300/10 px-4 text-sm font-semibold text-sky-100"
                    >
                      {concept.title}
                    </Link>,
                  ]
                : []
            })}
          </div>
          <details className="mt-5 rounded-xl border border-white/15 p-4 text-sm text-slate-200">
            <summary className="min-h-10 cursor-pointer font-bold text-white">
              Sources and model boundary
            </summary>
            <ul className="mt-3 grid gap-3">
              {evidence.map((source) => (
                <li key={source.id}>
                  <strong className="text-white">{source.title}</strong>
                  <span className="block text-xs leading-5 text-slate-400">{source.citation}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-5 text-slate-400">
              Educational simulation only. Model responses simplify physiology and do not provide
              patient-specific diagnosis, treatment, or device instructions.
            </p>
          </details>
          <button
            type="button"
            onClick={onContinue}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-300 px-4 text-sm font-bold text-slate-950"
          >
            Continue to the signal-transfer variant
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </section>
      ) : null}
    </section>
  )
}

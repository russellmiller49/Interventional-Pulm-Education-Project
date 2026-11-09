'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { betaModules, feedbackReviewModuleById } from './catalog'
import {
  accuracyOptions,
  confidenceOptions,
  consistencyOptions,
  coverageOptions,
  describeReviewer,
  experienceOptions,
  labelFor,
  levelOptions,
  likelihoodOptions,
  promptVerdictOptions,
  qualityOptions,
  readinessOptions,
  type EducatorAnswers,
  type LearnerAnswers,
  type StoredReview,
} from './reviewSchema'
import { reviewsCsv, summarizeReviews, type ModuleReviewSummary } from './reviewSummary'

const fixed = (value: number | null) => (value === null ? '–' : value.toFixed(1))
const titleOf = (id: string) => feedbackReviewModuleById(id)?.title ?? id

function SummaryTable({ summaries }: { summaries: ModuleReviewSummary[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[56rem] text-sm" data-review-summary>
        <caption className="sr-only">Overall reviews by module</caption>
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="p-3">
              Module
            </th>
            <th scope="col" className="p-3">
              Reviews (learners / educators)
            </th>
            <th scope="col" className="p-3">
              Overall, median (mean)
            </th>
            <th scope="col" className="p-3">
              Clarity
            </th>
            <th scope="col" className="p-3">
              Ease of use
            </th>
            <th scope="col" className="p-3">
              Interactive
            </th>
            <th scope="col" className="p-3">
              Accuracy (educators)
            </th>
            <th scope="col" className="p-3">
              Confidence, before → now (learners)
            </th>
            <th scope="col" className="p-3">
              Ready now / minor fixes / major changes / not ready
            </th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => (
            <tr key={summary.moduleId} className="border-t" data-summary-module={summary.moduleId}>
              <th scope="row" className="p-3 text-left font-medium">
                {titleOf(summary.moduleId)}
              </th>
              <td className="p-3">
                {summary.total} ({summary.learners} / {summary.educators})
              </td>
              <td className="p-3">
                {fixed(summary.medianOverall)} ({fixed(summary.means.overall)})
              </td>
              <td className="p-3">{fixed(summary.means.clarity)}</td>
              <td className="p-3">{fixed(summary.means.easeOfUse)}</td>
              <td className="p-3">{fixed(summary.means.interactive)}</td>
              <td className="p-3">{fixed(summary.means.accuracy)}</td>
              <td className="p-3">
                {summary.confidence.n
                  ? `${fixed(summary.confidence.before)} → ${fixed(summary.confidence.now)}`
                  : '–'}
              </td>
              <td className="p-3" data-summary-readiness>
                {readinessOptions.map((option) => summary.readiness[option.value]).join(' / ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t p-3 text-xs text-muted-foreground">
        Ratings run from 1 (poor) to 5 (excellent); confidence from 1 (not confident) to 5 (very
        confident).
      </p>
    </div>
  )
}

function PromptTable({ summary }: { summary: ModuleReviewSummary }) {
  if (!summary.prompts.length) return null
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[40rem] text-sm" data-review-prompts>
        <caption className="p-3 text-left font-semibold">
          {titleOf(summary.moduleId)}: the module’s own questions (educators)
        </caption>
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="p-3">
              Question
            </th>
            {promptVerdictOptions.map((option) => (
              <th key={option.value} scope="col" className="p-3">
                {option.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summary.prompts.map((row) => (
            <tr key={row.prompt} className="border-t">
              <th scope="row" className="p-3 text-left font-normal">
                {row.prompt}
              </th>
              <td className="p-3">{row.looksRight}</td>
              <td className="p-3">{row.needsChanges}</td>
              <td className="p-3">{row.notReached}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Answer({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline font-medium">{label}: </dt>
      <dd className="inline text-muted-foreground">{value}</dd>
    </div>
  )
}

function ReviewCard({
  review,
  reports,
  onShowReports,
}: {
  review: StoredReview
  reports: number
  onShowReports: () => void
}) {
  const answers = review.answers
  const learner = review.track === 'learner' ? (answers as LearnerAnswers) : null
  const educator = review.track === 'educator' ? (answers as EducatorAnswers) : null
  const reviewer = describeReviewer(review.profile_snapshot)
  return (
    <article className="space-y-4 rounded-2xl border bg-card p-5 md:p-6" data-review-card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{titleOf(review.module_id)}</h3>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {reviewer ? <strong className="text-foreground">{reviewer}</strong> : null}
            {reviewer ? ' · ' : ''}
            {review.tester_email} · {new Date(review.updated_at).toLocaleString()}
          </p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-semibold">
          {review.track === 'learner' ? 'As a learner' : 'As an educator'} ·{' '}
          {labelFor(readinessOptions, answers.readiness)}
        </span>
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
        <Answer label="Went through" value={labelFor(coverageOptions, answers.coverage)} />
        <Answer label="Experience before" value={labelFor(experienceOptions, answers.experience)} />
        <Answer label="Overall" value={labelFor(qualityOptions, answers.overall)} />
        <Answer label="Clarity" value={labelFor(qualityOptions, answers.clarity)} />
        <Answer label="Ease of use" value={labelFor(qualityOptions, answers.easeOfUse)} />
        <Answer label="Interactive parts" value={labelFor(qualityOptions, answers.interactive)} />
        <Answer label="Level" value={labelFor(levelOptions, answers.level)} />
        {learner && (
          <>
            <Answer
              label="Confidence"
              value={`${labelFor(confidenceOptions, learner.confidenceBefore)} → ${labelFor(confidenceOptions, learner.confidenceNow)}`}
            />
            <Answer label="Would use it" value={labelFor(likelihoodOptions, learner.wouldUse)} />
          </>
        )}
        {educator && (
          <>
            <Answer label="Accuracy" value={labelFor(accuracyOptions, educator.accuracy)} />
            <Answer
              label="Consistent with their practice"
              value={labelFor(consistencyOptions, educator.consistent)}
            />
            <Answer
              label="Would assign it"
              value={labelFor(likelihoodOptions, educator.wouldAssign)}
            />
          </>
        )}
      </dl>
      {educator && educator.prompts.length > 0 && (
        <ul className="space-y-1 text-sm">
          {educator.prompts.map(({ prompt, verdict }) => (
            <li key={prompt}>
              <span className="font-medium">{labelFor(promptVerdictOptions, verdict)}:</span>{' '}
              <span className="text-muted-foreground">{prompt}</span>
            </li>
          ))}
        </ul>
      )}
      {answers.workedBest && (
        <div className="text-sm">
          <p className="font-medium">What worked best</p>
          <p className="whitespace-pre-wrap break-words leading-7">{answers.workedBest}</p>
        </div>
      )}
      {answers.oneFix && (
        <div className="text-sm">
          <p className="font-medium">The one thing to fix</p>
          <p className="whitespace-pre-wrap break-words leading-7">{answers.oneFix}</p>
        </div>
      )}
      {review.user_id && reports > 0 ? (
        <Button variant="outline" size="sm" onClick={onShowReports}>
          {reports === 1
            ? 'Their 1 detailed report on this module'
            : `Their ${reports} detailed reports on this module`}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">No detailed reports on this module.</p>
      )}
    </article>
  )
}

/** The workspace's Overall reviews tab: a summary per module, then each review. */
export function OverallReviewsPanel({
  onShowReports,
}: {
  onShowReports: (user: { id: string; label: string }, moduleId: string) => void
}) {
  const [moduleId, setModuleId] = useState('')
  const [track, setTrack] = useState('')
  const [reviews, setReviews] = useState<StoredReview[]>([])
  const [reportCounts, setReportCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++generation.current
    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        `/api/module-review?${new URLSearchParams({ module: moduleId, track })}`,
        { cache: 'no-store' },
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Overall reviews could not be loaded.')
      if (current !== generation.current) return
      setReviews(result.reviews)
      setReportCounts(result.reportCounts ?? {})
    } catch (err) {
      if (current === generation.current)
        setError(err instanceof Error ? err.message : 'Overall reviews could not be loaded.')
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }, [moduleId, track])
  useEffect(() => {
    void refresh()
  }, [refresh])
  const summaries = useMemo(() => summarizeReviews(reviews), [reviews])
  function exportCsv() {
    const blob = new Blob([reviewsCsv(reviews, reportCounts)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `overall-reviews${moduleId ? `-${moduleId}` : ''}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }
  return (
    <section className="space-y-6" aria-label="Overall reviews" data-overall-reviews>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/20 p-4">
        <label className="min-w-0 max-w-full text-sm font-medium">
          Module
          <select
            aria-label="Module"
            value={moduleId}
            onChange={(event) => setModuleId(event.target.value)}
            className="mt-1 block w-full max-w-full rounded-lg border bg-background p-2"
          >
            <option value="">All modules</option>
            {betaModules.map((entry) => (
              <option value={entry.id} key={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 max-w-full text-sm font-medium">
          Reviewer
          <select
            aria-label="Reviewer"
            value={track}
            onChange={(event) => setTrack(event.target.value)}
            className="mt-1 block rounded-lg border bg-background p-2"
          >
            <option value="">Learners and educators</option>
            <option value="learner">Learners</option>
            <option value="educator">Educators</option>
          </select>
        </label>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          Refresh
        </Button>
        <Button variant="outline" onClick={exportCsv} disabled={loading || reviews.length === 0}>
          Export CSV
        </Button>
      </div>
      {error ? (
        <p role="alert" className="rounded-xl border p-5 text-destructive">
          {error}
        </p>
      ) : loading ? (
        <p role="status">Loading overall reviews…</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No overall reviews match these filters.
        </div>
      ) : (
        <>
          <SummaryTable summaries={summaries} />
          {moduleId && summaries[0] && <PromptTable summary={summaries[0]} />}
          <p className="text-sm text-muted-foreground">
            {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
          </p>
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              reports={reportCounts[`${review.user_id}:${review.module_id}`] ?? 0}
              onShowReports={() =>
                onShowReports(
                  {
                    id: review.user_id!,
                    label: describeReviewer(review.profile_snapshot) || review.tester_email,
                  },
                  review.module_id,
                )
              }
            />
          ))}
        </>
      )}
    </section>
  )
}

'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { BetaModule } from './catalog'
import {
  accuracyOptions,
  confidenceOptions,
  consistencyOptions,
  coverageOptions,
  experienceOptions,
  levelOptions,
  likelihoodOptions,
  promptVerdictOptions,
  qualityOptions,
  readinessOptions,
  type ReviewAnswers,
  type ReviewTrack,
} from './reviewSchema'

/** The reviewer's own saved review of this module, as the server returned it. */
export interface SavedReview {
  id: string
  module_id: string
  track: ReviewTrack
  answers: ReviewAnswers
  updated_at: string
}

/** What the testing page knows about the reviewer before the form opens. */
export interface ReviewContext {
  /** "PCCM Fellow · Fellow Year 2", from the site profile; '' when it could not be read. */
  profileLabel: string
  defaultTrack: ReviewTrack | null
  /** False until the reviews table exists. */
  reviewsOpen: boolean
  review: SavedReview | null
  /** Detailed reports this reviewer has sent on this module. */
  reportCount: number
}

/** From the module's hub card: who it is written for, and its own questions for faculty. */
export interface ReviewModuleNote {
  audience: string
  prompts: readonly string[]
}

type Choices = Record<string, string>
interface Draft {
  track: ReviewTrack | null
  choices: Choices
  /** One verdict per module prompt, '' while unanswered. */
  verdicts: string[]
  workedBest: string
  oneFix: string
}

const ratingRows = [
  { key: 'overall', label: 'Overall quality' },
  { key: 'clarity', label: 'Clarity of the teaching' },
  { key: 'easeOfUse', label: 'Ease of use: finding your way, the controls' },
  { key: 'interactive', label: 'The interactive parts: simulator, cases, questions' },
] as const
const confidenceRows = [
  { key: 'confidenceBefore', label: 'Before the module' },
  { key: 'confidenceNow', label: 'Now' },
] as const
const commonKeys = [
  'coverage',
  'experience',
  ...ratingRows.map((row) => row.key),
  'level',
  'readiness',
]
const trackKeys: Record<ReviewTrack, string[]> = {
  learner: ['confidenceBefore', 'confidenceNow', 'wouldUse'],
  educator: ['accuracy', 'consistent', 'wouldAssign'],
}

/** What counts as unsent work: the answers. Switching "Answer as" alone is not. */
const contentOf = ({ choices, verdicts, workedBest, oneFix }: Draft) =>
  JSON.stringify({ choices, verdicts, workedBest, oneFix })

function emptyDraft(track: ReviewTrack | null, prompts: number): Draft {
  return { track, choices: {}, verdicts: Array(prompts).fill(''), workedBest: '', oneFix: '' }
}

function draftFrom(review: SavedReview, prompts: readonly string[]): Draft {
  const { workedBest, oneFix, ...rest } = review.answers
  const choices: Choices = {}
  for (const [key, value] of Object.entries(rest))
    if (typeof value === 'string') choices[key] = value
  const saved = 'prompts' in review.answers ? review.answers.prompts : []
  // An answer counts only for the wording it was given against.
  const verdicts = prompts.map(
    (prompt) => saved.find((entry) => entry.prompt === prompt)?.verdict ?? '',
  )
  return { track: review.track, choices, verdicts, workedBest, oneFix }
}

/** The questions still unanswered for the chosen track, in the order they appear. */
export function unanswered(draft: Draft): number {
  if (!draft.track) return 1
  const keys = [...commonKeys, ...trackKeys[draft.track]]
  const missing = keys.filter((key) => !draft.choices[key]).length
  return missing + (draft.track === 'educator' ? draft.verdicts.filter((v) => !v).length : 0)
}

function answersOf(draft: Draft, prompts: readonly string[]) {
  const keys = [...commonKeys, ...trackKeys[draft.track!]]
  const answers: Record<string, unknown> = Object.fromEntries(
    keys.map((key) => [key, draft.choices[key]]),
  )
  answers.workedBest = draft.workedBest.trim()
  answers.oneFix = draft.oneFix.trim()
  if (draft.track === 'educator')
    answers.prompts = prompts.map((prompt, i) => ({ prompt, verdict: draft.verdicts[i] }))
  return answers
}

const pill =
  'inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3 text-sm transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring'

function Choice({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string
  legend: string
  options: readonly { value: string; label: string }[]
  value: string | undefined
  onChange: (value: string) => void
}) {
  return (
    <fieldset className="space-y-2" data-review-question={name}>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          // Relative, so the visually hidden radio sits inside its pill: focus and scrolling stay
          // where the reviewer is looking.
          <label key={option.value} className="relative">
            <input
              type="radio"
              className="peer sr-only"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className={pill}>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Several rows answered on the same scale: one radio group per row. */
function Matrix({
  name,
  legend,
  rows,
  options,
  value,
  onChange,
}: {
  name: string
  legend: string
  rows: readonly { key: string; label: string }[]
  options: readonly { value: string; label: string }[]
  value: (key: string) => string | undefined
  onChange: (key: string, value: string) => void
}) {
  return (
    <fieldset className="space-y-2" data-review-question={name}>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="sr-only">
                Question
              </th>
              {options.map((option) => (
                <th
                  key={option.value}
                  scope="col"
                  className="w-[4.75rem] px-1 pb-1 text-center text-xs font-medium text-muted-foreground"
                >
                  {option.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} role="radiogroup" aria-label={row.label} className="border-t">
                <th scope="row" className="py-2 pr-3 text-left font-normal leading-5">
                  {row.label}
                </th>
                {options.map((option) => (
                  <td key={option.value} className="text-center">
                    <input
                      type="radio"
                      className="h-4 w-4 cursor-pointer accent-[hsl(var(--primary))]"
                      name={`${name}-${row.key}`}
                      aria-label={`${row.label}: ${option.label}`}
                      checked={value(row.key) === option.value}
                      onChange={() => onChange(row.key, option.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </fieldset>
  )
}

/**
 * The overall review of one module: who the reviewer is (from their site profile), how far they
 * got, how good it is, and whether it is ready. Its state lives here, outside the dialog content,
 * so closing the dialog keeps unsent answers for this page; `onDirtyChange` lets the testing page
 * guard them as it guards an unsent detailed report.
 */
export function OverallReviewDialog({
  moduleEntry,
  note,
  context,
  open,
  onOpenChange,
  onSaved,
  onDirtyChange,
}: {
  moduleEntry: BetaModule
  note: ReviewModuleNote | null
  context: ReviewContext | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (review: SavedReview) => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const prompts = useMemo(() => note?.prompts ?? [], [note])
  const id = useId()
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(null, prompts.length))
  // The draft as last loaded or saved; unsent work is anything that differs from it.
  const [baseline, setBaseline] = useState(() => contentOf(emptyDraft(null, prompts.length)))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const signature = contentOf(draft)
  const dirty = signature !== baseline

  // Set by the reviewer's first answer: from then on what they entered is never replaced.
  const touched = useRef(false)

  // Fill the form once the reviewer's profile and any earlier review arrive, unless they have
  // already started answering.
  useEffect(() => {
    if (!context || touched.current) return
    const next = context.review
      ? draftFrom(context.review, prompts)
      : emptyDraft(context.defaultTrack, prompts.length)
    setDraft(next)
    setBaseline(contentOf(next))
  }, [context, prompts])

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  const update = (change: (current: Draft) => Draft) => {
    touched.current = true
    setSaved('')
    setDraft(change)
  }
  const choose = (key: string, value: string) =>
    update((current) => ({ ...current, choices: { ...current.choices, [key]: value } }))
  const left = unanswered(draft)
  const editing = Boolean(context?.review)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (left > 0 || !draft.track || sending) return
    setSending(true)
    setError('')
    setSaved('')
    try {
      const response = await fetch('/api/module-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: moduleEntry.id,
          track: draft.track,
          answers: answersOf(draft, prompts),
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Your review could not be sent.')
      setBaseline(signature)
      setSaved(
        editing
          ? 'Your overall review is updated.'
          : 'Thank you. Your overall review is saved; you can change it at any time.',
      )
      onSaved(result.review as SavedReview)
    } catch (err) {
      setError(
        `${err instanceof Error ? err.message : 'Your review could not be sent.'} Your answers are kept on this page.`,
      )
    } finally {
      setSending(false)
    }
  }

  const reports = context?.reportCount ?? 0
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!sending) onOpenChange(value)
      }}
    >
      <DialogContent
        className="max-h-[90dvh] max-w-3xl overflow-y-auto p-4 sm:p-6"
        onInteractOutside={(event) => event.preventDefault()}
        data-overall-review
      >
        <DialogHeader>
          <DialogTitle>Overall review</DialogTitle>
          <DialogDescription>
            {moduleEntry.title} · about 3 minutes · you can change it later
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6">
          <fieldset disabled={sending} className="m-0 min-w-0 space-y-6 border-0 p-0">
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
              {context?.profileLabel ? (
                <p data-review-profile>
                  Reviewing as <strong>{context.profileLabel}</strong>, from your site profile.
                </p>
              ) : null}
              <Choice
                name={`${id}-track`}
                legend="Answer as"
                options={[
                  { value: 'learner', label: 'A learner' },
                  { value: 'educator', label: 'An educator or practicing clinician' },
                ]}
                value={draft.track ?? undefined}
                onChange={(value) =>
                  update((current) => ({ ...current, track: value as ReviewTrack }))
                }
              />
            </div>

            <section className="space-y-5" aria-labelledby={`${id}-module`}>
              <h3 id={`${id}-module`} className="text-base font-semibold">
                The module
              </h3>
              <Choice
                name="coverage"
                legend="How much of the module did you go through?"
                options={coverageOptions}
                value={draft.choices.coverage}
                onChange={(value) => choose('coverage', value)}
              />
              <Choice
                name="experience"
                legend="Your experience with this topic before the module"
                options={experienceOptions}
                value={draft.choices.experience}
                onChange={(value) => choose('experience', value)}
              />
              <Matrix
                name="ratings"
                legend="Rate the module"
                rows={ratingRows}
                options={qualityOptions}
                value={(key) => draft.choices[key]}
                onChange={choose}
              />
              <Choice
                name="level"
                legend={
                  note?.audience
                    ? `Its level for the audience it is written for: ${note.audience}`
                    : 'Its level for the audience it is written for'
                }
                options={levelOptions}
                value={draft.choices.level}
                onChange={(value) => choose('level', value)}
              />
            </section>

            {draft.track === 'learner' && (
              <section className="space-y-5" aria-labelledby={`${id}-learner`}>
                <h3 id={`${id}-learner`} className="text-base font-semibold">
                  As a learner
                </h3>
                <Matrix
                  name="confidence"
                  legend="Your confidence with this topic"
                  rows={confidenceRows}
                  options={confidenceOptions}
                  value={(key) => draft.choices[key]}
                  onChange={choose}
                />
                <Choice
                  name="wouldUse"
                  legend="Would you use it to prepare for a rotation, a procedure or boards?"
                  options={likelihoodOptions}
                  value={draft.choices.wouldUse}
                  onChange={(value) => choose('wouldUse', value)}
                />
              </section>
            )}

            {draft.track === 'educator' && (
              <section className="space-y-5" aria-labelledby={`${id}-educator`}>
                <h3 id={`${id}-educator`} className="text-base font-semibold">
                  As an educator or practicing clinician
                </h3>
                <Choice
                  name="accuracy"
                  legend="Clinical accuracy"
                  options={accuracyOptions}
                  value={draft.choices.accuracy}
                  onChange={(value) => choose('accuracy', value)}
                />
                <Choice
                  name="consistent"
                  legend="Is it consistent with how you teach or practice?"
                  options={consistencyOptions}
                  value={draft.choices.consistent}
                  onChange={(value) => choose('consistent', value)}
                />
                {prompts.length > 0 && (
                  <Matrix
                    name="prompts"
                    legend="This module’s own questions"
                    rows={prompts.map((prompt, i) => ({ key: String(i), label: prompt }))}
                    options={promptVerdictOptions}
                    value={(key) => draft.verdicts[Number(key)] || undefined}
                    onChange={(key, value) =>
                      update((current) => {
                        const verdicts = [...current.verdicts]
                        verdicts[Number(key)] = value
                        return { ...current, verdicts }
                      })
                    }
                  />
                )}
                <Choice
                  name="wouldAssign"
                  legend="Would you assign it to trainees?"
                  options={likelihoodOptions}
                  value={draft.choices.wouldAssign}
                  onChange={(value) => choose('wouldAssign', value)}
                />
              </section>
            )}

            <section className="space-y-5" aria-labelledby={`${id}-verdict`}>
              <h3 id={`${id}-verdict`} className="text-base font-semibold">
                Your verdict
              </h3>
              <Choice
                name="readiness"
                legend="Is it ready for learners?"
                options={readinessOptions}
                value={draft.choices.readiness}
                onChange={(value) => choose('readiness', value)}
              />
              <label className="block space-y-2 text-sm font-medium">
                What worked best? (optional)
                <textarea
                  maxLength={3000}
                  value={draft.workedBest}
                  onChange={(event) => {
                    const workedBest = event.target.value
                    update((current) => ({ ...current, workedBest }))
                  }}
                  className="min-h-16 w-full rounded-lg border bg-background p-3 font-normal"
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                The one thing to fix before release (optional)
                <textarea
                  maxLength={3000}
                  value={draft.oneFix}
                  onChange={(event) => {
                    const oneFix = event.target.value
                    update((current) => ({ ...current, oneFix }))
                  }}
                  className="min-h-16 w-full rounded-lg border bg-background p-3 font-normal"
                />
              </label>
              <p className="text-xs leading-5 text-muted-foreground" data-review-reports>
                Specific problems are best sent with Give feedback, on the page where they happen.{' '}
                {reports === 1
                  ? 'You have sent 1 detailed report on this module.'
                  : `You have sent ${reports} detailed reports on this module.`}
              </p>
            </section>
          </fieldset>
          {context && !context.reviewsOpen && (
            <p role="status" className="text-sm">
              Overall reviews are not open yet. You can answer now; your answers stay on this page
              until you send them or leave it.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {saved && (
            <p role="status" className="text-sm">
              {saved}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {left > 0 && (
              <p className="mr-auto text-sm text-muted-foreground" data-review-left>
                {left === 1 ? '1 question left' : `${left} questions left`}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={sending}
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button type="submit" disabled={sending || left > 0}>
              {sending ? 'Sending…' : editing ? 'Update review' : 'Send review'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

import { feedbackReviewModuleById } from './catalog'
import {
  describeReviewer,
  readinessOptions,
  type EducatorAnswers,
  type LearnerAnswers,
  type StoredReview,
} from './reviewSchema'

/** Per-module numbers for the admin workspace, computed from the stored reviews. */
export interface ModuleReviewSummary {
  moduleId: string
  total: number
  learners: number
  educators: number
  medianOverall: number | null
  means: {
    overall: number | null
    clarity: number | null
    easeOfUse: number | null
    interactive: number | null
    /** Educators only; "Can't judge" is left out. */
    accuracy: number | null
  }
  readiness: Record<(typeof readinessOptions)[number]['value'], number>
  /** Learners only: mean confidence before the module and now. */
  confidence: { before: number | null; now: number | null; n: number }
  /** Educators' verdicts on each of the module's own questions, by wording. */
  prompts: { prompt: string; looksRight: number; needsChanges: number; notReached: number }[]
}

const score = (value: string | undefined) => {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
}
const present = (values: (number | null)[]) => values.filter((v): v is number => v !== null)
export function mean(values: (number | null)[]) {
  const list = present(values)
  return list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : null
}
export function median(values: (number | null)[]) {
  const list = present(values).sort((a, b) => a - b)
  if (!list.length) return null
  const mid = Math.floor(list.length / 2)
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2
}

export function summarizeReviews(reviews: readonly StoredReview[]): ModuleReviewSummary[] {
  const byModule = new Map<string, StoredReview[]>()
  for (const review of reviews)
    byModule.set(review.module_id, [...(byModule.get(review.module_id) ?? []), review])
  return [...byModule.entries()].map(([moduleId, list]) => {
    const learners = list.filter((r) => r.track === 'learner')
    const educators = list.filter((r) => r.track === 'educator')
    const learnerAnswers = learners.map((r) => r.answers as LearnerAnswers)
    const educatorAnswers = educators.map((r) => r.answers as EducatorAnswers)
    const readiness = Object.fromEntries(readinessOptions.map((o) => [o.value, 0])) as Record<
      (typeof readinessOptions)[number]['value'],
      number
    >
    for (const review of list)
      if (review.answers.readiness in readiness) readiness[review.answers.readiness] += 1
    const prompts = new Map<string, ModuleReviewSummary['prompts'][number]>()
    for (const answers of educatorAnswers)
      for (const { prompt, verdict } of answers.prompts ?? []) {
        const row = prompts.get(prompt) ?? { prompt, looksRight: 0, needsChanges: 0, notReached: 0 }
        if (verdict === 'looks-right') row.looksRight += 1
        else if (verdict === 'needs-changes') row.needsChanges += 1
        else row.notReached += 1
        prompts.set(prompt, row)
      }
    const all = list.map((r) => r.answers)
    return {
      moduleId,
      total: list.length,
      learners: learners.length,
      educators: educators.length,
      medianOverall: median(all.map((a) => score(a.overall))),
      means: {
        overall: mean(all.map((a) => score(a.overall))),
        clarity: mean(all.map((a) => score(a.clarity))),
        easeOfUse: mean(all.map((a) => score(a.easeOfUse))),
        interactive: mean(all.map((a) => score(a.interactive))),
        accuracy: mean(educatorAnswers.map((a) => score(a.accuracy))),
      },
      readiness,
      confidence: {
        before: mean(learnerAnswers.map((a) => score(a.confidenceBefore))),
        now: mean(learnerAnswers.map((a) => score(a.confidenceNow))),
        n: learners.length,
      },
      prompts: [...prompts.values()],
    }
  })
}

const csvColumns = [
  'module',
  'updated_at',
  'tester_email',
  'reviewer',
  'track',
  'coverage',
  'experience',
  'overall',
  'clarity',
  'easeOfUse',
  'interactive',
  'level',
  'readiness',
  'accuracy',
  'consistent',
  'wouldAssign',
  'confidenceBefore',
  'confidenceNow',
  'wouldUse',
  'module_questions',
  'workedBest',
  'oneFix',
  'detailed_reports',
] as const

/** Quote a CSV cell, and keep a spreadsheet from reading it as a formula. */
function cell(value: unknown) {
  let text = value === undefined || value === null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function reviewsCsv(
  reviews: readonly StoredReview[],
  reportCounts: Record<string, number> = {},
) {
  const rows = reviews.map((review) => {
    const answers = review.answers as Partial<LearnerAnswers & EducatorAnswers>
    const values: Record<(typeof csvColumns)[number], unknown> = {
      module: feedbackReviewModuleById(review.module_id)?.title ?? review.module_id,
      updated_at: review.updated_at,
      tester_email: review.tester_email,
      reviewer: describeReviewer(review.profile_snapshot),
      track: review.track,
      coverage: answers.coverage,
      experience: answers.experience,
      overall: answers.overall,
      clarity: answers.clarity,
      easeOfUse: answers.easeOfUse,
      interactive: answers.interactive,
      level: answers.level,
      readiness: answers.readiness,
      accuracy: answers.accuracy,
      consistent: answers.consistent,
      wouldAssign: answers.wouldAssign,
      confidenceBefore: answers.confidenceBefore,
      confidenceNow: answers.confidenceNow,
      wouldUse: answers.wouldUse,
      module_questions: (answers.prompts ?? [])
        .map(({ prompt, verdict }) => `${prompt} — ${verdict}`)
        .join(' | '),
      workedBest: answers.workedBest,
      oneFix: answers.oneFix,
      detailed_reports: reportCounts[`${review.user_id}:${review.module_id}`] ?? 0,
    }
    return csvColumns.map((column) => cell(values[column])).join(',')
  })
  return [csvColumns.join(','), ...rows].join('\r\n') + '\r\n'
}

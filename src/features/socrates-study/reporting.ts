import type { StudyAttempt, TrainingProgress } from './model'
export interface DashboardData {
  studies: Record<string, unknown>[]
  rounds: Record<string, unknown>[]
  cases: Record<string, unknown>[]
  participants: Record<string, unknown>[]
  attempts: Record<string, unknown>[]
  training: Record<string, unknown>[]
}
export function completionSummary(data: DashboardData) {
  return data.participants.map((participant) => {
    const attempts = (data.attempts as unknown as StudyAttempt[]).filter(
      (a) => a.user_id === participant.user_id && a.study_id === participant.study_id,
    )
    const cases = data.cases.filter((c) => c.study_id === participant.study_id)
    const rounds = data.rounds
      .filter((r) => r.study_id === participant.study_id)
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((round) => {
        const total = cases.filter((c) => c.round_key === round.round_key).length
        const completed = attempts.filter(
          (a) => a.round_key === round.round_key && a.submitted_at,
        ).length
        return { key: String(round.round_key), title: String(round.title), completed, total }
      })
    return {
      userId: String(participant.user_id),
      studyId: String(participant.study_id),
      started: attempts.length > 0,
      completed: cases.length > 0 && rounds.every((r) => r.total > 0 && r.completed === r.total),
      rounds,
      trainingCompleted: data.training.filter(
        (p) => p.user_id === participant.user_id && p.completed_at,
      ).length,
    }
  })
}
// Spreadsheet formula injection protection applies even to user-authored response text.
function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
const headers = [
  'record_type',
  'participant_id',
  'study_id',
  'study_version',
  'round',
  'case_id',
  'case_revision',
  'case_order',
  'started_at',
  'revealed_at',
  'submitted_at',
  'elapsed_ms',
  'adequacy',
  'cancer',
  'preliminary_diagnosis',
  'confidence',
  'response_complete',
  'missing_items',
  'free_text',
]
export function studyCsv(data: DashboardData, includeFreeText = false) {
  const tests = [...(data.attempts as unknown as StudyAttempt[])].sort(
    (a, b) =>
      a.study_id.localeCompare(b.study_id) ||
      a.user_id.localeCompare(b.user_id) ||
      a.round_key.localeCompare(b.round_key) ||
      a.case_order - b.case_order ||
      a.id.localeCompare(b.id),
  )
  const training = [
    ...(data.training as unknown as (TrainingProgress & { user_id: string })[]),
  ].sort(
    (a, b) =>
      a.user_id.localeCompare(b.user_id) ||
      a.case_id.localeCompare(b.case_id) ||
      a.case_revision - b.case_revision,
  )
  const rows: unknown[][] = tests.map((a) => [
    'testing',
    a.user_id,
    a.study_id,
    a.study_version,
    a.round_key,
    a.case_id,
    a.case_revision,
    a.case_order,
    a.started_at,
    '',
    a.submitted_at,
    a.elapsed_ms,
    a.responses.adequacy,
    a.responses.cancer,
    a.responses.preliminaryDiagnosis,
    a.confidence,
    a.response_complete,
    a.missing_items.join('|'),
    includeFreeText ? a.responses.freeText : '',
  ])
  for (const p of training)
    rows.push([
      'training',
      p.user_id,
      '',
      '',
      '',
      p.case_id,
      p.case_revision,
      '',
      p.opened_at,
      p.revealed_at,
      p.completed_at,
      '',
      '',
      '',
      '',
      '',
      Boolean(p.completed_at),
      '',
      '',
    ])
  return (
    '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
  )
}

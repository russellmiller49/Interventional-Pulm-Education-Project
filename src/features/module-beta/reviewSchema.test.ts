import { betaRollout, hubBetaModules } from './rollout'
import {
  defaultTrack,
  describeReviewer,
  educatorAnswersSchema,
  type StoredReview,
} from './reviewSchema'
import { median, reviewsCsv, summarizeReviews } from './reviewSummary'

describe('who the reviewer is', () => {
  it('starts students, residents and fellows as learners and everyone else as educators', () => {
    for (const role of [
      'medical_student',
      'resident',
      'chief_resident',
      'pccm_fellow',
      'interventional_pulmonology_fellow',
    ])
      expect(defaultTrack(role)).toBe('learner')
    for (const role of [
      'interventional_pulmonologist',
      'intensivist',
      'respiratory_therapist',
      'medical_educator',
      'other',
    ])
      expect(defaultTrack(role)).toBe('educator')
    expect(defaultTrack(null)).toBeNull()
  })

  it('describes the reviewer the way the profile names them', () => {
    expect(
      describeReviewer({
        professional_role: 'resident',
        resident_specialty: 'internal_medicine',
        training_level: 'pgy_2',
        years_in_practice: 'in_training',
      }),
    ).toBe('Resident, Internal Medicine · PGY-2')
    expect(describeReviewer({ professional_role: 'intensivist', years_in_practice: '10_20' })).toBe(
      'Intensivist · 10-20 years',
    )
    expect(
      describeReviewer({ professional_role: 'other', role_other: 'Simulation nurse educator' }),
    ).toBe('Simulation nurse educator')
    expect(describeReviewer(null)).toBe('')
  })
})

it('fits every hub module’s own questions within what the educator form accepts', () => {
  for (const entry of hubBetaModules) {
    const prompts = betaRollout[entry.id].note?.lookFor ?? []
    const answers = {
      coverage: 'all',
      experience: 'teach',
      overall: '5',
      clarity: '5',
      easeOfUse: '5',
      interactive: '5',
      level: 'about-right',
      readiness: 'ready-now',
      accuracy: '5',
      consistent: 'yes',
      wouldAssign: 'yes',
      prompts: prompts.map((prompt) => ({ prompt, verdict: 'looks-right' })),
    }
    expect(educatorAnswersSchema.safeParse(answers).success).toBe(true)
  }
})

const base = {
  tester_email: 't@example.org',
  profile_snapshot: {},
  form_version: 1,
  created_at: '',
  updated_at: '2026-11-09T10:00:00Z',
}
const reviews = [
  {
    ...base,
    id: 'a',
    user_id: 'u1',
    module_id: 'ebus-guided',
    track: 'learner',
    answers: {
      coverage: 'all',
      experience: 'new',
      overall: '4',
      clarity: '4',
      easeOfUse: '2',
      interactive: '5',
      level: 'about-right',
      readiness: 'minor-fixes',
      workedBest: '',
      oneFix: '=HYPERLINK("x")',
      confidenceBefore: '1',
      confidenceNow: '4',
      wouldUse: 'yes',
    },
  },
  {
    ...base,
    id: 'b',
    user_id: 'u2',
    module_id: 'ebus-guided',
    track: 'educator',
    answers: {
      coverage: 'most',
      experience: 'teach',
      overall: '3',
      clarity: '2',
      easeOfUse: '3',
      interactive: '4',
      level: 'too-basic',
      readiness: 'major-changes',
      workedBest: 'Cases, "mostly"',
      oneFix: '',
      accuracy: 'cant-judge',
      consistent: 'mostly',
      wouldAssign: 'probably',
      prompts: [{ prompt: 'Landmarks', verdict: 'needs-changes' }],
    },
  },
  {
    ...base,
    id: 'c',
    user_id: 'u3',
    module_id: 'ebus-guided',
    track: 'educator',
    answers: {
      coverage: 'all',
      experience: 'teach',
      overall: '5',
      clarity: '5',
      easeOfUse: '4',
      interactive: '4',
      level: 'about-right',
      readiness: 'ready-now',
      workedBest: '',
      oneFix: '',
      accuracy: '4',
      consistent: 'yes',
      wouldAssign: 'yes',
      prompts: [{ prompt: 'Landmarks', verdict: 'looks-right' }],
    },
  },
] as unknown as StoredReview[]

describe('the admin summary', () => {
  it('counts and averages each module’s reviews', () => {
    const [summary] = summarizeReviews(reviews)
    expect(summary).toMatchObject({
      moduleId: 'ebus-guided',
      total: 3,
      learners: 1,
      educators: 2,
      medianOverall: 4,
    })
    expect(summary.means.overall).toBe(4)
    expect(summary.means.clarity).toBeCloseTo(11 / 3)
    // "Can't judge" is not a score.
    expect(summary.means.accuracy).toBe(4)
    expect(summary.confidence).toEqual({ before: 1, now: 4, n: 1 })
    expect(summary.readiness).toEqual({
      'ready-now': 1,
      'minor-fixes': 1,
      'major-changes': 1,
      'not-ready': 0,
    })
    expect(summary.prompts).toEqual([
      { prompt: 'Landmarks', looksRight: 1, needsChanges: 1, notReached: 0 },
    ])
  })

  it('takes the middle of an even count as the median', () => {
    expect(median([5, 1, 4, 2])).toBe(3)
    expect(median([])).toBeNull()
  })

  it('exports a CSV a spreadsheet will not run as formulas', () => {
    const csv = reviewsCsv(reviews, { 'u2:ebus-guided': 3 })
    const lines = csv.trim().split('\r\n')
    expect(lines).toHaveLength(4)
    expect(lines[0]).toMatch(/^module,updated_at,tester_email,reviewer,track/)
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain('"Cases, ""mostly"""')
    expect(lines[2]).toContain('Landmarks — needs-changes')
    expect(lines[2].endsWith(',3')).toBe(true)
  })
})

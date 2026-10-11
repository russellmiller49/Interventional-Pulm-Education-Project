import { render, screen, within } from '@testing-library/react'

import { selectCrrtActualRunReview } from '../actualRunReview'
import { CrrtCasePlayer } from '../components/CrrtCasePlayer'
import { getBaxterCrrtCase } from '../content/completeCases'
import type { CrrtCaseId } from '../content/schema'
import { selectCrrtBloodFlowState } from '../engine/circuitDelivery'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningSessionAction,
} from '../engine/learningSession'

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

function start(caseId: CrrtCaseId) {
  return createCrrtLearningSession({
    caseDefinition: getBaxterCrrtCase(caseId),
    experience: 'practice',
    roleLens: 'integrated',
    attempt: 1,
    deviceId: 'prismax-aw8035-2xx',
  })
}

for (const caseId of ['CRRT-08', 'CRRT-09'] as const) {
  it(`${caseId}: every stop/connection choice is recorded and leaves the running simulation unchanged`, () => {
    const definition = getBaxterCrrtCase(caseId)
    const actions = definition.interventions.filter(({ label }) =>
      /stop|connect|start|anticoagulant/i.test(label),
    )
    expect(actions.length).toBeGreaterThan(0)
    for (const action of actions) {
      expect(action.effects).toEqual([])
      const assessed = crrtLearningSessionReducer(start(caseId), {
        type: 'PERFORM_INTERVENTION',
        interventionId: `${caseId.toLowerCase().replace('-', '')}-action-assess`,
      })
      const after = crrtLearningSessionReducer(assessed, {
        type: 'PERFORM_INTERVENTION',
        interventionId: action.id,
      })
      expect(after.performedInterventionIds).toContain(action.id)
      expect(after.simulation).toEqual(assessed.simulation)
      expect(selectCrrtBloodFlowState(after.simulation).actualMlMin).toBe(150)
      expect(selectCrrtActualRunReview(after).interruptions.pauseCount).toBe(0)
    }
  })
}

it('CRRT-17 transfer asks a new citrate question with its own values, not about a linked trend', () => {
  const question = getBaxterCrrtCase('CRRT-17').debrief.transferQuestion
  expect(question).not.toMatch(/the linked trend/)
  expect(question).toMatch(/ratio of \d/)
  expect(question).toMatch(/\?$/)
})

it('CRRT-17 reassessment and hints do not ask learners to read an absent trend', () => {
  const definition = getBaxterCrrtCase('CRRT-17')
  for (const text of [
    ...definition.reassessmentOptions.map(({ label }) => label),
    ...definition.hintLadder.map(({ text }) => text),
  ])
    expect(text).not.toMatch(/Reassess linked trend direction/)
  expect(definition.reassessmentOptions[0].label).toMatch(/total and ionized calcium/)
})

const act = (interventionId: string): CrrtLearningSessionAction => ({
  type: 'PERFORM_INTERVENTION',
  interventionId,
})
const cases: { name: string; caseId: CrrtCaseId; actions: CrrtLearningSessionAction[] }[] = [
  { name: 'no action', caseId: 'CRRT-17', actions: [] },
  { name: 'assessment only', caseId: 'CRRT-01', actions: [act('crrt01-action-assess')] },
  {
    name: 'diagnostic only',
    caseId: 'CRRT-13',
    actions: [
      act('crrt13-assess-patient-device'),
      act('crrt13-advance-to-pattern'),
      act('crrt13-inspect-access-path'),
    ],
  },
  {
    name: 'harmful without reassessment',
    caseId: 'CRRT-11',
    actions: [act('crrt11-action-unsafe-candidate')],
  },
  {
    name: 'corrective without reassessment',
    caseId: 'CRRT-11',
    actions: [act('crrt11-action-assess'), act('crrt11-action-safe-candidate')],
  },
  {
    name: 'actual reassessment',
    caseId: 'CRRT-17',
    actions: [
      act('crrt17-action-assess'),
      act('crrt17-action-safe-candidate'),
      { type: 'COMMIT_REASSESSMENT', optionIds: ['crrt17-reassess-trends'] },
    ],
  },
  {
    name: 'time without reassessment',
    caseId: 'CRRT-02',
    actions: [{ type: 'ADVANCE_TIME', seconds: 3600 }],
  },
]

it.each(cases)(
  '$name keeps recorded events separate from identical authored teaching',
  ({ caseId, actions }) => {
    const fresh = start(caseId)
    const performed = actions.reduce(crrtLearningSessionReducer, fresh)
    // Validate the harness really performed each requested action rather than testing a refusal.
    for (const action of actions)
      if (action.type === 'PERFORM_INTERVENTION') {
        expect(performed.performedInterventionIds).toContain(action.interventionId)
      }
    const session = crrtLearningSessionReducer(performed, { type: 'REVEAL_DEBRIEF' })
    const review = selectCrrtActualRunReview(session)
    expect(review.actions).toHaveLength(session.timeline.length)
    render(
      <CrrtCasePlayer
        session={session}
        dispatch={() => {}}
        onRoleChange={() => {}}
        onReset={() => {}}
      />,
    )
    const actual = screen
      .getByRole('heading', { name: 'What you did in this run' })
      .closest('section')!
    expect(within(actual.querySelector('ol')!).getAllByRole('listitem')).toHaveLength(
      session.timeline.length,
    )
    expect(review.reassessmentLabels.length > 0).toBe(performed.reassessment.committed)
    if (!performed.reassessment.committed)
      expect(actual).toHaveTextContent('Not recorded. The reassessment below is the worked answer')
    const worked = screen.getByRole('region', {
      name: 'Worked teaching for this case · not a record of this run',
    })
    expect(worked).toHaveTextContent(fresh.caseDefinition.debrief.trendReview)
    expect(worked).not.toHaveTextContent(/showed whether|plan is recorded|team receives/)
    expect(screen.getAllByRole('heading', { name: 'Causal debrief' })).toHaveLength(1)
    expect(screen.queryByText('Your clinical model', { exact: true })).toBeNull()
  },
)

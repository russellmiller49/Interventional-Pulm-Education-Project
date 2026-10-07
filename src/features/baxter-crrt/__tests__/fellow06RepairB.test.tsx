import { render, screen, within } from '@testing-library/react'

import { CrrtActivityWorkspace } from '../components/CrrtActivityWorkspace'
import { CrrtCasePlayer } from '../components/CrrtCasePlayer'
import { getBaxterCrrtCase } from '../content/completeCases'
import { selectCrrtActualRunReview } from '../actualRunReview'
import { createCrrtLearningSession, crrtLearningSessionReducer } from '../engine/learningSession'
import {
  crrtFixtureWithMakeupBag,
  withCrrtMakeupFlow,
} from '../engine/testSupport/cumulativeFluidStates'
import { loadCrrtFixture, startCrrtTherapy } from '../livePressureStationModel'

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

function sessionWithMakeup(returnedToZero: boolean, clean = false) {
  let session = createCrrtLearningSession({
    caseDefinition: getBaxterCrrtCase('CRRT-10'),
    experience: 'practice',
    roleLens: 'integrated',
    attempt: 1,
    deviceId: 'prismax-aw8035-2xx',
  })
  session = {
    ...session,
    simulation: withCrrtMakeupFlow(
      startCrrtTherapy(loadCrrtFixture(crrtFixtureWithMakeupBag())),
      clean ? 0 : 100,
    ),
  }
  session = crrtLearningSessionReducer(session, { type: 'ADVANCE_TIME', seconds: 7_200 })
  if (returnedToZero) {
    session = { ...session, simulation: withCrrtMakeupFlow(session.simulation, 0) }
    session = crrtLearningSessionReducer(session, { type: 'ADVANCE_TIME', seconds: 7_200 })
  }
  return session
}

describe('F06-R04 cumulative makeup containment across consumers', () => {
  it.each([false, true])(
    'withholds evidence, patient, trends and review (returned zero: %s)',
    (returnedToZero) => {
      const session = sessionWithMakeup(returnedToZero)
      // Pin the original acceptance reproduction, including the real raw totals.
      expect(session.simulation.deliveredTherapy.cumulativeWholePatientBalanceMl).toBeCloseTo(
        returnedToZero ? 900 : 500,
      )
      const { container } = render(
        <CrrtActivityWorkspace
          session={session}
          mode="practice"
          progressLabel="Review fixture"
          onReset={() => {}}
          onSaveAndExit={() => {}}
        >
          <CrrtCasePlayer
            session={session}
            dispatch={() => {}}
            onRoleChange={() => {}}
            onReset={() => {}}
          />
        </CrrtActivityWorkspace>,
      )
      const rail = screen.getByText('Delivered dose · whole-patient balance').parentElement!
      expect(rail).toHaveTextContent('Withheld')
      expect(rail).toHaveTextContent(/makeup/i)
      const patientPanel = container.querySelector(
        '#baxter-crrt-mobile-panel-patient',
      ) as HTMLElement
      expect(
        within(patientPanel).getByText('Whole-patient balance').parentElement,
      ).toHaveTextContent('Withheld')
      expect(patientPanel).toHaveTextContent(/no volume is attributed to patient loss/i)
    },
  )

  it.each([false, true])(
    'withholds actual balance, dependent overload and both trend endpoints (returned zero: %s)',
    (returnedToZero) => {
      const session = crrtLearningSessionReducer(sessionWithMakeup(returnedToZero), {
        type: 'REVEAL_DEBRIEF',
      })
      const review = selectCrrtActualRunReview(session)
      expect(
        review.observations.find(({ label }) => label === 'Whole-patient fluid balance')?.value,
      ).toBe('Withheld')
      const overload = review.modelIndices.find(
        ({ label }) => label === 'Total fluid overload carried',
      )!
      expect(overload.value).toBe('Withheld')
      expect(overload.note).toMatch(/makeup/i)
      render(
        <CrrtCasePlayer
          session={session}
          dispatch={() => {}}
          onRoleChange={() => {}}
          onReset={() => {}}
        />,
      )
      const row = screen.getByRole('row', { name: /Whole-patient balance/ })
      expect(
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ).toEqual(['Withheld', 'Withheld'])
      expect(screen.getByText('Whole-patient fluid balance').parentElement).toHaveTextContent(
        'Withheld',
      )
    },
  )

  it('keeps zero-makeup outputs available, reset clean, and raw engine accounting unchanged', () => {
    const clean = sessionWithMakeup(true, true)
    const review = selectCrrtActualRunReview(clean)
    expect(
      review.observations.find(({ label }) => label === 'Whole-patient fluid balance')?.value,
    ).toBe('900 mL')
    expect(
      review.modelIndices.find(({ label }) => label === 'Total fluid overload carried')?.value,
    ).not.toBe('Withheld')
    const contaminated = sessionWithMakeup(true)
    const before = JSON.stringify(contaminated.simulation)
    selectCrrtActualRunReview(contaminated)
    expect(JSON.stringify(contaminated.simulation)).toBe(before)
    const reset = crrtLearningSessionReducer(contaminated, { type: 'RESET' })
    expect(
      selectCrrtActualRunReview(reset).observations.find(
        ({ label }) => label === 'Whole-patient fluid balance',
      )?.value,
    ).toBe('0 mL')
  })
})

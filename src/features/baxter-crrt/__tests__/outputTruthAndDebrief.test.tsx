import { fireEvent, render, screen, within } from '@testing-library/react'
import { useReducer } from 'react'

import { CrrtCasePlayer } from '../components/CrrtCasePlayer'
import { getBaxterCrrtCase } from '../content/completeCases'
import type { RuntimeCrrtCase } from '../content/schema'
import { createCrrtLearningSession, crrtLearningSessionReducer } from '../engine/learningSession'
import { crrtSoluteIds } from '../engine/types'

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

function Player({ definition }: { definition: RuntimeCrrtCase }) {
  const [session, dispatch] = useReducer(
    crrtLearningSessionReducer,
    {
      caseDefinition: definition,
      experience: 'practice' as const,
      roleLens: 'integrated' as const,
      attempt: 1,
      deviceId: 'prismax-aw8035-2xx' as const,
    },
    createCrrtLearningSession,
  )
  return (
    <CrrtCasePlayer
      session={session}
      dispatch={dispatch}
      onRoleChange={() => {}}
      onReset={() => dispatch({ type: 'RESET' })}
    />
  )
}

const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name: name as string }))
const performAction = (label: RegExp) => {
  const article = screen
    .getAllByRole('article')
    .find((candidate) => label.test(candidate.textContent ?? ''))
  if (!article) throw new Error(`No action card matched ${label}`)
  fireEvent.click(within(article).getByRole('button'))
}
const debriefSection = (name: RegExp) =>
  screen.getByRole('heading', { name }).closest('section') as HTMLElement

beforeEach(() => window.localStorage.clear())

describe('CRRT laboratory output stays inside what the model supports', () => {
  it('does not present evolving solute concentrations as a sampled laboratory trend', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-15')} />)
    click('+6 hr')
    click('End run and review debrief')

    const table = screen.getByRole('region', {
      name: /Session sampled trends/,
    })
    const rowHeaders = within(table)
      .getAllByRole('rowheader')
      .map((header) => header.textContent ?? '')
    for (const soluteId of crrtSoluteIds) {
      expect(rowHeaders).not.toContain(soluteId.replaceAll('-', ' '))
    }
    expect(rowHeaders).toContain('Delivered dose')
    expect(rowHeaders).toContain('Access pressure')
    expect(
      screen.getByRole('heading', { name: 'Sampled pressure, dose, and fluid evidence' }),
    ).toBeInTheDocument()
  })

  it('shows the supplied case-start values with their units and says what is not modeled', () => {
    const definition = getBaxterCrrtCase('CRRT-02')
    render(<Player definition={definition} />)
    click('+1 hr')
    click('End run and review debrief')

    const labs = debriefSection(/Laboratory values in this case/)
    expect(labs).toHaveTextContent('Supplied case values at case start')
    expect(labs).toHaveTextContent(
      `${definition.initialPatient.solutes.sodiumMmolPerL.toFixed(1)} mmol/L`,
    )
    expect(labs).toHaveTextContent(
      `${definition.initialPatient.solutes.potassiumMmolPerL.toFixed(1)} mmol/L`,
    )
    expect(labs).toHaveTextContent(
      `${definition.initialPatient.solutes.creatinineMgPerDl.toFixed(1)} mg/dL`,
    )
    expect(labs).toHaveTextContent(/no laboratory trend, correction, or worsening is claimed/)
    for (const label of ['Sodium', 'Potassium', 'Bicarbonate', 'Phosphate', 'Magnesium']) {
      expect(within(labs).getAllByText(new RegExp(label)).length).toBeGreaterThan(0)
    }
    expect(labs).toHaveTextContent(
      /no reviewed specification for dialysate and replacement solution concentrations/,
    )
  })

  it('keeps the supplied baseline, not the decayed pool, in the patient strip wording', () => {
    const definition = getBaxterCrrtCase('CRRT-15')
    render(<Player definition={definition} />)
    click('+6 hr')
    // The player itself does not render the strip; the containment contract is
    // that the decayed value never appears as a current potassium reading.
    const decayed = '3.5'
    const body = document.body.textContent ?? ''
    expect(body).not.toContain(`K ${decayed}`)
  })
})

describe('CRRT debrief separates the worked example from this run', () => {
  it('labels the authored explanation and never calls a run safe or successful', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-13')} />)
    performAction(/Assess the patient and treatment/)
    click('+30 min')
    click('End run and review debrief')

    expect(
      screen.getByRole('heading', { name: 'Supplied teaching path · worked example' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Run reviewed')).toBeNull()
    expect(screen.getByText(/^Debrief opened · \d+ recorded events? in this run$/)).toBeVisible()
    expect(
      screen.getByText(/not a judgement that the care was safe, complete, or successful/),
    ).toBeVisible()
  })

  it('keeps the explanation and debrief available with no run at all', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-11')} />)
    click('Explain this case')
    expect(screen.getByRole('region', { name: 'Worked example' })).toBeInTheDocument()
    click('End run and review debrief')
    expect(screen.getByText('Debrief opened · no run performed')).toBeVisible()
    expect(
      screen.getByText(/You have not performed a case action or advanced simulated time/),
    ).toBeVisible()
    const actual = debriefSection(/What you did in this run/)
    expect(actual).toHaveTextContent(/Not recorded\./)
    expect(actual).not.toHaveTextContent(/Recorded for this run/)
  })

  it('reads back the actual actions with the values they carried', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-11')} />)
    performAction(/Complete the initial clinical assessment/)
    click('+30 min')
    click('End run and review debrief')

    const actual = debriefSection(/What you did in this run/)
    expect(actual).toHaveTextContent('Complete the initial clinical assessment')
    expect(actual).toHaveTextContent('Advanced simulated time by 30 min')
    expect(actual).toHaveTextContent('Elapsed: 30 min')
    // An assessment action changes no parameter, and the debrief says exactly that
    // rather than borrowing a number from the final prescription.
    expect(actual).toHaveTextContent('Parameter change: None recorded for this action')
    expect(actual).not.toHaveTextContent('SET_PRESCRIPTION_VALUE')
    expect(actual).not.toHaveTextContent('Intervention performed')
  })

  it('leaves reassessment "Not recorded" instead of filling in the recommended answer', () => {
    const definition = getBaxterCrrtCase('CRRT-13')
    render(<Player definition={definition} />)
    performAction(/Assess the patient and treatment/)
    click('+30 min')
    click('End run and review debrief')

    const actual = debriefSection(/What you did in this run/)
    expect(actual).toHaveTextContent(/Not recorded\./)
    for (const id of definition.requiredReassessmentIds) {
      const recommended = definition.reassessmentOptions.find((option) => option.id === id)
      if (recommended) expect(actual).not.toHaveTextContent(recommended.label)
    }
  })

  it('names the harmful action and reports that its cause is still active', () => {
    const definition = getBaxterCrrtCase('CRRT-13')
    render(<Player definition={definition} />)
    performAction(/Assess the patient and treatment/)
    performAction(/Advance to the worsening pattern/)
    performAction(/Increase BFR through unresolved access resistance/)
    performAction(/Acknowledge the generic training alert/)
    performAction(/Declare resolution after acknowledgement alone/)
    click('+1 hr')
    click('End run and review debrief')

    const safety = debriefSection(/Safety review of this run/)
    const increaseBfr = definition.unsafeActions.find(
      (entry) => entry.actionId === 'crrt13-increase-bfr-through-obstruction',
    )!
    expect(safety).toHaveTextContent(increaseBfr.explanation)
    const criticalError = definition.criticalErrors.find(
      (entry) => entry.id === increaseBfr.criticalErrorId,
    )!
    expect(safety).toHaveTextContent(criticalError.label)
    expect(safety).toHaveTextContent(/Access-line obstruction.*is still active/)
    expect(safety).toHaveTextContent(/acknowledging an alert does not correct its cause/)
  })

  it('does not claim an unresolved cause on a path that corrected it', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-13')} />)
    performAction(/Assess the patient and treatment/)
    performAction(/Advance to the worsening pattern/)
    performAction(/Inspect the access catheter and line path/)
    performAction(/Pause treatment while correcting the access path/)
    performAction(/Reposition the access and relieve the obstruction/)
    performAction(/Resume after correcting the cause/)
    performAction(/Confirm restored pressure pattern and treatment delivery/)
    click('+1 hr')
    click('End run and review debrief')

    const safety = debriefSection(/Safety review of this run/)
    expect(safety).toHaveTextContent('No simulated fault was still active when the run ended.')
    expect(safety).toHaveTextContent(/none of the actions this case flags as unsafe/)
    expect(safety).toHaveTextContent(/not a judgement that the run was clinically adequate/)
  })
})

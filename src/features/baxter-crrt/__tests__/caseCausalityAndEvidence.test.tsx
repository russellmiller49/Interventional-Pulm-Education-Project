import { fireEvent, render, screen, within } from '@testing-library/react'
import { useReducer } from 'react'

import { CrrtCasePlayer } from '../components/CrrtCasePlayer'
import { getBaxterCrrtCase } from '../content/completeCases'
import type { RuntimeCrrtCase } from '../content/schema'
import { createCrrtLearningSession, crrtLearningSessionReducer } from '../engine/learningSession'

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

const sectionFor = (name: RegExp) =>
  screen.getByRole('heading', { name }).closest('section') as HTMLElement

beforeEach(() => window.localStorage.clear())

describe('the case states its evidence scope in the task', () => {
  it('CRRT-17 shows the one supplied systemic calcium with its sample identity and time', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-17')} />)
    const scope = sectionFor(/What this case can show you/)
    expect(scope).toHaveTextContent('1.05 mmol/L')
    expect(scope).toHaveTextContent('Systemic sample — patient blood, not the circuit')
    expect(scope).toHaveTextContent('At case start')
    expect(scope).toHaveTextContent('SYNTH-CRRT-17')
  })

  it('CRRT-17 keeps the absent citrate evidence absent, and never zero or normal', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-17')} />)
    const scope = sectionFor(/What this case can show you/)
    const totalCalcium = within(scope).getByText('Total calcium').closest('div') as HTMLElement
    expect(totalCalcium).toHaveTextContent('Not supplied')
    expect(totalCalcium).not.toHaveTextContent('0.0')
    expect(scope).toHaveTextContent('A post-filter (circuit) ionized calcium')
    expect(scope).toHaveTextContent('Serial calcium values, or any calcium trend')
    expect(scope).toHaveTextContent('A total/ionized calcium relationship')
    expect(scope).toHaveTextContent('The linked trend-direction display')
    expect(scope).toHaveTextContent(
      'Citrate physiology, calcium kinetics, citrate accumulation, or any threshold',
    )
    // The supported teaching that does exist is pointed at, with its source.
    expect(scope).toHaveTextContent('Post-filter ionized calcium describes anticoagulant effect')
  })

  it('CRRT-18 states that no recovery trajectory exists and shows the single supplied values', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-18')} />)
    const scope = sectionFor(/What this case can show you/)
    expect(scope).toHaveTextContent('2.9 mg/dL')
    expect(scope).toHaveTextContent('5 mL/h')
    expect(scope).toHaveTextContent('0 mL/min')
    expect(scope).toHaveTextContent('A recovery trend')
    expect(scope).toHaveTextContent('There is no second time point and no improving signal')
    expect(scope).toHaveTextContent('Renal recovery, a falling creatinine, rising urine output')
  })

  it('CRRT-18 no longer claims its recovery signals are improving', () => {
    const definition = getBaxterCrrtCase('CRRT-18')
    const copy = [
      definition.patientDescription,
      ...definition.visibleFindings,
      ...definition.learningObjectives,
      ...definition.hiddenMechanism.causalChain,
    ].join(' ')
    expect(copy).not.toMatch(/recovery signals are improving/i)
    expect(copy).not.toMatch(/recovery signals improve/i)
    render(<Player definition={definition} />)
    expect(screen.queryByText(/Several recovery signals/)).toBeNull()
  })

  it('CRRT-17 no longer claims linked calcium trends it does not carry', () => {
    const definition = getBaxterCrrtCase('CRRT-17')
    const copy = [
      definition.patientDescription,
      ...definition.visibleFindings,
      ...definition.hiddenMechanism.causalChain,
    ].join(' ')
    expect(copy).not.toMatch(/Linked calcium, acid-base, circuit, and treatment-delivery trends/i)
    expect(copy).not.toMatch(/conceptual dashboard/i)
  })

  it('CRRT-05 separates the conceptual tradeoff from what the simulation calculates', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-05')} />)
    const scope = sectionFor(/What this case can show you/)
    expect(scope).toHaveTextContent('Filtration fraction for each split')
    expect(scope).toHaveTextContent(
      'fixed model coefficient, not a quantity calculated from the flows',
    )
    expect(scope).toHaveTextContent(
      'those values are identical because nothing couples them to the split',
    )
    expect(scope).toHaveTextContent('Neither split is universally preferred')
  })

  it('CRRT-16 separates supplied history from the current run and from a plan', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-16')} />)
    const scope = sectionFor(/What this case can show you/)
    expect(scope).toHaveTextContent('supplied history')
    expect(scope).toHaveTextContent('The earlier failed circuits')
    expect(scope).toHaveTextContent('They exist only in the case description')
    expect(scope).toHaveTextContent('A filter exchange, or any effect of your plan on this circuit')
    expect(scope).toHaveTextContent('it does not change the running circuit')
  })

  it('CRRT-11 names the held blood pressure as a model limit before the learner acts', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-11')} />)
    const scope = sectionFor(/What this case can show you/)
    expect(scope).toHaveTextContent('Blood-pressure, heart-rate or vasopressor response')
    expect(scope).toHaveTextContent('never writes mean arterial pressure')
  })
})

describe('the debrief separates action time, elapsed time and downtime', () => {
  it('attributes the hour a CRRT-11 action carries to the action, not to the learner', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-11')} />)
    performAction(/Assess/i)
    performAction(/Reduce/i)
    click('+1 hr')
    click('End run and review debrief')

    const evidence = sectionFor(/What you did in this run/)
    const timeHeading = within(evidence).getByRole('heading', {
      name: /Where this run’s simulated time came from/,
    })
    const grid = timeHeading.nextElementSibling as HTMLElement
    expect(grid).toHaveTextContent('Total simulated time elapsed')
    expect(grid).toHaveTextContent('Advanced by you')
    expect(grid).toHaveTextContent('Carried by the case actions you performed')
    expect(evidence).toHaveTextContent('carried its own 1 hr observation interval')
    expect(evidence).toHaveTextContent('Two runs can only be compared at the same elapsed time')
  })

  it('warns the action advances the clock before it is performed', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-11')} />)
    const card = screen
      .getAllByRole('article')
      .find((candidate) => /Reduce/i.test(candidate.textContent ?? ''))!
    expect(card).toHaveTextContent('advances the simulated clock by 1 hr')
    expect(card).toHaveTextContent('its authored observation interval')
  })

  it('reports a same-timestamp CRRT-13 pause and resume as zero downtime and explains it', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-13')} />)
    performAction(/Assess the patient and treatment/i)
    performAction(/Advance to the worsening pattern/i)
    performAction(/Inspect the access catheter/i)
    performAction(/Pause treatment while correcting/i)
    performAction(/Reposition the access/i)
    performAction(/Resume after correcting/i)
    click('End run and review debrief')

    const evidence = sectionFor(/What you did in this run/)
    expect(evidence).toHaveTextContent('Pausing, elapsed time, and downtime')
    expect(evidence).toHaveTextContent('Delivery pauses or stops you recorded')
    expect(evidence).toHaveTextContent('Downtime accumulated')
    expect(evidence).toHaveTextContent(
      'you paused and resumed at the same simulated timestamp, so no downtime was charged',
    )
    expect(evidence).toHaveTextContent('Advance simulated time while delivery is paused')
  })

  it('shows the bounded model indices and names the signals it holds static', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-11')} />)
    click('+1 hr')
    click('+1 hr')
    click('End run and review debrief')

    const evidence = sectionFor(/What you did in this run/)
    expect(evidence).toHaveTextContent('Tolerance-stress index')
    expect(evidence).toHaveTextContent('Intravascular reserve remaining')
    expect(evidence).toHaveTextContent('A bounded 0-1 model index')
    expect(evidence).toHaveTextContent('Mean arterial pressure (supplied, held)')
    expect(evidence).toHaveTextContent('models no blood-pressure or vasopressor response')
    expect(evidence).toHaveTextContent('Blood flow set')
    expect(evidence).toHaveTextContent('Blood flow through the circuit at the end of this run')
  })
})

describe('Batch-01 debrief truth still holds', () => {
  it('keeps the supplied teaching path, the run timeline and the reassessment separate', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-11')} />)
    performAction(/Assess/i)
    click('End run and review debrief')

    expect(
      screen.getByRole('heading', { name: 'Supplied teaching path · worked example' }),
    ).toBeInTheDocument()
    const evidence = sectionFor(/What you did in this run/)
    expect(evidence).toHaveTextContent(
      'Not recorded. The recommended reassessment below is the authored answer',
    )
    expect(screen.queryByText('Run reviewed')).toBeNull()
  })

  it('says no run was performed when only the explanation was opened', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-17')} />)
    click('Explain this case')
    click('End run and review debrief')
    expect(screen.getByText(/Debrief opened · no run performed/)).toBeInTheDocument()
    expect(
      screen.getByText(/You have not performed a case action or advanced simulated time/),
    ).toBeInTheDocument()
  })
})

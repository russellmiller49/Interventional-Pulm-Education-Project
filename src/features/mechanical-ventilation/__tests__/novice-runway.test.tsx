import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { MechanicalVentilationLearnLandingV2 } from '../components/MechanicalVentilationLearnLandingV2'
import { MechanicalVentilationNoviceRunway } from '../components/MechanicalVentilationNoviceRunway'
import { MechanicalVentilationTeachingPanel } from '../components/MechanicalVentilationTeachingPanel'
import { ventilatorDeviceProfiles } from '../content'
import { createInitialSimulationState } from '../engine'
import { ventilationLearningUnits } from '../content/learningCurriculum'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}))

/**
 * The novice runway, and the two claims it exists to settle.
 *
 * The external walkthrough rated the module a strong intermediate reasoning simulator that is not
 * yet an ideal first exposure. These pin what the runway has to carry, that it sits ahead of the
 * sections without gating any of them, and that the simple controlled-variable model it hands the
 * learner is explicitly put down again later rather than left standing as an absolute.
 */
describe('mechanical ventilation novice runway', () => {
  it('replaces the untracked primer with a traversable foundation and keeps every unit reachable', () => {
    render(<MechanicalVentilationLearnLandingV2 />)
    expect(screen.queryByRole('heading', { name: /New to ventilators/i })).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'From a breath to a bedside decision.' }),
    ).toBeInTheDocument()
    for (const unit of ventilationLearningUnits) {
      const link = screen.getByRole('link', {
        name: new RegExp(unit.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      })
      expect(link).toHaveAttribute('href', `/mechanical-ventilation/learn?activity=${unit.id}`)
      expect(link).not.toHaveAttribute('aria-disabled', 'true')
    }
  })

  it('places the normal breath and core measurements before modes', () => {
    const ids = ventilationLearningUnits.map((unit) => unit.id)
    expect(ids[0]).toBe('breathing-with-support')
    expect(ids.indexOf('modes-and-breath-delivery')).toBeGreaterThan(
      ids.indexOf('mechanics-load-and-pressure'),
    )
    expect(ids.indexOf('expiration-and-air-trapping')).toBeLessThan(
      ids.indexOf('dyssynchrony-mechanisms'),
    )
  })

  describe('the controls', () => {
    const expected = [
      'Oxygen (FiO₂)',
      'PEEP',
      'Tidal volume',
      'Respiratory rate',
      'Inspiratory flow',
      'Inspiratory time',
      'Pressure support',
      'Trigger sensitivity',
      'Cycling threshold',
    ]

    it('offers every core control the package names', () => {
      render(<MechanicalVentilationNoviceRunway />)
      for (const label of expected) {
        expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
      }
    })

    /**
     * The shape is the teaching point: a control that is described only by what it changes invites
     * the learner to treat it as a guarantee, which is the misreading the whole module is about.
     */
    it('gives each one what it changes, what it does not promise, and what to reassess', () => {
      render(<MechanicalVentilationNoviceRunway />)
      for (const label of expected) {
        fireEvent.click(screen.getByRole('button', { name: label }))
        expect(screen.getByText(`${label} — what it changes`)).toBeInTheDocument()
        const changes = screen.getByText(`${label} — what it changes`).nextElementSibling
        expect(changes?.textContent?.length ?? 0).toBeGreaterThan(40)

        expect(screen.getByText('What it does not guarantee')).toBeInTheDocument()
        const promise = screen.getByText('What it does not guarantee').nextElementSibling
        expect(promise?.textContent?.length ?? 0).toBeGreaterThan(40)

        expect(screen.getByText('What to reassess afterwards')).toBeInTheDocument()
        const reassess = screen.getByText('What to reassess afterwards').nextElementSibling
        expect(reassess?.textContent?.length ?? 0).toBeGreaterThan(20)
      }
    })
  })

  describe('one normal breath', () => {
    it('walks the whole sequence from trigger to expiration', () => {
      render(<MechanicalVentilationNoviceRunway />)
      fireEvent.click(screen.getByRole('button', { name: 'One normal breath' }))

      for (const stage of ['Trigger', 'Inspiration', 'What is held', 'Cycle', 'Expiration']) {
        const button = screen.getByRole('button', { name: stage })
        fireEvent.click(button)
        expect(button).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText(stage, { selector: 'span' })).toBeInTheDocument()
      }
    })

    it('names what pressure, flow, and volume each do, in a text equivalent', () => {
      render(<MechanicalVentilationNoviceRunway />)
      fireEvent.click(screen.getByRole('button', { name: 'One normal breath' }))

      const figure = screen.getByRole('img', { name: /three stacked traces/i })
      const label = figure.getAttribute('aria-label') ?? ''
      expect(label).toMatch(/pressure/i)
      expect(label).toMatch(/flow/i)
      expect(label).toMatch(/volume/i)
      // The figure is drawn, so it has to be readable without seeing it.
      expect(screen.getByText(/Visual text equivalent/i)).toBeInTheDocument()
    })
  })

  describe('the mode crosswalk', () => {
    it('separates the generic breath questions from the product labels', () => {
      render(<MechanicalVentilationNoviceRunway />)
      fireEvent.click(screen.getByRole('button', { name: 'Mode names' }))

      const table = screen.getByLabelText('Generic breath types and device names')
      const text = table.textContent ?? ''

      // The three questions carry across devices...
      expect(text).toMatch(/Starts:/)
      expect(text).toMatch(/Holds:/)
      expect(text).toMatch(/Ends:/)

      // ...and the vendor names are shown as examples, attributed to a console.
      expect(within(table).getAllByText('Examples').length).toBeGreaterThan(0)
      const c6 = ventilatorDeviceProfiles.find((profile) => profile.shortName === 'C6')
      const volumeAc = c6?.modes.find((mode) => mode.id === 'volume-ac')
      expect(volumeAc).toBeDefined()
      expect(text).toContain(`${volumeAc?.label} (C6)`)
      expect(text).toMatch(/Called, on the consoles in this module/i)
    })

    it('covers the assist/control, support, and SIMV families', () => {
      render(<MechanicalVentilationNoviceRunway />)
      fireEvent.click(screen.getByRole('button', { name: 'Mode names' }))
      const text = screen.getByLabelText('Generic breath types and device names').textContent ?? ''
      expect(text).toMatch(/Volume assist\/control/i)
      expect(text).toMatch(/Pressure assist\/control/i)
      expect(text).toMatch(/Pressure support/i)
      expect(text).toMatch(/SIMV/i)
    })
  })

  describe('starting a patient', () => {
    it('teaches predicted body weight without stating a treatment target', () => {
      render(<MechanicalVentilationNoviceRunway />)
      fireEvent.click(screen.getByRole('button', { name: 'Starting a patient' }))

      const text = document.body.textContent ?? ''
      expect(text).toMatch(/predicted body weight/i)
      // What it is derived from, which is the part that is actually misunderstood.
      expect(text).toMatch(/height/i)
      // And an explicit refusal to supply the number the source layer withholds.
      expect(text).toMatch(/does not state one/i)
    })

    it('states no universal numeric target anywhere in the runway', () => {
      const { container } = render(<MechanicalVentilationNoviceRunway />)
      for (const panel of [
        'The controls',
        'One normal breath',
        'Mode names',
        'Starting a patient',
        'Urgent, or abnormal?',
      ]) {
        fireEvent.click(screen.getByRole('button', { name: panel }))
        const text = container.textContent ?? ''
        expect(text).not.toMatch(/should be (below|above|less than|greater than|under|over)\s*\d/i)
        expect(text).not.toMatch(/\btarget of\s*\d/i)
        expect(text).not.toMatch(/keep .{0,24}\b(below|under|above)\s*\d/i)
        expect(text).not.toMatch(/\bmL\/kg\b\s*\d/i)
        expect(text).not.toMatch(/\baim for\s*\d/i)
      }
    })
  })

  it('distinguishes a finding that needs stabilizing from one that can be localized', () => {
    render(<MechanicalVentilationNoviceRunway />)
    fireEvent.click(screen.getByRole('button', { name: 'Urgent, or abnormal?' }))

    const table = screen.getByLabelText('How urgent an abnormal finding is')
    expect(within(table).getByText('Act now')).toBeInTheDocument()
    expect(within(table).getByText('Deliberate')).toBeInTheDocument()
    expect(table.textContent).toMatch(/Stabilize first/i)
    expect(table.textContent).toMatch(/Localize first/i)
  })

  it('claims supervised learning rather than readiness to practise alone', () => {
    render(<MechanicalVentilationNoviceRunway />)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/supports supervised learning/i)
    expect(text).toMatch(/does not establish that you are ready to manage a ventilated patient/i)
  })
})

/**
 * The simple model is a scaffold, and a scaffold has to come down.
 *
 * Section 1 tells the learner a ventilator sets one of pressure or volume and cannot set both. That
 * is what makes a trace readable at sight and it is worth keeping — but the adaptive and
 * dual-control modes do not fit it, and the module models six of them. The caveat therefore has to
 * exist, and it has to arrive *after* the simple rule rather than alongside it.
 */
describe('the adaptive and dual-control caveat', () => {
  function stateFor(caseId: string) {
    return createInitialSimulationState(caseId, 'learn', 1, 'hamilton-c6')
  }

  it('leaves the simple rule standing in the opening section', () => {
    render(
      <MechanicalVentilationTeachingPanel lessonId="waveform-anatomy" state={stateFor('MV-01')} />,
    )
    expect(screen.getByText(/It cannot set both/i)).toBeInTheDocument()
    expect(screen.queryByText(/dual-control/i)).not.toBeInTheDocument()
  })

  it('qualifies it in the Modes section, under the active console’s own names', () => {
    render(
      <MechanicalVentilationTeachingPanel
        lessonId="modes-and-breath-delivery"
        state={stateFor('MV-02')}
      />,
    )
    expect(screen.getByText(/Where the one-of-two rule stops being exact/i)).toBeInTheDocument()

    const body = document.body.textContent ?? ''
    expect(body).toMatch(/adaptive or dual-control modes are where it stops being exact/i)
    // Pressure within a breath, volume across breaths — the thing the simple model cannot express.
    expect(body).toMatch(/across breaths/i)

    // Named from the source-bound profile rather than a hardcoded list.
    const c6 = ventilatorDeviceProfiles.find((profile) => profile.shortName === 'C6')
    const adaptive = c6?.modes.find((mode) => mode.id === 'adaptive-pressure-ac')
    expect(adaptive).toBeDefined()
    expect(body).toContain(adaptive?.label)
  })

  it('flags the consequence that makes it matter at the bedside', () => {
    render(
      <MechanicalVentilationTeachingPanel
        lessonId="modes-and-breath-delivery"
        state={stateFor('MV-02')}
      />,
    )
    // A stable volume can hide a climbing pressure, so the pressure trace is the one to read.
    expect(document.body.textContent).toMatch(/Read the pressure trace on these modes/i)
  })
})

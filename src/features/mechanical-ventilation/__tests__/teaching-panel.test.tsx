import { fireEvent, render, screen, within } from '@testing-library/react'

import {
  MechanicalVentilationTeachingPanel,
  hasVentilationTeachingPanel,
  ventilationTeachingPanelSectionIds,
} from '../components/MechanicalVentilationTeachingPanel'
import { mechanicalVentilationLessons } from '../content'
import { createInitialSimulationState, ventilationSimulationReducer } from '../engine'
import type { VentilationSimulationState } from '../engine'

function stateFor(caseId: string, seconds = 12): VentilationSimulationState {
  let state = createInitialSimulationState(caseId, 'learn', 1, 'hamilton-c6')
  for (let tick = 0; tick < seconds * 10; tick += 1) {
    state = ventilationSimulationReducer(state, { type: 'TICK', seconds: 0.1 })
  }
  return state
}

describe('mechanical-ventilation teaching panels', () => {
  it('declares panels only for sections that exist in the pathway', () => {
    const lessonIds = new Set(mechanicalVentilationLessons.map((lesson) => lesson.id))
    for (const sectionId of ventilationTeachingPanelSectionIds) {
      expect(lessonIds.has(sectionId)).toBe(true)
      expect(hasVentilationTeachingPanel(sectionId)).toBe(true)
    }
    expect(hasVentilationTeachingPanel('modes-and-breath-delivery')).toBe(false)
  })

  it('renders nothing for a section without an authored panel', () => {
    const { container } = render(
      <MechanicalVentilationTeachingPanel
        lessonId="modes-and-breath-delivery"
        state={stateFor('MV-13')}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  describe('pressure decomposition', () => {
    it('splits peak pressure into baseline, elastic, and resistive components that sum back', () => {
      const state = stateFor('MV-13')
      render(
        <MechanicalVentilationTeachingPanel lessonId="mechanics-load-and-pressure" state={state} />,
      )

      const figure = screen.getByRole('img', { name: /Peak airway pressure/i })
      const label = figure.getAttribute('aria-label') ?? ''
      const numbers = label.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
      const [peak, baseline, , , elastic, resistive] = numbers
      expect(peak).toBeGreaterThan(0)
      expect(baseline + elastic + resistive).toBeCloseTo(peak, 1)
    })

    it('explains a component only after the learner selects it', () => {
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="mechanics-load-and-pressure"
          state={stateFor('MV-13')}
        />,
      )
      expect(screen.getByText(/Equation of motion/i)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Resistive' }))
      expect(screen.getByText(/disappears during a hold/i)).toBeInTheDocument()
    })
  })

  describe('waveform reading sequence', () => {
    it('starts on pressure and moves to whichever step the learner selects', () => {
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="waveform-reading-sequence"
          state={stateFor('MV-03')}
        />,
      )
      expect(screen.getByRole('button', { name: /^Pressure Shape first/i })).toHaveAttribute(
        'aria-current',
        'step',
      )
      fireEvent.click(screen.getByRole('button', { name: /^Expiratory flow Does it return/i }))
      expect(
        screen.getByRole('button', { name: /^Expiratory flow Does it return/i }),
      ).toHaveAttribute('aria-current', 'step')
      expect(screen.getByText(/the single most informative part of the trace/i)).toBeInTheDocument()
    })
  })

  describe('high-pressure discriminator', () => {
    it('shows no comparison until a mechanism is selected', () => {
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="high-peak-pressure-integration"
          state={stateFor('MV-13')}
        />,
      )
      expect(screen.getByText(/Before selecting/i)).toBeInTheDocument()
      expect(screen.queryByText('Consistent')).not.toBeInTheDocument()
    })

    it('never claims patient effort argues against a resistive mechanism', () => {
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="high-peak-pressure-integration"
          state={stateFor('MV-13')}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /Resistive: tube/i }))

      const effortRow = screen
        .getByText(/Patient effort this breath/i)
        .closest('div') as HTMLElement
      // Effort presence does not weigh against a resistive rise; it simply does not discriminate.
      expect(within(effortRow).queryByText('Argues against')).not.toBeInTheDocument()
    })

    it('treats plateau comparisons as invalid while the patient is making effort', () => {
      const effortfulCase = stateFor('MV-03')
      const anyEffort = effortfulCase.waveforms.some((sample) => sample.pmusCmH2O < -1.5)
      expect(anyEffort).toBe(true)

      render(
        <MechanicalVentilationTeachingPanel
          lessonId="high-peak-pressure-integration"
          state={effortfulCase}
        />,
      )
      fireEvent.click(
        screen.getByRole('button', { name: /Reduced respiratory-system compliance/i }),
      )
      expect(screen.getAllByText('Measurement invalid').length).toBeGreaterThan(0)
    })
  })
})

import { fireEvent, render, screen, within } from '@testing-library/react'

import {
  MechanicalVentilationTeachingPanel,
  VentilationRunControl,
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
  })

  /** Every section of the pathway now has one, so the overview fallback is a safety net only. */
  it('gives every Learn section an authored panel', () => {
    for (const lesson of mechanicalVentilationLessons) {
      expect(hasVentilationTeachingPanel(lesson.id)).toBe(true)
    }
    expect(ventilationTeachingPanelSectionIds).toHaveLength(mechanicalVentilationLessons.length)
  })

  it('renders nothing for a section id that is not in the pathway', () => {
    const { container } = render(
      <MechanicalVentilationTeachingPanel lessonId="not-a-section" state={stateFor('MV-13')} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  /**
   * The whole set has to survive every case in the casebook — several panels read optional
   * measurements (plateau, effort, trends) that some cases never produce.
   */
  it('renders every panel for every case without throwing', () => {
    for (const lesson of mechanicalVentilationLessons) {
      for (const caseId of lesson.relatedCaseIds) {
        const { container, unmount } = render(
          <MechanicalVentilationTeachingPanel lessonId={lesson.id} state={stateFor(caseId, 20)} />,
        )
        expect(container.querySelector('section')).toBeInTheDocument()
        unmount()
      }
    }
  })

  it('never states a numeric threshold as a target in any panel', () => {
    for (const lesson of mechanicalVentilationLessons) {
      const { container, unmount } = render(
        <MechanicalVentilationTeachingPanel lessonId={lesson.id} state={stateFor('MV-01', 20)} />,
      )
      const text = container.textContent ?? ''
      expect(text).not.toMatch(/should be (below|above|less than|greater than|under|over)\s*\d/i)
      expect(text).not.toMatch(/\btarget of\s*\d/i)
      expect(text).not.toMatch(/keep .{0,24}\b(below|under|above)\s*\d/i)
      unmount()
    }
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

  /**
   * The measurement every number in the mechanics panel depends on, and the one most reliably
   * misread: a plateau taken in a patient who is not relaxed.
   */
  describe('plateau validity', () => {
    it('states that the plateau is not interpretable while the patient is pulling', () => {
      const active = stateFor('MV-01', 14)
      expect(active.measurements.plateauIsInterpretable).toBe(false)
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="mechanics-load-and-pressure"
          state={active}
        />,
      )
      expect(screen.getByText('Plateau not interpretable')).toBeInTheDocument()
      expect(screen.getByText(/makes a plateau read/i)).toBeInTheDocument()
      // The direction of the error is the whole point: a stiff lung can look safe.
      expect(screen.getByText(/can look safe/i)).toBeInTheDocument()
      expect(screen.getByText(/has to be relaxed/i)).toBeInTheDocument()
    })

    it('names both numbers so the size of the error is visible', () => {
      const active = stateFor('MV-01', 14)
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="mechanics-load-and-pressure"
          state={active}
        />,
      )
      // The text is interpolated across nodes, so read the whole note.
      const note = screen.getByRole('note').textContent ?? ''
      expect(note).toContain(String(active.measurements.plateauPressureCmH2O))
      expect(note).toContain(String(active.measurements.relaxedPlateauPressureCmH2O))
      expect(note).toContain(String(active.measurements.endInspiratoryEffortCmH2O))
    })

    it('confirms the conditions instead when the patient is passive', () => {
      const passive = stateFor('MV-01', 14)
      const relaxed: VentilationSimulationState = {
        ...passive,
        measurements: {
          ...passive.measurements,
          plateauIsInterpretable: true,
          endInspiratoryEffortCmH2O: 0,
        },
      }
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="mechanics-load-and-pressure"
          state={relaxed}
        />,
      )
      expect(screen.getByText('Measurement conditions met')).toBeInTheDocument()
      expect(screen.queryByText('Plateau not interpretable')).not.toBeInTheDocument()
    })

    it('carries the caveat into the figure’s text equivalent', () => {
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="mechanics-load-and-pressure"
          state={stateFor('MV-01', 14)}
        />,
      )
      expect(screen.getByText(/does not report mechanics alone/i)).toBeInTheDocument()
    })
  })

  describe('mode variables', () => {
    it('names the four breath variables of the active mode alongside the console’s own label', () => {
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="modes-and-breath-delivery"
          state={stateFor('MV-01')}
        />,
      )
      for (const variable of ['Trigger', 'Target', 'Cycle', 'Expiration']) {
        expect(screen.getByRole('button', { name: variable })).toBeInTheDocument()
      }
      // (S)CMV is the C6's label for volume A/C; the behavior column must not use it.
      expect(screen.getByText('(S)CMV')).toBeInTheDocument()
    })

    it('narrows to one variable once selected', () => {
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="modes-and-breath-delivery"
          state={stateFor('MV-01')}
        />,
      )
      const table = screen.getByLabelText('Breath variables of the active mode')
      expect(within(table).getAllByText(/^(What|Set on this console by:)/).length).toBeGreaterThan(
        4,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Cycle' }))
      expect(screen.getByText(/What ends inspiration\?/)).toBeInTheDocument()
      expect(screen.queryByText(/What starts the breath\?/)).not.toBeInTheDocument()
    })
  })

  describe('trigger and cycle', () => {
    /**
     * Neural inspiration is one effort, not the span from the first effort to the last. A window
     * holding several ineffective efforts used to report many seconds, which is not a breath.
     */
    it('reports a neural inspiration no longer than the breath window it came from', () => {
      const dyssynchronous = stateFor('MV-07', 20)
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="triggering-and-cycling"
          state={dyssynchronous}
        />,
      )
      const neural = screen.getByText('Neural inspiration').parentElement
      const seconds = Number(neural?.querySelector('dd')?.textContent?.replace(/[^\d.]/g, ''))
      expect(Number.isNaN(seconds)).toBe(false)
      // A cycle at the case's own rate; a neural inspiration cannot exceed it.
      expect(seconds).toBeLessThan(60 / dyssynchronous.measurements.totalRatePerMin)
    })

    it('switches which transition the detail describes', () => {
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="triggering-and-cycling"
          state={stateFor('MV-07')}
        />,
      )
      expect(screen.getByText(/Did the effort that started this breath/)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Cycle' }))
      expect(screen.getByText(/Did inspiration end when the patient stopped/)).toBeInTheDocument()
    })
  })

  describe('dyssynchrony domains', () => {
    it('shows no evidence table until a domain is committed to', () => {
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="dyssynchrony-mechanisms"
          state={stateFor('MV-07')}
        />,
      )
      expect(screen.getByText(/the pattern name comes last/i)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Load' }))
      expect(screen.getByLabelText(/Live signals bearing on Load/)).toBeInTheDocument()
      expect(screen.getByText(/Peak-to-plateau difference/)).toBeInTheDocument()
    })

    it('never leaves a plateau-derived row claiming a verdict it has not measured', () => {
      const noHold = stateFor('MV-01')
      expect(noHold.measurements.plateauPressureCmH2O).toBeGreaterThanOrEqual(0)
      render(
        <MechanicalVentilationTeachingPanel lessonId="dyssynchrony-mechanisms" state={noHold} />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Load' }))
      const rows = screen.getByLabelText(/Live signals bearing on Load/)
      if (noHold.measurements.plateauPressureCmH2O === 0) {
        expect(within(rows).getAllByText('Not measured').length).toBeGreaterThan(0)
      }
      expect(within(rows).queryByText('Argues against')).not.toBeInTheDocument()
    })
  })

  describe('oxygenation trade-off', () => {
    it('shows the cost column at the same time as the benefit column', () => {
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="oxygenation-response"
          state={stateFor('MV-01')}
        />,
      )
      expect(screen.getByText('What it buys')).toBeInTheDocument()
      expect(screen.getByText('What it costs')).toBeInTheDocument()
      expect(screen.getByText('Mean arterial pressure')).toBeInTheDocument()
    })

    it('states a cost and a limit for every lever, not only a benefit', () => {
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="oxygenation-response"
          state={stateFor('MV-01')}
        />,
      )
      for (const lever of ['Inspired oxygen', 'Baseline pressure', 'Mean airway pressure']) {
        fireEvent.click(screen.getByRole('button', { name: lever }))
        expect(screen.getAllByText('What it costs').length).toBeGreaterThan(0)
        expect(screen.getByText('What limits it')).toBeInTheDocument()
      }
    })
  })

  describe('safety reassessment', () => {
    it('sorts active alarms by where the answer lives, patient first', () => {
      const deteriorating = stateFor('MV-06', 20)
      render(
        <MechanicalVentilationTeachingPanel
          lessonId="safety-reassessment-and-human-factors"
          state={deteriorating}
        />,
      )
      const loci = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent)
      expect(loci).toEqual(['The patient', 'The circuit', 'The ventilator', 'The person'])
      // Every active alarm has to land in exactly one of the four groups.
      const figure = screen.getByLabelText(/alarm/i)
      for (const alarm of deteriorating.alarms) {
        expect(within(figure).getAllByText(alarm.message).length).toBe(1)
      }
    })
  })

  /**
   * Stepping pauses the run. That is the right behavior for a step control, but it was unlabelled,
   * so the console read as stopping on its own.
   */
  describe('run control', () => {
    it('names the pause that stepping causes while the simulation is running', () => {
      render(
        <VentilationRunControl
          paused={false}
          simulationTime={12}
          onToggle={jest.fn()}
          onStepBreath={jest.fn()}
        />,
      )
      expect(screen.getByRole('button', { name: 'Pause + step one breath' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Step one breath' })).not.toBeInTheDocument()
      expect(screen.getByText(/Stepping pauses the run/i)).toBeInTheDocument()
    })

    it('drops the pause from the step label once the run is already paused', () => {
      render(
        <VentilationRunControl
          paused
          simulationTime={12}
          onToggle={jest.fn()}
          onStepBreath={jest.fn()}
        />,
      )
      expect(screen.getByRole('button', { name: 'Step one breath' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Start ventilation' })).toBeInTheDocument()
      expect(screen.getByText(/stays paused/i)).toBeInTheDocument()
    })

    it('announces the running state so the transition is not silent', () => {
      render(
        <VentilationRunControl
          paused={false}
          simulationTime={12}
          onToggle={jest.fn()}
          onStepBreath={jest.fn()}
        />,
      )
      const status = screen.getByRole('status')
      expect(within(status).getByText(/Running · 12 s/)).toBeInTheDocument()
    })
  })
})

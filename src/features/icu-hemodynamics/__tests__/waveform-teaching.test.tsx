import { fireEvent, render, screen, within } from '@testing-library/react'

import {
  ARTIFACT_IDS,
  artifactDefinitions,
  troubleshootingEntries,
  troubleshootingReferenceRows,
  waveformAtlasEntries,
  waveformValueAt,
  westZones,
  wedgeValidityChecks,
} from '../content'
import { TroubleshootingPanel } from '../components/TroubleshootingPanel'
import { WaveformAtlasFigure } from '../components/WaveformAtlasFigure'
import { WaveformAtlasPanel } from '../components/WaveformAtlasPanel'
import { WaveformRecognitionDrill } from '../components/WaveformRecognitionDrill'
import { WedgeValidityPanel } from '../components/WedgeValidityPanel'
import { hemodynamicsSourceById } from '../content/sources'
import { waveformAtlasById } from '../content/waveformAtlas'

describe('waveform atlas content', () => {
  it('cites only registered sources', () => {
    for (const entry of waveformAtlasEntries) {
      for (const sourceId of entry.sourceIds) {
        expect(hemodynamicsSourceById.get(sourceId)).toBeDefined()
      }
    }
    for (const entry of troubleshootingEntries) {
      for (const sourceId of entry.sourceIds) {
        expect(hemodynamicsSourceById.get(sourceId)).toBeDefined()
      }
    }
  })

  it('keeps every generated trace inside its own displayed scale', () => {
    for (const entry of waveformAtlasEntries) {
      for (let step = 0; step <= 200; step += 1) {
        const value = waveformValueAt(entry.trace, step / 200)
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(-2)
        expect(value).toBeLessThanOrEqual(entry.scaleMaxMmHg)
      }
    }
  })

  it('anchors every annotation to a real point on its trace', () => {
    for (const entry of waveformAtlasEntries) {
      for (const annotation of entry.annotations) {
        expect(annotation.phase).toBeGreaterThanOrEqual(0)
        expect(annotation.phase).toBeLessThanOrEqual(1)
        expect(Number.isFinite(waveformValueAt(entry.trace, annotation.phase))).toBe(true)
      }
    }
  })

  it('covers the full advancement sequence in order', () => {
    const insertion = waveformAtlasEntries.filter((entry) => entry.category === 'insertion')
    expect(insertion.map((entry) => entry.position)).toEqual(['ra', 'rv', 'pa', 'wedge'])
  })

  it('teaches RA and CVP as one end-expiratory signal during controlled positive pressure', () => {
    const rightAtrium = waveformAtlasById.get('ra-normal')!
    expect(rightAtrium.summary).toMatch(/RA and CVP are the same pressure signal/i)
    expect(rightAtrium.recognitionCues.join(' ')).toMatch(
      /positive-pressure ventilation.*rise during inspiration.*end expiration is the trough.*base of the c wave/i,
    )
    expect(rightAtrium.pitfall).toMatch(/inspiratory peak.*one-beat average/i)
    expect(rightAtrium.sourceIds).toContain('cvp-measurement-2017')
  })

  it('teaches the right ventricle and pulmonary artery apart by diastolic contour', () => {
    const rightVentricle = waveformAtlasById.get('rv-normal')
    const pulmonaryArtery = waveformAtlasById.get('pa-normal')
    const rvDiastole = rightVentricle!.annotations.find((item) => item.id === 'diastole')
    const paDiastole = pulmonaryArtery!.annotations.find((item) => item.id === 'diastole')
    expect(rvDiastole?.label).toContain('up-sloping')
    expect(paDiastole?.label).toContain('down-sloping')

    // The trace itself must match what the annotation claims.
    expect(waveformValueAt(rightVentricle!.trace, 0.95)).toBeGreaterThan(
      waveformValueAt(rightVentricle!.trace, 0.6),
    )
    expect(waveformValueAt(pulmonaryArtery!.trace, 0.95)).toBeLessThan(
      waveformValueAt(pulmonaryArtery!.trace, 0.6),
    )
  })

  it('gives the wedge no c wave and a v wave taller than its a wave', () => {
    const wedge = waveformAtlasById.get('wedge-normal')!
    expect(wedge.annotations.map((item) => item.id)).not.toContain('c')
    const aWave = wedge.annotations.find((item) => item.id === 'a')!
    const vWave = wedge.annotations.find((item) => item.id === 'v')!
    expect(waveformValueAt(wedge.trace, vWave.phase)).toBeGreaterThan(
      waveformValueAt(wedge.trace, aWave.phase),
    )
  })

  it('blunts the y descent on the tamponade tracing but not the x descent', () => {
    const tamponade = waveformAtlasById.get('ra-tamponade')!
    const normal = waveformAtlasById.get('ra-normal')!
    const depthBelowMean = (entry: typeof normal, phase: number, mean: number) =>
      mean - waveformValueAt(entry.trace, phase)

    const normalY = depthBelowMean(normal, 0.6, 4)
    const tamponadeY = depthBelowMean(tamponade, 0.6, 18)
    expect(tamponadeY).toBeLessThan(normalY)
    expect(depthBelowMean(tamponade, 0.26, 18)).toBeGreaterThan(tamponadeY)
  })
})

describe('WaveformAtlasFigure', () => {
  it('renders a labeled trace with an accessible description of every wave', () => {
    const entry = waveformAtlasById.get('ra-normal')!
    render(<WaveformAtlasFigure entry={entry} />)

    const figure = screen.getByRole('img')
    expect(figure).toHaveAccessibleName(expect.stringContaining('Right atrium'))
    expect(figure).toHaveAccessibleName(expect.stringContaining('Atrial contraction'))

    // Each wave component appears in the legend.
    for (const annotation of entry.annotations) {
      expect(screen.getAllByText(annotation.label).length).toBeGreaterThan(0)
    }
  })

  it('omits annotations when they are withheld', () => {
    const entry = waveformAtlasById.get('ra-normal')!
    const { container } = render(<WaveformAtlasFigure entry={entry} annotated={false} />)
    expect(container.querySelector('dl')).toBeNull()
  })
})

describe('WaveformAtlasPanel', () => {
  it('switches the displayed tracing and its teaching when a tab is chosen', () => {
    render(<WaveformAtlasPanel />)
    expect(screen.getAllByText(/three positive waves/i).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('tab', { name: 'RV' }))
    expect(screen.getByText(/Diastole slopes UP/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'PA' }))
    expect(screen.getByText(/Diastole slopes DOWN/i)).toBeInTheDocument()
    expect(screen.getByText(/dicrotic notch appears/i)).toBeInTheDocument()
  })

  it('can be limited to one category for a focused station', () => {
    render(<WaveformAtlasPanel onlyCategories={['insertion']} />)
    expect(screen.getByRole('tab', { name: 'RA' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Tamponade' })).not.toBeInTheDocument()
  })

  it('lets a focused wedge station return from a false pattern to the normal tracing', () => {
    render(
      <WaveformAtlasPanel
        initialEntryId="wedge-normal"
        onlyEntryIds={['wedge-normal', 'wedge-overwedged', 'wedge-hybrid']}
        tablistLabel="True and false wedge patterns"
      />,
    )

    const normalWedge = screen.getByRole('tab', { name: 'Normal wedge' })
    expect(normalWedge).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByRole('tab', { name: 'Over-wedge' }))
    expect(screen.getByText(/false wedge produced by a catheter tip/i)).toBeInTheDocument()

    fireEvent.click(normalWedge)
    expect(normalWedge).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/tracing collapses back to an atrial morphology/i)).toBeInTheDocument()
  })
})

describe('TroubleshootingPanel', () => {
  it('renders exactly the seven typed signal-problem tabs', () => {
    render(<TroubleshootingPanel />)
    expect(screen.getAllByRole('tab')).toHaveLength(ARTIFACT_IDS.length)
    for (const definition of Object.values(artifactDefinitions)) {
      expect(screen.getByRole('tab', { name: definition.shortLabel })).toBeInTheDocument()
    }
    expect(screen.queryByRole('tab', { name: /Valve strike/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Entrapment/i })).not.toBeInTheDocument()
  })

  it('supports arrow, Home, and End navigation across the troubleshooting tabs', () => {
    render(<TroubleshootingPanel />)
    const firstTab = screen.getByRole('tab', { name: 'Overdamped' })
    firstTab.focus()

    fireEvent.keyDown(firstTab, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Underdamped' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Underdamped' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Underdamped' }), { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Zero/level error' })).toHaveFocus()

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Zero/level error' }), { key: 'Home' })
    expect(firstTab).toHaveFocus()
  })

  it('changes the tracing, title, teaching, and actions for every selected tab', () => {
    render(<TroubleshootingPanel />)
    const waveformNames = new Set<string>()

    for (const id of ARTIFACT_IDS) {
      const definition = artifactDefinitions[id]
      fireEvent.click(screen.getByRole('tab', { name: definition.shortLabel }))
      expect(screen.getByRole('heading', { name: definition.label })).toBeInTheDocument()
      expect(screen.getByText(definition.appearance[0])).toBeInTheDocument()
      expect(screen.getByText(definition.actions[0])).toBeInTheDocument()
      const selectedTrace = screen.getByRole('img', {
        name: new RegExp(`^${definition.shortLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`),
      })
      waveformNames.add(selectedTrace.getAttribute('aria-label') ?? '')
    }

    expect(waveformNames.size).toBe(ARTIFACT_IDS.length)
  })

  it('derives the correct pressure directions for over- and underdamping', () => {
    const { container } = render(<TroubleshootingPanel />)
    const pressureCell = (label: 'Systolic' | 'Diastolic' | 'Mean' | 'Pulse pressure') => {
      const term = within(container).getByText(label)
      return term.parentElement as HTMLElement
    }

    expect(within(pressureCell('Systolic')).getByText('Falsely low')).toBeInTheDocument()
    expect(within(pressureCell('Diastolic')).getByText('Falsely high')).toBeInTheDocument()
    expect(within(pressureCell('Mean')).getByText('Relatively preserved')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Underdamped' }))
    expect(within(pressureCell('Systolic')).getByText('Falsely high')).toBeInTheDocument()
    expect(within(pressureCell('Diastolic')).getByText('Falsely low')).toBeInTheDocument()
    expect(screen.getByText(/mistaken for severe pulmonary hypertension/i)).toBeInTheDocument()
  })

  it('shifts every pressure together for level error while preserving pulse pressure', () => {
    render(<TroubleshootingPanel />)
    fireEvent.click(screen.getByRole('tab', { name: 'Zero/level error' }))
    expect(screen.getByText(/waveform shape and pulse pressure are unchanged/i)).toBeInTheDocument()
    expect(screen.getAllByText('Shifted high')).toHaveLength(3)
    expect(screen.getByText('Relatively preserved')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Zero\/level scenario/i), {
      target: { value: 'transducer-too-high' },
    })
    expect(screen.getAllByText('Shifted low')).toHaveLength(3)
    expect(screen.getByText(/shifts downward by approximately 7.4 mmHg/i)).toBeInTheDocument()
  })

  it('makes no-flush warnings prominent for spontaneous wedge and overwedging', () => {
    render(<TroubleshootingPanel />)
    fireEvent.click(screen.getByRole('tab', { name: 'Spontaneous wedge' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/do not fast-flush the distal lumen/i)

    fireEvent.click(screen.getByRole('tab', { name: 'Overwedging' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/Stop inflation immediately.*Do not flush/i)
  })

  it('provides the corrected responsive troubleshooting reference rows', () => {
    render(<TroubleshootingPanel />)
    fireEvent.click(screen.getByText('Corrected PA catheter troubleshooting reference'))
    for (const row of troubleshootingReferenceRows) {
      expect(screen.getByRole('rowheader', { name: row.problem })).toBeInTheDocument()
    }
    expect(screen.getByRole('rowheader', { name: 'RV migration' })).toBeInTheDocument()
    expect(
      screen.getByRole('rowheader', { name: 'Balloon failure or rupture' }),
    ).toBeInTheDocument()
  })
})

describe('WedgeValidityPanel', () => {
  it('marks zone 3 as the only zone that yields a valid wedge', () => {
    render(<WedgeValidityPanel />)
    const validZones = westZones.filter((zone) => zone.valid)
    expect(validZones).toHaveLength(1)
    expect(validZones[0].zone).toBe(3)
    expect(screen.getByText(/Zone 3 · Lung base/)).toBeInTheDocument()
  })

  it('names oximetry as the most confirmatory check', () => {
    render(<WedgeValidityPanel />)
    const definitive = wedgeValidityChecks.filter((check) => check.definitive)
    expect(definitive).toHaveLength(1)
    expect(definitive[0].id).toBe('oximetry')
    expect(screen.getAllByText(/most confirmatory/i).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/within about 5% of.*systemic arterial saturation/i).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByText(/usually at least 95% when the patient is not hypoxemic/i),
    ).toBeInTheDocument()
  })

  it('states the modeled PEEP transmission without presenting it as a bedside correction', () => {
    render(<WedgeValidityPanel />)
    expect(screen.getByText(/about 1.4 mmHg per 5 cmH₂O/i)).toBeInTheDocument()
    expect(screen.getByText(/not a bedside correction formula/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Arithmetic PEEP correction is not universally validated/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/mitral stenosis/i)).toBeInTheDocument()
  })
})

describe('WaveformRecognitionDrill', () => {
  it('withholds the identity of the tracing until the learner commits', () => {
    render(<WaveformRecognitionDrill />)
    expect(screen.getByText('Unidentified tracing')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check answer' })).toBeDisabled()
  })

  it('reveals the teaching for the correct tracing after an answer', () => {
    render(<WaveformRecognitionDrill />)
    fireEvent.click(screen.getByRole('radio', { name: 'Right ventricle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))

    expect(screen.getByText('Pattern identified.')).toBeInTheDocument()
    expect(screen.getByText('Reference tracing')).toBeInTheDocument()
    expect(screen.getByText(/Diastole slopes UP/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next tracing' })).toBeInTheDocument()
  })

  it('names the right answer when the learner is wrong', () => {
    render(<WaveformRecognitionDrill />)
    fireEvent.click(screen.getByRole('radio', { name: 'Pulmonary artery' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(screen.getByText(/This is right ventricle/i)).toBeInTheDocument()
    expect(screen.getByText('Reference tracing')).toBeInTheDocument()
    expect(screen.getByText('Selected response')).toBeInTheDocument()
  })

  it('signals the objective only after five correct identifications', () => {
    const dispatch = jest.fn()
    render(<WaveformRecognitionDrill dispatch={dispatch} />)

    const answers = [
      'Right ventricle',
      'Pulmonary artery',
      'Pulmonary capillary wedge',
      'Pericardial constraint',
      'Tricuspid regurgitation',
    ]
    for (const [position, answer] of answers.entries()) {
      fireEvent.click(screen.getByRole('radio', { name: answer }))
      fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
      if (position < answers.length - 1) {
        expect(dispatch).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Next tracing' }))
      }
    }

    expect(dispatch).toHaveBeenCalledWith({
      type: 'VALIDATE_SIGNAL',
      check: 'waveform-recognition',
    })
  })
})

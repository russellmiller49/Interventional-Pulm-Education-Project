import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'

import { AtrialComponentActivity } from '../components/stage/AtrialComponentActivity'
import {
  WaveformRecognitionDrill,
  emptyRecognitionRecord,
  type RecognitionRecord,
} from '../components/WaveformRecognitionDrill'
import type { ComponentMode, ComponentSelection } from '../content/introductoryTeaching'
import {
  recognitionPracticeExampleById,
  recognitionPracticeExamples,
  validateRecognitionPractice,
} from '../content/recognitionPractice'
import { hemodynamicsStageLesson } from '../content/stageLessons'
import { waveformAtlasById } from '../content/waveformAtlas'
import {
  advanceToPrediction,
  clickPrimary,
  currentStepId,
  installDom,
  mountSection,
  nowPrimary,
  nowStatus,
} from '../test-support/stageHarness'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  installDom()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

/*
 * HD-02 — recognition as replayable waveform comparisons.
 *
 * Replaces the drill contract (a checked answer marked the stage's "named a tracing" goal; one
 * unlabelled tracing at a time, the four places repeated). What this asserts instead: the practice is
 * learner-chosen and never a goal; the tracing under inspection does not change until the learner
 * picks another; labels and explanation open without an answer; "cannot be named" is the reading only
 * where a display fault is drawn; model variants and display faults say what they are; what each
 * tracing draws agrees with the labels drawn on it; and the stage step can always be left, is never
 * marked done, and never locks the next section.
 */

const noop = () => undefined

function practice(record: RecognitionRecord) {
  render(<WaveformRecognitionDrill record={record} onRecord={noop} />)
  return document.querySelector(`[data-recognition-example="${record.exampleId}"]`)!
}

function labelled(exampleId: string): Element {
  return practice({ ...emptyRecognitionRecord(exampleId), labelsShown: true }).querySelector(
    'figure',
  )!
}

function tracePath(root: ParentNode = document): string {
  return (
    root
      .querySelector('[data-recognition-example] figure path[class~="atlasTrace"]')
      ?.getAttribute('d') ?? ''
  )
}

function stepStates(): readonly (string | null)[] {
  return [...document.querySelectorAll('[data-step-list] li')].map((row) =>
    row.getAttribute('data-step-state'),
  )
}

/* ------------------------------------------------------------------ *
 * Reading the drawn figure
 * ------------------------------------------------------------------ */
interface Point {
  readonly x: number
  /** Screen y negated, so a higher pressure is a larger number. */
  readonly pressure: number
}

function drawnTrace(figure: Element): readonly Point[] {
  const d = figure.querySelector('path[class~="atlasTrace"]')?.getAttribute('d') ?? ''
  return [...d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)].map((match) => ({
    x: Number(match[1]),
    pressure: -Number(match[2]),
  }))
}

/** Label text → x of its marker. The figure draws landmarks on the middle beat. */
function labelXs(figure: Element): ReadonlyMap<string, number> {
  const found: [string, number][] = []
  for (const group of figure.querySelectorAll('svg g')) {
    const circle = group.querySelector('circle')
    const text = group.querySelector('text')
    if (circle && text) found.push([text.textContent ?? '', Number(circle.getAttribute('cx'))])
  }
  return new Map(found)
}

function ecgXs(figure: Element): ReadonlyMap<string, number> {
  const found: [string, number][] = []
  for (const group of figure.querySelectorAll('svg g')) {
    const text = group.querySelector('text')?.textContent ?? ''
    const line = group.querySelector('line')
    if (line && !group.querySelector('circle') && ['P', 'QRS', 'T'].includes(text)) {
      found.push([text, Number(line.getAttribute('x1'))])
    }
  }
  return new Map(found)
}

function beatWidth(points: readonly Point[]): number {
  return (points.at(-1)!.x - points[0].x) / 3
}

function inMiddleBeat(points: readonly Point[]): readonly Point[] {
  const width = beatWidth(points)
  return points.filter((p) => p.x > points[0].x + width && p.x < points[0].x + 2 * width)
}

/** Strict local extrema over a window of samples, ignoring flat rounding noise. */
function extrema(points: readonly Point[], kind: 'max' | 'min', window = 10): readonly Point[] {
  const sign = kind === 'max' ? 1 : -1
  const found: Point[] = []
  for (let i = window; i < points.length - window; i += 1) {
    const value = sign * points[i].pressure
    let extreme = true
    for (let j = i - window; j <= i + window; j += 1) {
      if (sign * points[j].pressure > value) {
        extreme = false
        break
      }
    }
    if (!extreme) continue
    if (
      value - sign * points[i - window].pressure < 0.05 ||
      value - sign * points[i + window].pressure < 0.05
    )
      continue
    if (found.length > 0 && points[i].x - found.at(-1)!.x < 2) continue
    found.push(points[i])
  }
  return found
}

function nearest(candidates: readonly Point[], x: number): Point | undefined {
  return [...candidates].sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0]
}

function pressureAt(points: readonly Point[], x: number): number {
  return nearest(points, x)!.pressure
}

function slopeAt(points: readonly Point[], x: number, spanPx = 8): number {
  return pressureAt(points, x + spanPx) - pressureAt(points, x - spanPx)
}

/** A landmark agrees with the trace when an extremum of the stated kind sits within a twentieth of a beat. */
function expectExtremumAt(points: readonly Point[], kind: 'max' | 'min', x: number): Point {
  const found = nearest(extrema(points, kind), x)
  expect(found).toBeDefined()
  expect(Math.abs(found!.x - x)).toBeLessThan(beatWidth(points) * 0.05)
  return found!
}

function mean(points: readonly Point[]): number {
  return points.reduce((sum, point) => sum + point.pressure, 0) / points.length
}

function pulse(points: readonly Point[]): number {
  const beat = inMiddleBeat(points).map((point) => point.pressure)
  return Math.max(...beat) - Math.min(...beat)
}

/* ------------------------------------------------------------------ */

describe('the recognition practice registry', () => {
  it('validates, supports every reading, and pairs each tracing with a confusable one on its own axis', () => {
    expect(validateRecognitionPractice()).toEqual([])
    expect(recognitionPracticeExamples.map((example) => example.reading)).toEqual([
      'rv-normal',
      'pa-normal',
      'wedge-normal',
      'ra-normal',
      'ra-normal',
      'cannot-name',
    ])
    for (const example of recognitionPracticeExamples) {
      const partner = recognitionPracticeExampleById.get(example.compareWithId)!
      expect(partner.reading).not.toBe(example.reading)
      expect(partner.entry.scaleMaxMmHg).toBe(example.entry.scaleMaxMmHg)
    }
  })

  it('draws references as authored, and changes only what a model variant or display fault says', () => {
    const example = (id: string) => recognitionPracticeExampleById.get(id)!
    for (const id of ['rv', 'pa', 'wedge', 'ra']) {
      expect(example(id).origin).toBe('reference')
      expect(example(id).entry).toBe(waveformAtlasById.get(example(id).reading))
    }

    const rightAtrium = waveformAtlasById.get('ra-normal')!
    const wedge = waveformAtlasById.get('wedge-normal')!
    const variant = example('ra-level-matched')
    expect(variant.origin).toBe('model-variant')
    expect(variant.entry.label).toBe('Right atrium / CVP · model variant')
    expect(variant.entry.normalRange).toBeNull()
    expect(variant.entry.annotations).toBe(rightAtrium.annotations)
    expect(wedge.trace.kind).toBe('atrial')
    expect(variant.entry.trace).toEqual({
      ...rightAtrium.trace,
      meanMmHg: wedge.trace.kind === 'atrial' ? wedge.trace.meanMmHg : Number.NaN,
    })
    expect(variant.originNote).toMatch(/^Model variant: .*It is not a patient recording\.$/)

    const fault = example('pa-overdamped')
    expect(fault.origin).toBe('display-fault')
    expect(fault.reading).toBe('cannot-name')
    expect(fault.displayFault?.id).toBe('validity-overdamped')
    expect(fault.entry.trace).toBe(waveformAtlasById.get('pa-normal')!.trace)
    expect(fault.entry.annotations).toEqual([])
    expect(fault.originNote).toMatch(/^Display fault: .*It is not a patient recording\.$/)
  })
})

describe('what each practice tracing draws agrees with the labels drawn on it', () => {
  it('right ventricle: one systolic peak, a rapid fall, a diastole that rises with filling, no notch', () => {
    const figure = labelled('rv')
    const points = drawnTrace(figure)
    const labels = labelXs(figure)
    const peaks = extrema(points, 'max').filter((p) => inMiddleBeat(points).includes(p))
    expect(peaks).toHaveLength(1)
    expectExtremumAt(points, 'max', labels.get('RVSP')!)
    expect(slopeAt(points, labels.get('rapid fall')!)).toBeLessThan(0)
    expect(slopeAt(points, labels.get('up-sloping diastole')!)).toBeGreaterThan(0)
  })

  it('pulmonary artery: a systolic peak, a notch then a dicrotic wave, and a falling diastole above the ventricle’s', () => {
    const artery = labelled('pa')
    const ventricle = labelled('rv')
    const points = drawnTrace(artery)
    const labels = labelXs(artery)
    const peaks = extrema(points, 'max').filter((p) => inMiddleBeat(points).includes(p))
    expect(peaks).toHaveLength(2)
    expectExtremumAt(points, 'max', labels.get('PASP')!)
    const notch = expectExtremumAt(points, 'min', labels.get('dicrotic notch')!)
    expect(peaks[1].x).toBeGreaterThan(notch.x)
    expect(slopeAt(points, labels.get('down-sloping diastole')!)).toBeLessThan(0)
    // Same 0–40 mmHg axis: the artery's lowest diastolic pressure sits above the ventricle's.
    const lowest = (trace: readonly Point[]) =>
      Math.min(...inMiddleBeat(trace).map((p) => p.pressure))
    expect(lowest(points)).toBeGreaterThan(lowest(drawnTrace(ventricle)))
  })

  it.each(['ra', 'ra-level-matched'])(
    '%s: a, c and v peaks and x and y descents, the a wave after the P wave and taller than v',
    (exampleId) => {
      const figure = labelled(exampleId)
      const points = drawnTrace(figure)
      const labels = labelXs(figure)
      const ecg = ecgXs(figure)
      const a = expectExtremumAt(points, 'max', labels.get('a')!)
      const c = expectExtremumAt(points, 'max', labels.get('c')!)
      const v = expectExtremumAt(points, 'max', labels.get('v')!)
      expectExtremumAt(points, 'min', labels.get('x')!)
      expectExtremumAt(points, 'min', labels.get('y')!)
      expect(a.x).toBeGreaterThan(ecg.get('P')!)
      expect(c.x).toBeGreaterThan(ecg.get('QRS')!)
      expect(c.x).toBeLessThan(ecg.get('T')!)
      expect(a.pressure).toBeGreaterThan(v.pressure)
    },
  )

  it('wedge: only a and v peaks, both later against the ECG, with the v wave the larger', () => {
    const figure = labelled('wedge')
    const points = drawnTrace(figure)
    const labels = labelXs(figure)
    const ecg = ecgXs(figure)
    const peaks = extrema(points, 'max').filter((p) => inMiddleBeat(points).includes(p))
    expect(peaks).toHaveLength(2)
    const a = expectExtremumAt(points, 'max', labels.get('a')!)
    const v = expectExtremumAt(points, 'max', labels.get('v')!)
    expectExtremumAt(points, 'min', labels.get('x')!)
    expectExtremumAt(points, 'min', labels.get('y')!)
    expect(labels.has('c')).toBe(false)
    expect(a.x).toBeGreaterThan(ecg.get('QRS')!)
    expect(a.x).toBeLessThan(ecg.get('T')!)
    expect(v.x).toBeGreaterThan(ecg.get('T')!)
    expect(v.pressure).toBeGreaterThan(a.pressure)
  })

  it('moves the level-matched right atrium by a constant, to the wedge example’s level', () => {
    const reference = drawnTrace(labelled('ra'))
    const variant = drawnTrace(labelled('ra-level-matched'))
    const wedge = drawnTrace(labelled('wedge'))
    expect(variant).toHaveLength(reference.length)
    const offset = variant[0].pressure - reference[0].pressure
    expect(offset).toBeGreaterThan(0)
    variant.forEach((point, index) => {
      expect(point.x).toBe(reference[index].x)
      expect(Math.abs(point.pressure - reference[index].pressure - offset)).toBeLessThan(0.25)
    })
    // Within two pixels, about a third of a mmHg on the 0–20 mmHg axis.
    expect(Math.abs(mean(variant) - mean(wedge))).toBeLessThan(2)
  })

  it('overdamped display: no landmarks, a narrower pulse and a flatter notch than the clean artery, a similar mean', () => {
    const damped = labelled('pa-overdamped')
    const clean = labelled('pa')
    expect(damped.querySelectorAll('circle')).toHaveLength(0)
    const dampedTrace = drawnTrace(damped)
    const cleanTrace = drawnTrace(clean)
    expect(pulse(dampedTrace)).toBeLessThan(pulse(cleanTrace))
    const notchX = labelXs(clean).get('dicrotic notch')!
    const notchDepth = (trace: readonly Point[]) => {
      const notch = nearest(extrema(trace, 'min'), notchX)
      const wave = extrema(trace, 'max').find((p) => notch && p.x > notch.x)
      if (!notch || !wave || Math.abs(notch.x - notchX) > beatWidth(trace) * 0.08) return 0
      return wave.pressure - notch.pressure
    }
    expect(notchDepth(dampedTrace)).toBeLessThan(notchDepth(cleanTrace))
    expect(Math.abs(mean(inMiddleBeat(dampedTrace)) - mean(inMiddleBeat(cleanTrace)))).toBeLessThan(
      pulse(cleanTrace) * 0.2,
    )
  })
})

describe('the practice, as a learner uses it', () => {
  it('keeps the tracing still through a hint, a wrong try, a comparison and repeats; only a pick changes it', () => {
    render(<WaveformRecognitionDrill />)
    const first = tracePath()
    expect(first).not.toBe('')
    expect(screen.getByText('Tracing 1 of 6')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    expect(document.querySelector('[data-recognition-hint]')).not.toBeNull()
    expect(tracePath()).toBe(first)

    fireEvent.click(screen.getByRole('radio', { name: 'Pulmonary artery' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(screen.getByText('Not this one: this is the right ventricle.')).toBeInTheDocument()
    expect(
      screen.getByText(/^The pulmonary artery is the easy confusion here\./),
    ).toBeInTheDocument()
    expect(screen.getByText('Your reading')).toBeInTheDocument()
    expect(tracePath()).toBe(first)

    fireEvent.click(screen.getByRole('button', { name: 'Compare with another tracing' }))
    expect(document.querySelector('[data-recognition-compare="pa"]')).not.toBeNull()
    expect(tracePath()).toBe(first)

    for (let repeat = 0; repeat < 3; repeat += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Try this tracing again' }))
      expect(screen.getByText('Unidentified tracing')).toBeInTheDocument()
      expect(tracePath()).toBe(first)
      fireEvent.click(screen.getByRole('button', { name: 'Show the labels and explanation' }))
      expect(tracePath()).toBe(first)
    }

    fireEvent.click(screen.getByRole('button', { name: 'Tracing 2' }))
    expect(tracePath()).not.toBe(first)
    fireEvent.click(screen.getByRole('button', { name: 'Tracing 1' }))
    expect(tracePath()).toBe(first)
    expect(document.body.textContent).not.toMatch(/of \d+ correct|attempted|score|streak/i)
  })

  it('opens the labels and explanation without an answer, and records no reading', () => {
    render(<WaveformRecognitionDrill />)
    fireEvent.click(screen.getByRole('button', { name: 'Show the labels and explanation' }))
    expect(document.querySelector('[data-recognition-reveal="shown"]')).not.toBeNull()
    expect(
      screen.getByText('Shown without an answer: this is the right ventricle.'),
    ).toBeInTheDocument()
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled()
      expect(radio).not.toBeChecked()
    }
    expect(screen.getByText('Labelled reading')).toBeInTheDocument()
    expect(screen.queryByText('Your reading')).toBeNull()
    expect(document.querySelectorAll('[data-recognition-example] figure circle').length).toBe(5)
  })

  it('makes "cannot be named" the reading only where a display fault is drawn', () => {
    render(<WaveformRecognitionDrill />)
    fireEvent.click(screen.getByRole('button', { name: 'Tracing 6' }))
    expect(screen.getByText('Unidentified tracing')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Pulmonary artery' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(
      screen.getByText('Not this one: this is a display that cannot name a place.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/^Chamber interpretation withheld/)).toBeInTheDocument()
    expect(
      document.querySelector('[data-recognition-reveal] [data-recognition-origin]')?.textContent,
    ).toMatch(/^Display fault: /)
    expect(document.querySelectorAll('[data-recognition-example] > figure circle')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Try this tracing again' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Cannot be named from this display' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(
      screen.getByText('That matches: this is a display that cannot name a place.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tracing 1' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Cannot be named from this display' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(
      screen.getByText(
        'No display fault is drawn on this model tracing, so its shape can name the place.',
      ),
    ).toBeInTheDocument()
  })

  it('says the level-matched right atrium is a model variant, and compares it with the wedge', () => {
    render(<WaveformRecognitionDrill />)
    fireEvent.click(screen.getByRole('button', { name: 'Tracing 5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show the labels and explanation' }))
    expect(screen.getByText('Right atrium / CVP · model variant')).toBeInTheDocument()
    expect(
      document.querySelector('[data-recognition-reveal] [data-recognition-origin="model-variant"]')
        ?.textContent,
    ).toMatch(/^Model variant: .*It is not a patient recording\.$/)
    fireEvent.click(screen.getByRole('button', { name: 'Compare with another tracing' }))
    const comparison = document.querySelector('[data-recognition-compare="wedge"]')!
    expect(comparison.querySelector('h4')?.textContent).toBe('Compare: Pulmonary capillary wedge')
    expect(comparison.textContent).toMatch(/at the same mean pressure, so the number cannot/)
    expect(
      comparison
        .querySelector('[data-recognition-origin]')
        ?.getAttribute('data-recognition-origin'),
    ).toBe('reference')
  })

  it.each(recognitionPracticeExamples.map((example) => example.id))(
    'names no reading on tracing %s, hint open, before its labels are shown',
    (exampleId) => {
      const section = practice({ ...emptyRecognitionRecord(exampleId), hintShown: true })
      expect(section.querySelector('[data-recognition-hint]')).not.toBeNull()
      const clone = section.cloneNode(true) as Element
      clone.querySelector('fieldset')?.remove()
      const readable = `${clone.textContent} ${[...clone.querySelectorAll('[aria-label]')]
        .map((node) => node.getAttribute('aria-label'))
        .join(' ')}`
      expect(readable).not.toMatch(
        /right.atri|\bCVP\b|ventric|pulmonary.artery|wedge|damp|cannot be named|interpretation withheld/i,
      )
      expect(section.querySelectorAll('figure circle')).toHaveLength(0)
    },
  )
})

describe('on the lesson stage', () => {
  it('never locks or completes the practice step, whatever the learner does, and never locks the next section', () => {
    const { lesson } = mountSection('waveform-interpretation')
    const practiceIndex = lesson.steps.findIndex(
      (step) => step.interaction.kind === 'recognition-practice',
    )
    expect(practiceIndex).toBeGreaterThan(lesson.predictionStepIndex)
    advanceToPrediction('waveform-interpretation')
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[practiceIndex].id)
    expect(nowStatus()).toMatch(/^Optional practice\./)
    expect(document.querySelector('[data-step-goals]')).toBeNull()

    const continueIsLive = () => {
      expect(nowPrimary()?.disabled).toBe(false)
      expect(nowPrimary()?.textContent).toMatch(/Continue/)
    }
    continueIsLive()
    // No answer; a wrong answer; labels shown; the same easy tracing again and again.
    fireEvent.click(screen.getByRole('button', { name: 'Next tracing' }))
    continueIsLive()
    fireEvent.click(screen.getByRole('button', { name: 'Previous tracing' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Right atrium / CVP' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(document.querySelector('[data-recognition-reveal="checked"]')).not.toBeNull()
    continueIsLive()
    for (let repeat = 0; repeat < 4; repeat += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Try this tracing again' }))
      fireEvent.click(screen.getByRole('button', { name: 'Show the labels and explanation' }))
      continueIsLive()
    }

    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[practiceIndex + 1].id)
    expect(stepStates()[practiceIndex]).toBe('passed')
    let guard = 40
    while (!document.querySelector('[data-stage-completion]') && guard-- > 0) {
      // No Explain step claims a hands-on step this section never asks for.
      expect(document.querySelector('[data-before-after-absent]')).toBeNull()
      clickPrimary()
    }
    expect(document.querySelector('[data-stage-completion]')).not.toBeNull()
    // Only the walk, which the primary action really walked stop by stop, is simulation work done.
    expect(stepStates()[practiceIndex]).toBe('passed')
    lesson.steps.forEach((step, index) => {
      if (step.interaction.kind !== 'walk') expect(stepStates()[index]).not.toBe('done')
    })
    const next = screen.getByText(/^Continue to the next section: /).closest('button')
    expect(next).not.toBeNull()
    expect(next).toBeEnabled()
  })

  it('offers one atrial-component practice whose renumbered repeat is a labelled model variant', () => {
    const lesson = hemodynamicsStageLesson('waveform-components')
    const componentSteps = lesson.steps.filter(
      (step) => step.interaction.kind === 'component-identification',
    )
    expect(componentSteps).toHaveLength(1)
    mountSection('waveform-components')
    clickPrimary()
    expect(currentStepId()).toBe(componentSteps[0].id)
    const mode = () =>
      document.querySelector('[data-component-activity]')?.getAttribute('data-component-activity')
    expect(mode()).toBe('guided')
    fireEvent.click(screen.getByRole('button', { name: 'Renumbered repeat · model variant' }))
    expect(mode()).toBe('independent')
    expect(document.querySelector('[data-component-variant-note]')?.textContent).toMatch(
      /^Model variant: .*not a new patient recording\.$/,
    )
    expect(screen.getByText('Model variant · right atrium, renumbered')).toBeInTheDocument()
    expect(nowPrimary()?.disabled).toBe(false)
    clickPrimary()
    expect(stepStates()[lesson.steps.indexOf(componentSteps[0])]).toBe('passed')
  })

  it('keeps checked regions per numbering; the reference and a shown component record nothing', () => {
    const calls: [ComponentMode, readonly ComponentSelection[]][] = []
    function Harness() {
      const [selections, setSelections] = useState<
        Partial<Record<ComponentMode, readonly ComponentSelection[]>>
      >({})
      return (
        <AtrialComponentActivity
          enabled
          selections={selections}
          onChange={(numbering, next) => {
            calls.push([numbering, next])
            setSelections((current) => ({ ...current, [numbering]: next }))
          }}
        />
      )
    }
    render(<Harness />)
    fireEvent.click(screen.getByRole('radio', { name: /^Region 1 ·/ })) // guided region 1: the a wave
    fireEvent.click(screen.getByRole('button', { name: 'Check component' }))
    expect(calls).toEqual([['guided', [{ component: 'a', selectedRegion: 1 }]]])

    fireEvent.click(screen.getByText('Compare with the labelled reference'))
    fireEvent.click(screen.getByRole('button', { name: 'Renumbered repeat · model variant' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show this component' }))
    expect(calls).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    fireEvent.click(screen.getByRole('radio', { name: /^Region 2 ·/ })) // renumbered region 2: the a wave
    fireEvent.click(screen.getByRole('button', { name: 'Check component' }))
    expect(calls.at(-1)).toEqual(['independent', [{ component: 'a', selectedRegion: 2 }]])
    expect(screen.getByText('Component identified.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Numbered in order' }))
    expect(
      document.querySelector('[data-component-activity]')?.getAttribute('data-component-activity'),
    ).toBe('guided')
    expect(calls).toHaveLength(2)
  })
})

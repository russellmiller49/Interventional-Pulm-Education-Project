import { act, cleanup, fireEvent, render } from '@testing-library/react'

import { LessonHost } from '../components/LessonHost'
import { LESSONS } from '../content/curriculum'
import { activitiesForLesson } from '../content/stage'
import { labGoalMet, labGoalRequirements, type Lab } from '../content/types'
import {
  CONTACT_MODES,
  MODEL_REVISION,
  MODEL_STEPS,
  initialModelState,
  modelReducer,
  phantomPlaneReference,
  PHANTOM_RECOMMENDED_COMPARISON,
  type MeasurementState,
} from '@/lib/ebus-model-contract'
import {
  EMPTY_EBUS_OBSERVATION,
  isEbusObservation,
  type EbusObservation,
} from '@/lib/ebus-guided-bridge'
import { isRecordedFrameSource, type RecordedFrameSource } from '@/lib/ebus-recorded-contract'

/**
 * EBUS-PRE-REVIEW-02 — readable images and usable controls.
 *
 * jsdom does no layout, so the geometry this batch changes is measured in a real browser and
 * recorded in the handoff. What is held here is the part that is logic: the contracts that carry
 * a frame's provenance and the held contact condition, the readiness conditions now that they are
 * reported as well as applied, the phantom reference derived from the current plane, and the DOM
 * the footer and the acquisition status build.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

let reportObservation: ((value: EbusObservation) => void) | null = null
jest.mock('../components/Workbench', () => ({
  Workbench: ({ onObservation }: { onObservation: (s: EbusObservation) => void }) => {
    reportObservation = onObservation
    return <section data-mock-workbench />
  },
}))
jest.mock('../components/DecisionImage', () => ({
  DecisionImage: ({ station }: { station: string }) => (
    <figure data-mock-decision-image={station} />
  ),
}))
jest.mock('../components/StationFigure', () => ({
  StationFigure: ({ station }: { station: string }) => <figure data-mock-station={station} />,
}))

beforeEach(() => {
  localStorage.clear()
  reportObservation = null
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(cleanup)

const lessonFor = (id: string) => LESSONS.find((lesson) => lesson.id === id)!
const gainLesson = lessonFor('gain-contrast')
const contactLesson = lessonFor('contact-cutaway-model')

/** Open a lesson and continue to its acquisition step. */
function openAcquisition(lessonId: string) {
  const lesson = lessonFor(lessonId)
  render(<LessonHost lesson={lesson} />)
  const activities = activitiesForLesson(lesson)
  const target = activities.findIndex((activity) => activity.interaction === 'acquire')
  for (let step = 0; step < target; step++)
    fireEvent.click(document.querySelector('[data-now-primary]') as HTMLButtonElement)
  return lesson
}

const recordedFrame = (over: Partial<RecordedFrameSource> = {}): RecordedFrameSource => ({
  type: 'recorded-frame',
  version: 1,
  sessionId: 'session',
  taskId: 'gain',
  frameId: 'session:abc',
  segmentId: 'Depth4_Gain_4',
  mediaTime: 6.025,
  width: 1920,
  height: 1080,
  settings: { depthMm: 40, gain: 43, contrast: 43, doppler: false },
  example: {
    control: 'gain',
    index: 4,
    levels: 8,
    segmentId: 'Depth4_Gain_4',
    file: 'Depth4.mp4',
    startSeconds: 6,
    endSeconds: 8,
    depthCm: 4,
  },
  calipers: [],
  held: false,
  captured: false,
  ...over,
})

/* B — what a recorded frame says about itself (L7-1) ---------------------------------------- */

describe('a recorded frame carries the example it came from', () => {
  it('accepts a frame that names its segment, file and window', () => {
    expect(isRecordedFrameSource(recordedFrame())).toBe(true)
  })

  it('still accepts a frame with no example, so older frames stay valid', () => {
    const frame = recordedFrame()
    delete frame.example
    expect(isRecordedFrameSource(frame)).toBe(true)
  })

  it('rejects an example that claims a step outside the recorded set', () => {
    expect(
      isRecordedFrameSource(recordedFrame({ example: { ...recordedFrame().example!, index: 9 } })),
    ).toBe(false)
  })

  it('rejects an example whose window runs backwards', () => {
    expect(
      isRecordedFrameSource(
        recordedFrame({ example: { ...recordedFrame().example!, startSeconds: 8, endSeconds: 6 } }),
      ),
    ).toBe(false)
  })

  it('leaves the learner-selected settings untouched, because the lab goal is checked against them', () => {
    expect(recordedFrame().settings).toEqual({
      depthMm: 40,
      gain: 43,
      contrast: 43,
      doppler: false,
    })
  })
})

/* The held contact condition (carry-forward of L5-1) ---------------------------------------- */

const contactObservation = (mode: (typeof CONTACT_MODES)[number]): EbusObservation => ({
  ...EMPTY_EBUS_OBSERVATION,
  ready: true,
  frameReady: true,
  actionCount: 3,
  acquisitionSession: 'session',
  model: {
    package: 'contact',
    revision: MODEL_REVISION,
    frameId: 'frame-1',
    steps: [...MODEL_STEPS.contact],
    complete: true,
    annotations: false,
    contactMode: mode,
  },
})

describe('the observation carries which contact condition produced the frame', () => {
  it.each(CONTACT_MODES)('accepts %s from the contact package', (mode) => {
    expect(isEbusObservation(contactObservation(mode))).toBe(true)
  })

  it('rejects a contact condition on a package that has none', () => {
    const observation = contactObservation('gap')
    expect(
      isEbusObservation({
        ...observation,
        model: { ...observation.model!, package: 'needle', steps: [], contactMode: 'gap' },
      }),
    ).toBe(false)
  })

  it('rejects a condition the model does not have', () => {
    const observation = contactObservation('gap')
    expect(
      isEbusObservation({
        ...observation,
        model: { ...observation.model!, contactMode: 'excellent' },
      }),
    ).toBe(false)
  })

  it('stays optional, so an observation without one is still valid', () => {
    const observation = contactObservation('gap')
    const model = { ...observation.model! }
    delete model.contactMode
    expect(isEbusObservation({ ...observation, model })).toBe(true)
  })

  it('names the condition the learner actually held', () => {
    openAcquisition('contact-cutaway-model')
    act(() => reportObservation!(contactObservation('shadow')))
    fireEvent.click(document.querySelector('[data-now-primary]') as HTMLButtonElement)

    const identity = document.querySelector('[data-evidence-identity]') as HTMLElement
    expect(identity.dataset.evidenceIdentity).toBe('held')
    expect(identity.textContent).toContain('Contact condition held: contact with a reflector.')
    // The authored check is untouched; it is the evidence that stops being anonymous.
    expect(contactLesson.observation.prompt).toBe(
      LESSONS.find((lesson) => lesson.id === 'contact-cutaway-model')!.observation.prompt,
    )
  })

  it('claims no condition when nothing was acquired', () => {
    openAcquisition('contact-cutaway-model')
    fireEvent.click(document.querySelector('[data-skip-acquisition]') as HTMLButtonElement)
    expect(document.querySelector('[data-evidence-identity]')?.textContent ?? '').not.toContain(
      'Contact condition held',
    )
  })

  it('claims no condition for a package that does not model one', () => {
    openAcquisition('needle-assembly-model')
    act(() =>
      reportObservation!({
        ...contactObservation('gap'),
        model: {
          package: 'needle',
          revision: MODEL_REVISION,
          frameId: 'frame-1',
          steps: [...MODEL_STEPS.needle],
          complete: true,
          annotations: false,
        },
      }),
    )
    fireEvent.click(document.querySelector('[data-now-primary]') as HTMLButtonElement)
    expect(document.querySelector('[data-evidence-identity]')?.textContent ?? '').not.toContain(
      'Contact condition held',
    )
  })
})

/* B — the readiness conditions, now reported as well as applied (L7-3) ---------------------- */

const knobologyLab = gainLesson.lab as Lab

const gainObservation = (over: Partial<EbusObservation> = {}): EbusObservation => ({
  ...EMPTY_EBUS_OBSERVATION,
  ready: true,
  frameReady: true,
  actionCount: 4,
  usedControls: ['gain', 'contrast'],
  lastAction: 'gain',
  depth: 40,
  gain: 43,
  contrast: 43,
  recorded: recordedFrame(),
  ...over,
})

describe('the acquisition says what is still open', () => {
  it('reports exactly what the gate applies', () => {
    const cases: EbusObservation[] = [
      EMPTY_EBUS_OBSERVATION,
      gainObservation(),
      gainObservation({ lastAction: 'contrast' }),
      gainObservation({ usedControls: ['gain'] }),
      gainObservation({
        gain: 100,
        recorded: recordedFrame({
          settings: { depthMm: 40, gain: 100, contrast: 43, doppler: false },
        }),
      }),
      gainObservation({ frameReady: false }),
      gainObservation({ ready: false }),
      gainObservation({ actionCount: 0 }),
      gainObservation({ recorded: undefined }),
    ]
    for (const state of cases)
      expect(labGoalRequirements(knobologyLab, state).every((r) => r.met)).toBe(
        labGoalMet(knobologyLab, state),
      )
  })

  it('names the last-control condition rather than leaving it invisible', () => {
    const open = labGoalRequirements(
      knobologyLab,
      gainObservation({ lastAction: 'contrast' }),
    ).filter((requirement) => !requirement.met)
    expect(open.map((requirement) => requirement.id)).toEqual(['gain-last'])
    expect(open[0].text).toMatch(/varies one control/i)
  })

  it('agrees with the gate for every lab in the course', () => {
    const labs = LESSONS.flatMap((lesson) => [lesson.lab, lesson.transferLab]).filter(
      (lab): lab is Lab => !!lab,
    )
    expect(labs.length).toBeGreaterThan(10)
    for (const lab of labs) {
      expect(labGoalRequirements(lab, EMPTY_EBUS_OBSERVATION).every((r) => r.met)).toBe(
        labGoalMet(lab, EMPTY_EBUS_OBSERVATION),
      )
      expect(labGoalRequirements(lab, EMPTY_EBUS_OBSERVATION).length).toBeGreaterThan(2)
    }
  })

  it('lists the open conditions beside the workbench', () => {
    openAcquisition('gain-contrast')
    expect(document.querySelector('[data-acquisition-status]')).not.toBeNull()
    const listed = [...document.querySelectorAll('[data-acquisition-outstanding] li')].map(
      (item) => (item as HTMLElement).dataset.requirement,
    )
    expect(listed).toContain('gain-last')
    expect(listed).toContain('frame-ready')
  })

  it('does not tell a recorded lab it moved an observer camera', () => {
    openAcquisition('gain-contrast')
    const status = document.querySelector('[data-acquisition-status]')!.textContent ?? ''
    expect(status).toContain('Selecting a recording is not yet an acquisition')
    expect(status).not.toContain('observer camera')
  })
})

/* B — the footer keeps its shape when readiness changes (L6-6) ------------------------------ */

describe('the advance row', () => {
  it('reads in the order it is laid out: back, the way past, then the advance', () => {
    openAcquisition('gain-contrast')
    const footer = (document.querySelector('[data-now-primary]') as HTMLElement).parentElement!
    const controls = [...footer.children].map((child) =>
      child.hasAttribute('data-skip-acquisition')
        ? 'skip'
        : child.hasAttribute('data-now-primary')
          ? 'advance'
          : child.hasAttribute('data-advance-note')
            ? 'note'
            : 'back',
    )
    expect(controls).toEqual(['back', 'skip', 'advance', 'note'])
  })

  it('keeps the explanation slot present whether or not it has anything to say', () => {
    openAcquisition('gain-contrast')
    const note = document.querySelector('[data-advance-note]')!
    expect(note.textContent).toMatch(/Complete the acquisition/)

    fireEvent.click(document.querySelector('[data-skip-acquisition]') as HTMLButtonElement)
    expect(document.querySelector('[data-advance-note]')).not.toBeNull()
  })

  it('keeps both routes available while an acquisition is open', () => {
    openAcquisition('gain-contrast')
    expect(document.querySelector('[data-skip-acquisition]')).not.toBeNull()
    expect((document.querySelector('[data-now-primary]') as HTMLButtonElement).disabled).toBe(true)
  })
})

/* C — the phantom reference, derived from the plane on screen (L9-2 / L9-3 / L10-1) --------- */

const measurementAt = (
  shape: MeasurementState['shape'],
  offset: number,
  axis: 'short' | 'long',
) => {
  let state = initialModelState('measurement') as MeasurementState
  state = modelReducer(state, { type: 'shape', value: shape }) as MeasurementState
  state = modelReducer(state, { type: 'offset', value: offset }) as MeasurementState
  return modelReducer(state, { type: 'axis', value: axis }) as MeasurementState
}

describe('the model reference comes from the current plane', () => {
  it('gives the authored central short axis of the elongated phantom', () => {
    const reference = phantomPlaneReference(measurementAt('ellipsoid', 0, 'short'))
    expect(reference.shortAxisMm).toBeCloseTo(16, 10)
    expect(reference.longAxisMm).toBeCloseTo(32, 10)
    expect(reference.axisMm).toBeCloseTo(16, 10)
    expect(reference.idealCalipers).toEqual([
      [0, 22 - 8],
      [0, 22 + 8],
    ])
  })

  it('follows the axis the learner selected', () => {
    const reference = phantomPlaneReference(measurementAt('ellipsoid', 0, 'long'))
    expect(reference.axisMm).toBeCloseTo(32, 10)
    expect(reference.idealCalipers).toEqual([
      [-16, 22],
      [16, 22],
    ])
  })

  it('shrinks with the plane instead of reporting the full object', () => {
    const reference = phantomPlaneReference(measurementAt('ellipsoid', 6, 'short'))
    // radii [16, 8, 10]; the section at z = 6 scales by sqrt(1 - (6/10)^2).
    expect(reference.axisMm).toBeCloseTo(16 * Math.sqrt(1 - 0.36), 10)
    expect(reference.axisMm).toBeLessThan(16)
  })

  it('refuses a single axis where the plane cuts two objects', () => {
    const reference = phantomPlaneReference(measurementAt('adjacent', 0, 'short'))
    expect(reference.objects).toBe(2)
    expect(reference.axisMm).toBeNull()
    expect(reference.idealCalipers).toBeNull()
  })

  it('reports nothing at all where the plane misses the object', () => {
    const reference = phantomPlaneReference(measurementAt('sphere', -12, 'short'))
    expect(reference.objects).toBe(0)
    expect(reference.axisMm).toBeNull()
  })

  it('points at the plane the recorded task actually asks for', () => {
    const recommended = measurementAt(
      PHANTOM_RECOMMENDED_COMPARISON.shape,
      PHANTOM_RECOMMENDED_COMPARISON.offset,
      'short',
    )
    expect(phantomPlaneReference(recommended).axisMm).toBeCloseTo(16, 10)
  })

  it('does not relax what the activity accepts', () => {
    // The sweep steps still need every plane of every shape, as before this batch.
    expect(MODEL_STEPS.measurement).toEqual([
      'sphere-sweep',
      'ellipsoid-sweep',
      'adjacent-sweep',
      'lobulated-sweep',
      'short-axis-record',
    ])
    const partial = measurementAt('ellipsoid', 0, 'short')
    expect(partial.steps).not.toContain('ellipsoid-sweep')
  })
})

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import {
  buildIdentifyQuestion,
  loadQuizFrames,
  type QuizFramesData,
} from '@/lib/airway-anatomy-lesson/airway-quiz'
import {
  loadCtCorrelation,
  type CtCorrelationData,
} from '@/lib/airway-anatomy-lesson/ct-correlation'
import { loadOverlayData, type OverlayData } from '@/lib/airway-anatomy-lesson/video-atlas'

import { Airway3DModel } from './Airway3DModel'
import { AirwayIdentifyQuiz } from './AirwayIdentifyQuiz'

// WebGL cannot run in jsdom, so the 3D view is a stub and the tests read the props it is given.
jest.mock('./Airway3DModel', () => ({ Airway3DModel: jest.fn(() => null) }))

jest.mock('@/lib/airway-anatomy-lesson/airway-quiz', () => ({
  ...jest.requireActual('@/lib/airway-anatomy-lesson/airway-quiz'),
  loadQuizFrames: jest.fn(),
  buildIdentifyQuestion: jest.fn(),
}))

jest.mock('@/lib/airway-anatomy-lesson/ct-correlation', () => ({
  ...jest.requireActual('@/lib/airway-anatomy-lesson/ct-correlation'),
  loadCtCorrelation: jest.fn(),
}))

jest.mock('@/lib/airway-anatomy-lesson/video-atlas', () => ({
  ...jest.requireActual('@/lib/airway-anatomy-lesson/video-atlas'),
  loadOverlayData: jest.fn(),
}))

const model3DMock = Airway3DModel as unknown as jest.Mock
const loadQuizFramesMock = loadQuizFrames as jest.MockedFunction<typeof loadQuizFrames>
const buildIdentifyQuestionMock = buildIdentifyQuestion as jest.MockedFunction<
  typeof buildIdentifyQuestion
>
const loadCtCorrelationMock = loadCtCorrelation as jest.MockedFunction<typeof loadCtCorrelation>
const loadOverlayDataMock = loadOverlayData as jest.MockedFunction<typeof loadOverlayData>

const SQUARE = [100, 100, 300, 100, 300, 300, 100, 300]

function still(id: string, lobe: 'RLL' | 'LLL', group: string) {
  return {
    img: `/airway-lesson/quiz/${id}.jpg`,
    frame: 100,
    poly: SQUARE,
    name: id.toUpperCase(),
    short: id.toUpperCase(),
    lobe,
    group,
    isOrifice: true,
    hasCt: true,
  }
}

const quizFrames: QuizFramesData = {
  meta: { width: 1368, height: 1080, note: 'test' },
  structures: {
    rb6: still('rb6', 'RLL', 'RLL'),
    rb7: still('rb7', 'RLL', 'RLL'),
    rb8: still('rb8', 'RLL', 'RLL'),
    lb6: still('lb6', 'LLL', 'LLL'),
  },
}

function ctSlices(id: string) {
  return {
    axial: `/airway-lesson/ct/${id}-axial.jpg`,
    coronal: `/airway-lesson/ct/${id}-coronal.jpg`,
    lps: [0, 0, 0] as [number, number, number],
    axialSlice: 100,
    coronalSlice: 100,
  }
}

const ctData: CtCorrelationData = {
  meta: {
    source: 'test',
    window: { low: -1000, high: -300, label: 'Lung' },
    sizeXyz: [256, 256, 212],
    note: 'test',
  },
  structures: { rb6: ctSlices('rb6'), rb7: ctSlices('rb7'), lb6: ctSlices('lb6') },
}

// The airway under test and every way the lesson could name it.
const TARGET = 'rb6'
const TARGET_NAMES = [/RLL superior segment/i, /\bRB6\b/i, /most posterior segment of the lung/i]
const OPTION_NAMES = [
  'RLL medial basal segment (RB7)',
  'RLL superior segment (RB6)',
  'RLL anterior basal segment (RB8)',
  'LLL superior segment (LB6)',
]

async function renderNameQuiz(onOpenStructure?: (id: string) => void) {
  const view = render(<AirwayIdentifyQuiz onOpenStructure={onOpenStructure} />)
  await screen.findByRole('button', { name: OPTION_NAMES[1] })
  // Let any view that loads its own data (the CT manifest) finish rendering before looking.
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  return view
}

function optionButtons() {
  return OPTION_NAMES.map((name) => screen.getByRole('button', { name }))
}

/** Everything a sighted or screen-reader learner can perceive, except the answer choices. */
function perceivableOutsideChoices(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement
  for (const name of OPTION_NAMES) {
    for (const button of Array.from(clone.querySelectorAll('button'))) {
      if (button.textContent?.trim() === name) button.remove()
    }
  }
  const parts = [clone.textContent ?? '']
  for (const el of Array.from(clone.querySelectorAll('*'))) {
    for (const attr of ['alt', 'title', 'aria-label', 'aria-description', 'aria-valuetext']) {
      const value = el.getAttribute(attr)
      if (value) parts.push(value)
    }
    for (const attr of ['aria-describedby', 'aria-labelledby']) {
      for (const id of el.getAttribute(attr)?.split(/\s+/) ?? []) {
        const ref = id ? container.ownerDocument.getElementById(id) : null
        if (ref?.textContent) parts.push(ref.textContent)
      }
    }
  }
  return parts.join('\n')
}

function propsGivenTo3D(): { selectedId: string | null }[] {
  return model3DMock.mock.calls.map((call) => call[0])
}

describe('AirwayIdentifyQuiz — Name the airway', () => {
  beforeEach(() => {
    loadQuizFramesMock.mockResolvedValue(quizFrames)
    loadCtCorrelationMock.mockResolvedValue(ctData)
    buildIdentifyQuestionMock.mockReturnValue({
      target: TARGET,
      options: ['rb7', 'rb6', 'rb8', 'lb6'],
    })
  })

  it('names no airway outside the answer choices before the learner answers', async () => {
    const { container } = await renderNameQuiz()

    const perceivable = perceivableOutsideChoices(container)
    for (const name of TARGET_NAMES) expect(perceivable).not.toMatch(name)
    // Nor the lesson's internal id, in any accessible name.
    expect(perceivable).not.toMatch(/\brb6\b/)
  })

  it('keeps the CT crosshair closed until the learner answers', async () => {
    const { container } = await renderNameQuiz()

    expect(loadCtCorrelationMock).not.toHaveBeenCalled()
    expect(container.querySelector('img[src*="/airway-lesson/ct/"]')).toBeNull()
    expect(screen.queryByRole('button', { name: /coronal/i })).not.toBeInTheDocument()
  })

  it('does not give the 3D model the target before the learner answers', async () => {
    await renderNameQuiz()

    expect(propsGivenTo3D().some((props) => props.selectedId === TARGET)).toBe(false)
  })

  it('shows every answer choice the same way until the learner commits', async () => {
    await renderNameQuiz()

    const buttons = optionButtons()
    const first = buttons[0]
    for (const button of buttons) {
      expect(button).toBeEnabled()
      expect(button.className).toBe(first.className)
      expect(button).not.toHaveAttribute('aria-pressed')
      expect(button.querySelector('svg')).toBeNull()
    }
  })

  it('says the CT and 3D correlation open after the answer and points to the guided views', async () => {
    await renderNameQuiz()

    expect(screen.getByText(/CT and 3D correlation/i)).toBeInTheDocument()
    expect(screen.getByText(/Commit to a name first/)).toHaveTextContent(
      /CT crosshair, the 3D highlight and the explanation .* open with the answer/,
    )
    expect(screen.getByText(/stay closed until you answer/i)).toHaveTextContent(
      /guided survey.*tree explorer/i,
    )
  })

  it('opens the CT, the 3D highlight and the explanation for the airway once answered', async () => {
    const onOpenStructure = jest.fn()
    await renderNameQuiz(onOpenStructure)

    fireEvent.click(screen.getByRole('button', { name: OPTION_NAMES[0] }))

    expect(
      screen.getByText(/Not quite - this is the RLL superior segment \(RB6\)\./),
    ).toBeInTheDocument()
    expect(
      screen.getByText('The most posterior segment of the lung, opposite the RML origin.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Opens posteriorly just beyond the middle lobe origin, at the same depth\./),
    ).toBeInTheDocument()

    const axial = await screen.findByRole('img', { name: /Axial CT slice/ })
    expect(axial).toHaveAttribute('src', '/airway-lesson/ct/rb6-axial.jpg')
    expect(axial).toHaveAccessibleName(/RLL superior segment \(RB6\)/)
    fireEvent.click(screen.getByRole('button', { name: /coronal/i }))
    expect(screen.getByRole('img', { name: /Coronal CT slice/ })).toHaveAttribute(
      'src',
      '/airway-lesson/ct/rb6-coronal.jpg',
    )

    const latest = propsGivenTo3D().at(-1)
    expect(latest?.selectedId).toBe(TARGET)

    fireEvent.click(screen.getByRole('button', { name: /open in explorer/i }))
    expect(onOpenStructure).toHaveBeenCalledWith(TARGET)
  })

  it('closes the correlation again for the next airway', async () => {
    const { container } = await renderNameQuiz()
    fireEvent.click(screen.getByRole('button', { name: OPTION_NAMES[1] }))
    await screen.findByRole('img', { name: /Axial CT slice/ })

    buildIdentifyQuestionMock.mockReturnValue({
      target: 'lb6',
      options: ['rb7', 'rb6', 'rb8', 'lb6'],
    })
    model3DMock.mockClear()
    fireEvent.click(screen.getByRole('button', { name: /next airway/i }))

    await waitFor(() => expect(optionButtons()[0]).toBeEnabled())
    expect(container.querySelector('img[src*="/airway-lesson/ct/"]')).toBeNull()
    expect(propsGivenTo3D().some((props) => props.selectedId === 'lb6')).toBe(false)
    expect(perceivableOutsideChoices(container)).not.toMatch(/LLL superior segment|\bLB6\b/i)
  })
})

const overlay: OverlayData = {
  meta: {
    video: 'airway-survey-cropped.mp4',
    poster: 'airway-survey-poster-cropped.jpg',
    width: 1368,
    height: 1080,
    fps: 60,
    duration: 4,
    frameCount: 240,
    step: 2,
    sourceWidth: 1920,
    sourceHeight: 1080,
    crop: { x: 552, y: 0, width: 1368, height: 1080 },
  },
  structures: [
    {
      key: 'RB6',
      name: 'RLL superior segment (RB6)',
      short: 'RB6',
      node: 'rb6',
      lobe: 'RLL',
      group: 'RLL',
      shape: 'poly',
      first: 0,
      last: 2,
    },
    {
      key: 'RB7',
      name: 'RLL medial basal segment (RB7)',
      short: 'RB7',
      node: 'rb7',
      lobe: 'RLL',
      group: 'RLL',
      shape: 'poly',
      first: 0,
      last: 2,
    },
  ],
  frames: [
    [
      0,
      [
        [0, 100, 100, 200, 100, 200, 200, 100, 200],
        [1, 500, 100, 600, 100, 600, 200, 500, 200],
      ],
    ],
  ],
}

describe('AirwayIdentifyQuiz — Find the airway', () => {
  beforeEach(() => {
    loadQuizFramesMock.mockResolvedValue(quizFrames)
    loadCtCorrelationMock.mockResolvedValue(ctData)
    loadOverlayDataMock.mockResolvedValue(overlay)
    buildIdentifyQuestionMock.mockReturnValue({
      target: TARGET,
      options: ['rb7', 'rb6', 'rb8', 'lb6'],
    })
    jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    jest
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({ left: 0, top: 0, width: 1368, height: 1080 } as DOMRect)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('keeps the CT and 3D closed until a marker is chosen, then opens them for the target', async () => {
    // The first candidate frame and its first target: RB6, the marker at (150, 150).
    jest.spyOn(Math, 'random').mockReturnValue(0)
    const { container } = render(<AirwayIdentifyQuiz />)
    await screen.findByRole('button', { name: OPTION_NAMES[1] })
    model3DMock.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /find the airway/i }))
    const section = (await screen.findByRole('heading', { name: /find the airway/i })).closest(
      'section',
    )!
    await within(section).findByText(/^Target:/)

    expect(container.querySelector('img[src*="/airway-lesson/ct/"]')).toBeNull()
    expect(propsGivenTo3D()).toHaveLength(0)

    const svg = section.querySelector('svg.cursor-crosshair')!
    fireEvent.click(svg, { clientX: 150, clientY: 150 })

    expect(
      await within(section).findByText(/Correct - the target is RLL superior segment/),
    ).toBeInTheDocument()
    expect(await within(section).findByRole('img', { name: /Axial CT slice/ })).toHaveAttribute(
      'src',
      '/airway-lesson/ct/rb6-axial.jpg',
    )
    expect(propsGivenTo3D().at(-1)?.selectedId).toBe(TARGET)
  })
})

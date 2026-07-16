import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { loadOverlayData, type OverlayData } from '@/lib/airway-anatomy-lesson/video-atlas'

import { AirwayVideoAtlas } from './AirwayVideoAtlas'

jest.mock('@/lib/airway-anatomy-lesson/video-atlas', () => {
  const actual = jest.requireActual('@/lib/airway-anatomy-lesson/video-atlas')
  return {
    ...actual,
    loadOverlayData: jest.fn(),
  }
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
      key: 'RB1',
      name: 'RUL apical segment (RB1)',
      short: 'RB1',
      node: 'rb1',
      lobe: 'RUL',
      group: 'RUL',
      shape: 'poly',
      first: 0,
      last: 2,
    },
    {
      key: 'RB2',
      name: 'RUL posterior segment (RB2)',
      short: 'RB2',
      node: 'rb2',
      lobe: 'RUL',
      group: 'RUL',
      shape: 'poly',
      first: 0,
      last: 2,
    },
    {
      key: 'RB3',
      name: 'RUL anterior segment (RB3)',
      short: 'RB3',
      node: 'rb3',
      lobe: 'RUL',
      group: 'RUL',
      shape: 'poly',
      first: 0,
      last: 2,
    },
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
  ],
  frames: [
    [
      0,
      [
        [0, 100, 100, 200, 100, 200, 200, 100, 200],
        [1, 300, 100, 400, 100, 400, 200, 300, 200],
        [2, 500, 100, 600, 100, 600, 200, 500, 200],
        [3, 700, 100, 800, 100, 800, 200, 700, 200],
      ],
    ],
  ],
}

const loadOverlayDataMock = loadOverlayData as jest.MockedFunction<typeof loadOverlayData>

function mockCanvas() {
  const context = {
    arc: jest.fn(),
    arcTo: jest.fn(),
    beginPath: jest.fn(),
    clearRect: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    fillText: jest.fn(),
    lineTo: jest.fn(),
    measureText: jest.fn(() => ({ width: 40 })),
    moveTo: jest.fn(),
    setTransform: jest.fn(),
    stroke: jest.fn(),
  }
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)
}

describe('AirwayVideoAtlas', () => {
  beforeEach(() => {
    loadOverlayDataMock.mockResolvedValue(overlay)
    mockCanvas()

    class MockResizeObserver {
      observe() {}
      disconnect() {}
    }
    global.ResizeObserver = MockResizeObserver as never
    jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ left: 0, top: 0, width: 1368, height: 1080 } as DOMRect)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('hides markers while playing, reveals them on pause, and opens marker identification', async () => {
    const { container } = render(<AirwayVideoAtlas />)

    await screen.findByText('Click a marker to identify the airway')
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    fireEvent.loadedData(video!)

    fireEvent.play(video!)
    await screen.findByText('Pause to reveal airway markers')
    expect(screen.queryByText('Click a marker to identify the airway')).not.toBeInTheDocument()

    fireEvent.pause(video!)
    await screen.findByText('Click a marker to identify the airway')

    const stage = video!.parentElement!
    fireEvent.click(stage, { clientX: 150, clientY: 150 })
    await screen.findByText('Which airway or upper-airway structure did you click?')

    fireEvent.click(screen.getAllByRole('button', { name: /RUL apical segment/ })[0])
    await waitFor(() => {
      expect(screen.getByText(/Correct - this is RUL apical segment/)).toBeInTheDocument()
    })
  })

  it('surfaces browser playback failures', async () => {
    const playMock = HTMLMediaElement.prototype.play as jest.MockedFunction<
      HTMLMediaElement['play']
    >
    playMock.mockRejectedValueOnce(new Error('Playback blocked'))

    render(<AirwayVideoAtlas />)

    await screen.findByText('Click a marker to identify the airway')

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    await screen.findByText('Unable to start the bronchoscopy video: Playback blocked')
    expect(playMock).toHaveBeenCalled()
  })
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PccmCourseVideoCard } from './PccmCourseVideoCard'

const testVideo = {
  courseSection: 'bronchoscopy' as const,
  id: 'ucsd-bronch-test-video',
  title: 'Test Bronchoscopy Video',
}

describe('PccmCourseVideoCard', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/pccm-intro-course/video-url')) {
        return {
          ok: true,
          json: async () => ({
            url: 'https://pccmintro.s3.us-east-1.amazonaws.com/test-video.mp4',
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({ status: 'ok' }),
      } as Response
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('supports podcast-style speed and rewind controls after loading video', async () => {
    const user = userEvent.setup()
    render(<PccmCourseVideoCard locked={false} video={testVideo} />)

    await user.click(screen.getByRole('button', { name: /load video/i }))

    const video = await screen.findByLabelText(`${testVideo.title} course video`)
    expect(video).toBeInstanceOf(HTMLVideoElement)

    await user.click(
      screen.getByRole('button', {
        name: `Set ${testVideo.title} playback speed to 1.5x`,
      }),
    )
    expect((video as HTMLVideoElement).playbackRate).toBe(1.5)

    Object.defineProperty(video, 'duration', {
      configurable: true,
      value: 100,
    })
    ;(video as HTMLVideoElement).currentTime = 40

    await user.click(
      screen.getByRole('button', {
        name: `Rewind 10 seconds for ${testVideo.title}`,
      }),
    )
    expect((video as HTMLVideoElement).currentTime).toBe(30)
    ;(video as HTMLVideoElement).currentTime = 25
    await user.click(
      screen.getByRole('button', {
        name: `Rewind 30 seconds for ${testVideo.title}`,
      }),
    )
    expect((video as HTMLVideoElement).currentTime).toBe(0)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/pccm-intro-course/video-progress', {
        body: expect.any(String),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
    })
  })
})

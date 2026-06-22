import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { JournalClubPodcastBrowser } from './JournalClubPodcastBrowser'
import {
  defaultJournalClubPodcastHub,
  journalClubPodcastEpisodes,
  journalClubPodcastHubs,
  journalClubPodcastTags,
} from '@/data/journal-club-podcasts'

const testEpisodes = journalClubPodcastEpisodes.slice(0, 2)
const crossHubEpisode = journalClubPodcastEpisodes.find(
  (episode) => episode.primaryHub !== defaultJournalClubPodcastHub,
)

describe('JournalClubPodcastBrowser', () => {
  const originalFetch = global.fetch
  let playMock: jest.SpyInstance
  let pauseMock: jest.SpyInstance
  let loadMock: jest.SpyInstance

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://example.supabase.co/signed-audio', expiresIn: 1800 }),
    }) as jest.Mock
    playMock = jest
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockImplementation(function play(this: HTMLMediaElement) {
        this.dispatchEvent(new Event('play'))
        return Promise.resolve()
      })
    pauseMock = jest
      .spyOn(window.HTMLMediaElement.prototype, 'pause')
      .mockImplementation(function pause(this: HTMLMediaElement) {
        this.dispatchEvent(new Event('pause'))
      })
    loadMock = jest.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation()
  })

  afterEach(() => {
    global.fetch = originalFetch
    playMock.mockRestore()
    pauseMock.mockRestore()
    loadMock.mockRestore()
  })

  it('filters episodes by search text', async () => {
    const user = userEvent.setup()
    renderBrowser()

    expect(screen.getByText('Beta listening note')).toBeInTheDocument()
    expect(
      screen.getByText(/entertainment, education, and general discussion/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Available in 5 languages')).toBeInTheDocument()
    const languageList = screen.getByLabelText('Available podcast languages')
    for (const language of ['English', 'Spanish', 'Mandarin', 'Arabic', 'Korean']) {
      expect(within(languageList).getByText(language)).toBeInTheDocument()
    }
    expect(screen.getByText(testEpisodes[0].title)).toBeInTheDocument()
    expect(screen.getByText(testEpisodes[1].title)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/search journal club podcasts/i), 'nomogram')

    expect(screen.queryByText(testEpisodes[0].title)).not.toBeInTheDocument()
    expect(screen.getByText(testEpisodes[1].title)).toBeInTheDocument()
  })

  it('opens publication links in a separate tab', () => {
    renderBrowser()

    const link = screen.getByRole('link', {
      name: `Open publication for ${testEpisodes[0].title} in a new tab`,
    })

    expect(link).toHaveAttribute('href', testEpisodes[0].publicationUrl)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })

  it('starts in all-podcasts mode and sorts titles alphabetically', () => {
    expect(crossHubEpisode).toBeDefined()
    renderBrowser([
      {
        ...testEpisodes[0],
        id: 'zulu-podcast',
        title: 'Zulu podcast',
        audio: {
          english: 'v1/zulu-podcast/english.mp3',
          spanish: 'v1/zulu-podcast/spanish.mp3',
          mandarin: 'v1/zulu-podcast/mandarin.mp3',
          arabic: 'v1/zulu-podcast/arabic.mp3',
          korean: 'v1/zulu-podcast/korean.mp3',
        },
      },
      {
        ...crossHubEpisode!,
        id: 'alpha-podcast',
        title: 'Alpha podcast',
        audio: {
          english: 'v1/alpha-podcast/english.mp3',
          spanish: 'v1/alpha-podcast/spanish.mp3',
          mandarin: 'v1/alpha-podcast/mandarin.mp3',
          arabic: 'v1/alpha-podcast/arabic.mp3',
          korean: 'v1/alpha-podcast/korean.mp3',
        },
      },
    ])

    const allPodcastsButton = screen.getByRole('button', { name: /all podcasts/i })
    expect(allPodcastsButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('2 episodes')).toBeInTheDocument()

    const titles = screen
      .getAllByRole('article')
      .map((article) => within(article).getByRole('heading', { level: 2 }).textContent)
    expect(titles).toEqual(['Alpha podcast', 'Zulu podcast'])
  })

  it('requests a signed URL for the selected language and supports speed changes', async () => {
    const user = userEvent.setup()
    renderBrowser()

    await user.selectOptions(screen.getAllByLabelText('Language')[0], 'korean')
    await user.click(screen.getByRole('button', { name: playButtonName(testEpisodes[0].title) }))
    await user.click(screen.getAllByRole('button', { name: '1.5x' })[0])

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/journal-club-podcasts/audio-url?episodeId=${testEpisodes[0].id}&language=korean`,
        { cache: 'no-store' },
      )
    })
    expect(playMock).toHaveBeenCalled()
  })

  it('records podcast playback with episode, language, and progress context', async () => {
    const user = userEvent.setup()
    renderBrowser()
    const audio = document.querySelector('audio') as HTMLAudioElement

    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: 600,
    })

    await user.selectOptions(screen.getAllByLabelText('Language')[0], 'korean')
    audio.currentTime = 30
    await user.click(screen.getByRole('button', { name: playButtonName(testEpisodes[0].title) }))

    await waitFor(() => {
      expect(playbackFetchCall()).toBeDefined()
    })

    const playbackBody = JSON.parse(playbackFetchCall()![1].body as string)
    expect(playbackBody).toMatchObject({
      currentTimeSeconds: 30,
      durationSeconds: 600,
      episodeId: testEpisodes[0].id,
      eventType: 'play_started',
      language: 'korean',
      percentComplete: 5,
      playbackRate: 1,
    })
    expect(playbackBody.playbackSessionId).toEqual(expect.any(String))
  })

  it('supports 10 and 30 second seek controls', async () => {
    const user = userEvent.setup()
    renderBrowser()
    const audio = document.querySelector('audio') as HTMLAudioElement

    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: 100,
    })
    audio.currentTime = 40

    await user.click(seekButton('Rewind', 10, testEpisodes[0].title))
    expect(audio.currentTime).toBe(30)

    await user.click(seekButton('Advance', 30, testEpisodes[0].title))
    expect(audio.currentTime).toBe(60)

    audio.currentTime = 95
    await user.click(seekButton('Advance', 30, testEpisodes[0].title))
    expect(audio.currentTime).toBe(100)

    audio.currentTime = 5
    await user.click(seekButton('Rewind', 30, testEpisodes[0].title))
    expect(audio.currentTime).toBe(0)
  })

  it('submits separate podcast feedback ratings with the selected language', async () => {
    const user = userEvent.setup()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    }) as jest.Mock
    renderBrowser()
    const firstArticle = screen.getAllByRole('article')[0]

    await user.selectOptions(within(firstArticle).getByLabelText('Language used'), 'spanish')
    await user.click(
      within(firstArticle).getByRole('button', {
        name: 'Content quality: 5 out of 5 stars',
      }),
    )
    await user.click(
      within(firstArticle).getByRole('button', {
        name: 'Audio/dialog quality: 3 out of 5 stars',
      }),
    )
    await user.click(within(firstArticle).getByRole('button', { name: /submit rating/i }))

    await waitFor(() => {
      expect(feedbackFetchCall()).toBeDefined()
    })
    const feedbackBody = JSON.parse(feedbackFetchCall()![1].body as string)
    expect(feedbackBody).toMatchObject({
      audioDialogRating: 3,
      contentQualityRating: 5,
      currentTimeSeconds: 0,
      durationSeconds: null,
      episodeId: testEpisodes[0].id,
      language: 'spanish',
      listenedSeconds: 0,
      percentComplete: 0,
    })
    expect(feedbackBody.playbackSessionId).toEqual(expect.any(String))
    expect(screen.getByText('Thanks. Your rating was saved.')).toBeInTheDocument()
  })

  it('pauses the previous episode when another episode starts', async () => {
    const user = userEvent.setup()
    renderBrowser()

    await user.click(screen.getByRole('button', { name: playButtonName(testEpisodes[0].title) }))
    await user.click(screen.getByRole('button', { name: playButtonName(testEpisodes[1].title) }))

    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(2)
    })
    expect(pauseMock).toHaveBeenCalled()
  })
})

function renderBrowser(episodes = testEpisodes) {
  render(
    <JournalClubPodcastBrowser
      episodes={episodes}
      hubs={journalClubPodcastHubs}
      tags={journalClubPodcastTags}
    />,
  )
}

function playButtonName(title: string) {
  return new RegExp(`play ${escapeRegExp(title)}`, 'i')
}

function seekButton(direction: 'Advance' | 'Rewind', seconds: number, title: string) {
  return screen.getByRole('button', {
    name: `${direction} ${seconds} seconds for ${title}`,
  })
}

function playbackFetchCall() {
  return (global.fetch as jest.Mock).mock.calls.find(
    ([url]) => url === '/api/journal-club-podcasts/playback',
  )
}

function feedbackFetchCall() {
  return (global.fetch as jest.Mock).mock.calls.find(
    ([url]) => url === '/api/journal-club-podcasts/feedback',
  )
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

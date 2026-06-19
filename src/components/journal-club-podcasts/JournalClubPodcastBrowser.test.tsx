import { render, screen, waitFor } from '@testing-library/react'
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

  it('can browse all podcasts across hubs', async () => {
    const user = userEvent.setup()
    expect(crossHubEpisode).toBeDefined()
    renderBrowser([testEpisodes[0], crossHubEpisode!])

    expect(screen.getByText(testEpisodes[0].title)).toBeInTheDocument()
    expect(screen.queryByText(crossHubEpisode!.title)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /all podcasts/i }))

    expect(screen.getByText(testEpisodes[0].title)).toBeInTheDocument()
    expect(screen.getByText(crossHubEpisode!.title)).toBeInTheDocument()
    expect(screen.getByText('2 episodes')).toBeInTheDocument()
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
      defaultHub={defaultJournalClubPodcastHub}
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

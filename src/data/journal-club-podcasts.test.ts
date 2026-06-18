import {
  journalClubPodcastEpisodes,
  journalClubPodcastHubs,
  podcastLanguages,
} from './journal-club-podcasts'

describe('journal club podcast data', () => {
  it('contains the complete beta episode set', () => {
    expect(journalClubPodcastEpisodes).toHaveLength(54)
  })

  it('assigns each episode to one known primary hub', () => {
    const hubs = new Set<string>(journalClubPodcastHubs)

    for (const episode of journalClubPodcastEpisodes) {
      expect(hubs.has(episode.primaryHub)).toBe(true)
    }
  })

  it('includes exactly one private object path per supported language', () => {
    for (const episode of journalClubPodcastEpisodes) {
      expect(Object.keys(episode.audio).sort()).toEqual([...podcastLanguages].sort())

      for (const language of podcastLanguages) {
        const objectPath = episode.audio[language]
        expect(objectPath).toBe(`v1/${episode.id}/${language}.mp3`)
        expect(objectPath).not.toMatch(/\.txt|\.pdf|Completed_podcasts|podcasts\//)
      }
    }
  })

  it('uses publication discovery links instead of local PDFs', () => {
    for (const episode of journalClubPodcastEpisodes) {
      const url = new URL(episode.publicationUrl)
      expect(url.protocol).toBe('https:')
      expect(url.href).not.toContain('.pdf')
      expect(url.hostname).not.toMatch(/localhost|127\.0\.0\.1/)
    }
  })
})

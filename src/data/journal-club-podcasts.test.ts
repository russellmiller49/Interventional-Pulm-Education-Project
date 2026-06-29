import {
  journalClubPodcastEpisodes,
  journalClubPodcastHubs,
  landmarkJournalClubPodcastHub,
  landmarkPodcastTag,
  podcastLanguages,
} from './journal-club-podcasts'

describe('journal club podcast data', () => {
  it('contains the complete beta episode set', () => {
    expect(journalClubPodcastEpisodes).toHaveLength(78)
  })

  it('assigns each episode to known hubs', () => {
    const hubs = new Set<string>(journalClubPodcastHubs)

    for (const episode of journalClubPodcastEpisodes) {
      expect(hubs.has(episode.primaryHub)).toBe(true)

      for (const secondaryHub of episode.secondaryHubs ?? []) {
        expect(hubs.has(secondaryHub)).toBe(true)
        expect(secondaryHub).not.toBe(episode.primaryHub)
      }
    }
  })

  it('labels landmark studies in the landmark hub and visible tag set', () => {
    const landmarkEpisodes = journalClubPodcastEpisodes.filter((episode) =>
      episode.secondaryHubs?.includes(landmarkJournalClubPodcastHub),
    )

    expect(landmarkEpisodes).toHaveLength(25)
    expect(
      journalClubPodcastEpisodes.find((episode) => episode.id === 'navigation-vs-ttnb')?.tags,
    ).toContain(landmarkPodcastTag)

    for (const episode of landmarkEpisodes) {
      expect(episode.tags[0]).toBe(landmarkPodcastTag)
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

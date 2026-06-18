import {
  DEFAULT_JOURNAL_CLUB_AUDIO_TTL_SECONDS,
  isPodcastLanguage,
  resolveJournalClubAudioPath,
  resolveJournalClubAudioTtl,
} from './audio'

describe('journal club podcast audio resolver', () => {
  it('resolves known episode and language pairs to manifest object paths', () => {
    expect(resolveJournalClubAudioPath('navigation-vs-ttnb', 'english')).toEqual({
      episodeId: 'navigation-vs-ttnb',
      language: 'english',
      objectPath: 'v1/navigation-vs-ttnb/english.mp3',
    })
  })

  it('normalizes language case before resolving', () => {
    expect(resolveJournalClubAudioPath('navigation-vs-ttnb', 'Spanish')?.objectPath).toBe(
      'v1/navigation-vs-ttnb/spanish.mp3',
    )
  })

  it('rejects unknown episodes and unsupported languages', () => {
    expect(resolveJournalClubAudioPath('not-real', 'english')).toBeNull()
    expect(resolveJournalClubAudioPath('navigation-vs-ttnb', 'french')).toBeNull()
    expect(resolveJournalClubAudioPath('../navigation-vs-ttnb', 'english')).toBeNull()
  })

  it('identifies supported podcast languages', () => {
    expect(isPodcastLanguage('english')).toBe(true)
    expect(isPodcastLanguage('spanish')).toBe(true)
    expect(isPodcastLanguage('mandarin')).toBe(true)
    expect(isPodcastLanguage('Portuguese')).toBe(false)
  })

  it('bounds signed URL TTLs', () => {
    expect(resolveJournalClubAudioTtl('not-a-number')).toBe(DEFAULT_JOURNAL_CLUB_AUDIO_TTL_SECONDS)
    expect(resolveJournalClubAudioTtl('10')).toBe(60)
    expect(resolveJournalClubAudioTtl('7200')).toBe(3600)
    expect(resolveJournalClubAudioTtl('900')).toBe(900)
  })
})

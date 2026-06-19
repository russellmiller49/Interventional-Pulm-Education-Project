import type { Metadata } from 'next'

import { JournalClubPodcastBrowser } from '@/components/journal-club-podcasts/JournalClubPodcastBrowser'
import {
  defaultJournalClubPodcastHub,
  journalClubPodcastEpisodes,
  journalClubPodcastHubs,
  journalClubPodcastTags,
} from '@/data/journal-club-podcasts'

export const metadata: Metadata = {
  title: 'Journal Club Podcasts',
  description:
    'Beta journal club audio library for interventional pulmonology articles in English, Spanish, Mandarin, Arabic, and Korean.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function JournalClubPodcastsPage() {
  return (
    <JournalClubPodcastBrowser
      episodes={journalClubPodcastEpisodes}
      hubs={journalClubPodcastHubs}
      tags={journalClubPodcastTags}
      defaultHub={defaultJournalClubPodcastHub}
    />
  )
}

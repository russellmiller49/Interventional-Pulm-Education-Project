import type { Metadata } from 'next'

import { JournalClubPodcastBrowser } from '@/components/journal-club-podcasts/JournalClubPodcastBrowser'
import {
  journalClubPodcastEpisodes,
  journalClubPodcastHubs,
  journalClubPodcastTags,
} from '@/data/journal-club-podcasts'

export const metadata: Metadata = {
  title: 'Journal Club Podcasts',
  description:
    'Journal club audio library for interventional pulmonology articles in English, Spanish, Mandarin, Arabic, and Korean.',
}

export default function JournalClubPodcastsPage() {
  return (
    <JournalClubPodcastBrowser
      episodes={journalClubPodcastEpisodes}
      hubs={journalClubPodcastHubs}
      tags={journalClubPodcastTags}
    />
  )
}

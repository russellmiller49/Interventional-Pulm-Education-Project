import type { Metadata } from 'next'

import { JournalClubPodcastBrowser } from '@/components/journal-club-podcasts/JournalClubPodcastBrowser'
import {
  journalClubPodcastEpisodes,
  journalClubPodcastHubs,
  journalClubPodcastTags,
} from '@/data/journal-club-podcasts'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Journal Club Podcasts',
  description:
    'Journal club audio library for interventional pulmonology articles in English, Spanish, Mandarin, Arabic, and Korean.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function JournalClubPodcastsPage() {
  return (
    <HandoffContent>
      {
        <JournalClubPodcastBrowser
          episodes={journalClubPodcastEpisodes}
          hubs={journalClubPodcastHubs}
          tags={journalClubPodcastTags}
        />
      }
    </HandoffContent>
  )
}

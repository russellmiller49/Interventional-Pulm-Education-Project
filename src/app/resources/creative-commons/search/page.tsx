import type { Metadata } from 'next'

import { CreativeCommonsSearchClient } from './search-client'

export const metadata: Metadata = {
  title: 'Search Creative Commons Images',
  description: 'Search curated Creative Commons medical images for educational use.',
}

interface SearchPageProps {
  searchParams?: Promise<{
    q?: string | string[]
  }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = Array.isArray(params?.q) ? params?.q[0] : params?.q

  return <CreativeCommonsSearchClient initialSearchTerm={query ?? ''} />
}

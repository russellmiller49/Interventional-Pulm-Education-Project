import type { MetadataRoute } from 'next'

import { areDraftModulesEnabled } from '@/lib/draft-modules'
import { env } from '@/lib/env'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL

  const publicRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/socal-ebus-course`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/bronch-navigation-trainer`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ]

  const draftRoutes: MetadataRoute.Sitemap = areDraftModulesEnabled
    ? [
        {
          url: `${baseUrl}/pleural-procedures`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        },
        {
          url: `${baseUrl}/pleural-procedures/chest-drainage`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        },
        {
          url: `${baseUrl}/pleural-procedures/pleural-fluid-analysis`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        },
        {
          url: `${baseUrl}/rapid-onsite-cytology`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        },
      ]
    : []

  return [...publicRoutes, ...draftRoutes]
}

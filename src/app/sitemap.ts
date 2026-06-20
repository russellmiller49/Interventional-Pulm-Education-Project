import type { MetadataRoute } from 'next'

import { publicEbusTrainingModules } from '@/data/ebus-training'
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
      url: `${baseUrl}/ebus-training`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...publicEbusTrainingModules.map((module) => ({
      url: `${baseUrl}${module.href}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    {
      url: `${baseUrl}/tnm-9-staging`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/socal-ebus-course`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/bronch-navigation-trainer`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/learn/anatomy`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/board-prep`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/journal-club-podcasts`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/fluoroview`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/resources`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  const draftRoutes: MetadataRoute.Sitemap = areDraftModulesEnabled
    ? [
        {
          url: `${baseUrl}/rapid-onsite-cytology`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        },
        {
          url: `${baseUrl}/pleural-procedures`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        },
        {
          url: `${baseUrl}/pleural-procedures/intro-course`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.75,
        },
        {
          url: `${baseUrl}/pleural-procedures/pleural-ultrasound`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.75,
        },
        {
          url: `${baseUrl}/pleural-procedures/chest-drainage`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.75,
        },
        {
          url: `${baseUrl}/pleural-procedures/pleural-fluid-analysis`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.75,
        },
        {
          url: `${baseUrl}/pleural-procedures/pneumothorax-pathway`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.75,
        },
      ]
    : []

  return [...publicRoutes, ...draftRoutes]
}

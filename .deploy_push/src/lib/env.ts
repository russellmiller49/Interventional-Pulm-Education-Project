import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  GITHUB_TOKEN: z.string().min(1).optional(),
  ANALYTICS_PROVIDER: z.enum(['none', 'plausible', 'ga4']).default('none'),
})

const parsedEnv = envSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  ANALYTICS_PROVIDER: process.env.ANALYTICS_PROVIDER ?? 'none',
})

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables', parsedEnv.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsedEnv.data

export type Env = typeof env

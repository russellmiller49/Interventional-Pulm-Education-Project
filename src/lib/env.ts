import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_PROJECT_REF: z.string().min(1).optional(),
  GITHUB_TOKEN: z.string().min(1).optional(),
  ANALYTICS_PROVIDER: z.enum(['none', 'plausible', 'ga4']).default('none'),
})

const parsedEnv = envSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_PROJECT_REF: process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  ANALYTICS_PROVIDER: process.env.ANALYTICS_PROVIDER ?? 'none',
})

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables', parsedEnv.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsedEnv.data

export type Env = typeof env

import { revalidateTag } from 'next/cache'
import { z } from 'zod'

import { env } from '@/lib/env'
import type {
  GitHubContributor,
  GitHubIssue,
  GitHubRelease,
  GitHubRepoStats,
} from '@/lib/types'

type RepoKey = `${string}/${string}`

type FetchTag =
  | `github:repo:${RepoKey}`
  | `github:contributors:${RepoKey}`
  | `github:issues:${RepoKey}`
  | `github:release:${RepoKey}`

const GITHUB_API_BASE = 'https://api.github.com'
const DEFAULT_REVALIDATE_SECONDS = 300
const GITHUB_USER_AGENT = 'InterventionalPulmApp/1.0 (+https://interventionalpulm.org)'

interface GitHubFetchOptions<T> {
  path: string
  schema: z.ZodType<T>
  tag: FetchTag
  requestLabel: string
  searchParams?: Record<string, string | number | boolean | undefined>
  revalidate?: number
  etag?: string
}

interface GitHubFetchResult<T> {
  data?: T
  meta: {
    status: number
    etag?: string
    rateLimited: boolean
    notModified: boolean
    tag: FetchTag
  }
  error?: string
}

const repoSchema = z.object({
  stargazers_count: z.number(),
  forks_count: z.number(),
  open_issues_count: z.number(),
  watchers_count: z.number().default(0),
  subscribers_count: z.number().default(0),
  updated_at: z.string(),
  default_branch: z.string().optional(),
})

const contributorSchema = z.array(
  z.object({
    login: z.string(),
    contributions: z.number(),
    avatar_url: z.string().url(),
    html_url: z.string().url(),
    type: z.string(),
  })
)

const issueSchema = z.array(
  z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    html_url: z.string().url(),
    created_at: z.string(),
    updated_at: z.string(),
    comments: z.number(),
    user: z
      .object({
        login: z.string(),
        avatar_url: z.string().url(),
        html_url: z.string().url(),
      })
      .nullable(),
    labels: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        color: z.string(),
        description: z.string().nullable(),
      })
    ),
  })
)

const releaseSchema = z.object({
  id: z.number(),
  tag_name: z.string(),
  name: z.string().nullable(),
  html_url: z.string().url(),
  published_at: z.string().nullable(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  body: z.string().nullable(),
})

const DEFAULT_REPO_STATS: GitHubRepoStats = {
  stars: 0,
  forks: 0,
  openIssues: 0,
  watchers: 0,
  updatedAt: '',
}

function buildHeaders(etag?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': GITHUB_USER_AGENT,
  }

  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`
  }

  if (etag) {
    headers['If-None-Match'] = etag
  }

  return headers
}

function buildUrl(path: string, searchParams?: GitHubFetchOptions<unknown>['searchParams']) {
  const url = new URL(path, GITHUB_API_BASE)

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value === undefined) return
      url.searchParams.set(key, String(value))
    })
  }

  return url.toString()
}

function isRateLimited(response: Response): boolean {
  const remaining = response.headers.get('x-ratelimit-remaining')
  if (remaining === '0') {
    return true
  }
  if (response.status === 403 && response.headers.has('x-ratelimit-reset')) {
    return true
  }
  return false
}

async function githubFetch<T>({
  path,
  schema,
  tag,
  requestLabel,
  searchParams,
  revalidate = DEFAULT_REVALIDATE_SECONDS,
  etag,
}: GitHubFetchOptions<T>): Promise<GitHubFetchResult<T>> {
  const url = buildUrl(path, searchParams)

  try {
    const response = await fetch(url, {
      headers: buildHeaders(etag),
      next: { revalidate, tags: [tag] },
    })

    const responseEtag = response.headers.get('etag') ?? undefined
    const rateLimited = isRateLimited(response)

    if (response.status === 304) {
      return {
        meta: {
          status: response.status,
          etag: responseEtag ?? etag,
          rateLimited,
          notModified: true,
          tag,
        },
      }
    }

    if (!response.ok) {
      const errorMessage = `GitHub ${requestLabel} request failed with status ${response.status}`
      if (response.status !== 404) {
        console.warn(errorMessage)
      }

      return {
        meta: {
          status: response.status,
          etag: responseEtag,
          rateLimited,
          notModified: false,
          tag,
        },
        error: errorMessage,
      }
    }

    if (response.status === 204) {
      return {
        meta: {
          status: response.status,
          etag: responseEtag,
          rateLimited,
          notModified: false,
          tag,
        },
        data: undefined,
      }
    }

    const raw = await response.json()
    const parsed = schema.parse(raw)

    return {
      meta: {
        status: response.status,
        etag: responseEtag,
        rateLimited,
        notModified: false,
        tag,
      },
      data: parsed,
    }
  } catch (error) {
    console.error(`GitHub ${requestLabel} request threw`, error)
    return {
      meta: {
        status: 0,
        etag,
        rateLimited: false,
        notModified: false,
        tag,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

function mapRepoStats(payload: z.infer<typeof repoSchema>): GitHubRepoStats {
  return {
    stars: payload.stargazers_count,
    forks: payload.forks_count,
    openIssues: payload.open_issues_count,
    watchers: payload.watchers_count ?? payload.subscribers_count ?? 0,
    updatedAt: payload.updated_at,
    defaultBranch: payload.default_branch,
  }
}

function mapContributors(payload: z.infer<typeof contributorSchema>): GitHubContributor[] {
  return payload.map((item) => ({
    login: item.login,
    contributions: item.contributions,
    avatarUrl: item.avatar_url,
    profileUrl: item.html_url,
    type: item.type,
  }))
}

function mapIssues(payload: z.infer<typeof issueSchema>): GitHubIssue[] {
  return payload.map((issue) => ({
    id: issue.id,
    number: issue.number,
    title: issue.title,
    htmlUrl: issue.html_url,
    labels: issue.labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description,
    })),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    comments: issue.comments,
    author: issue.user
      ? {
          login: issue.user.login,
          avatarUrl: issue.user.avatar_url,
          profileUrl: issue.user.html_url,
        }
      : {
          login: 'ghost',
          avatarUrl: 'https://github.com/ghost.png',
          profileUrl: 'https://github.com/ghost',
        },
  }))
}

function mapRelease(payload: z.infer<typeof releaseSchema>): GitHubRelease {
  return {
    id: payload.id,
    tagName: payload.tag_name,
    name: payload.name,
    htmlUrl: payload.html_url,
    publishedAt: payload.published_at ?? '',
    draft: payload.draft,
    prerelease: payload.prerelease,
    body: payload.body,
  }
}

export interface GitHubApiResult<T> {
  data: T
  meta: GitHubFetchResult<unknown>['meta']
  error?: string
}

interface RepoOptions {
  etag?: string
  revalidate?: number
  previousData?: GitHubRepoStats
}

export async function getRepo(
  owner: string,
  repo: string,
  options?: RepoOptions
): Promise<GitHubApiResult<GitHubRepoStats>> {
  const tag: FetchTag = `github:repo:${owner}/${repo}`
  const result = await githubFetch({
    path: `/repos/${owner}/${repo}`,
    schema: repoSchema,
    tag,
    requestLabel: 'repository',
    revalidate: options?.revalidate,
    etag: options?.etag,
  })

  if (result.meta.notModified && options?.previousData) {
    return { data: options.previousData, meta: result.meta }
  }

  if (!result.data) {
    return {
      data: options?.previousData ?? DEFAULT_REPO_STATS,
      meta: result.meta,
      error: result.error,
    }
  }

  const payload = {
    ...result.data,
    watchers_count: result.data.watchers_count ?? 0,
    subscribers_count: result.data.subscribers_count ?? 0,
  }

  return {
    data: mapRepoStats(payload as z.infer<typeof repoSchema>),
    meta: result.meta,
    error: result.error,
  }
}

interface ContributorsOptions {
  etag?: string
  revalidate?: number
  perPage?: number
  previousData?: GitHubContributor[]
}

export async function getContributors(
  owner: string,
  repo: string,
  options?: ContributorsOptions
): Promise<GitHubApiResult<GitHubContributor[]>> {
  const tag: FetchTag = `github:contributors:${owner}/${repo}`
  const perPage = Math.max(1, Math.min(options?.perPage ?? 30, 100))
  const result = await githubFetch({
    path: `/repos/${owner}/${repo}/contributors`,
    schema: contributorSchema,
    tag,
    requestLabel: 'contributors',
    revalidate: options?.revalidate,
    etag: options?.etag,
    searchParams: {
      per_page: perPage,
      anon: false,
    },
  })

  if (result.meta.notModified && options?.previousData) {
    return { data: options.previousData, meta: result.meta }
  }

  if (!result.data) {
    return {
      data: options?.previousData ?? [],
      meta: result.meta,
      error: result.error,
    }
  }

  return {
    data: mapContributors(result.data),
    meta: result.meta,
    error: result.error,
  }
}

interface IssuesOptions {
  etag?: string
  revalidate?: number
  perPage?: number
  state?: 'open' | 'closed' | 'all'
  previousData?: GitHubIssue[]
}

export async function getIssuesByLabel(
  owner: string,
  repo: string,
  label: string,
  options?: IssuesOptions
): Promise<GitHubApiResult<GitHubIssue[]>> {
  const tag: FetchTag = `github:issues:${owner}/${repo}`
  const perPage = Math.max(1, Math.min(options?.perPage ?? 20, 100))
  const result = await githubFetch({
    path: `/repos/${owner}/${repo}/issues`,
    schema: issueSchema,
    tag,
    requestLabel: 'issues',
    revalidate: options?.revalidate,
    etag: options?.etag,
    searchParams: {
      labels: label,
      state: options?.state ?? 'open',
      per_page: perPage,
      sort: 'created',
      direction: 'desc',
    },
  })

  if (result.meta.notModified && options?.previousData) {
    return { data: options.previousData, meta: result.meta }
  }

  if (!result.data) {
    return {
      data: options?.previousData ?? [],
      meta: result.meta,
      error: result.error,
    }
  }

  return {
    data: mapIssues(result.data),
    meta: result.meta,
    error: result.error,
  }
}

interface ReleaseOptions {
  etag?: string
  revalidate?: number
  previousData?: GitHubRelease | null
}

export async function getLatestRelease(
  owner: string,
  repo: string,
  options?: ReleaseOptions
): Promise<GitHubApiResult<GitHubRelease | null>> {
  const tag: FetchTag = `github:release:${owner}/${repo}`
  const result = await githubFetch({
    path: `/repos/${owner}/${repo}/releases/latest`,
    schema: releaseSchema,
    tag,
    requestLabel: 'latest release',
    revalidate: options?.revalidate,
    etag: options?.etag,
  })

  if (result.meta.status === 404) {
    return { data: null, meta: result.meta, error: result.error }
  }

  if (result.meta.notModified && options?.previousData !== undefined) {
    return { data: options.previousData, meta: result.meta }
  }

  if (!result.data) {
    return {
      data: options?.previousData ?? null,
      meta: result.meta,
      error: result.error,
    }
  }

  return {
    data: mapRelease(result.data),
    meta: result.meta,
    error: result.error,
  }
}

export function revalidateRepoData(owner: string, repo: string) {
  revalidateTag(`github:repo:${owner}/${repo}`)
  revalidateTag(`github:contributors:${owner}/${repo}`)
  revalidateTag(`github:issues:${owner}/${repo}`)
  revalidateTag(`github:release:${owner}/${repo}`)
}

import type { GitHubProject, GitHubRepoStats } from '@/lib/types'
import { getContributors, getRepo } from '@/lib/github-api'

export interface HomepageGitHubData {
  statsBySlug: Map<string, GitHubRepoStats | undefined>
  contributorLogins: Set<string>
  errors: string[]
}

export interface HomepageGitHubOptions {
  repoRevalidate?: number
  contributorRevalidate?: number
  contributorPageSize?: number
}

/**
 * Helper retained for the homepage once GitHub-driven UI is re-enabled.
 * Import and call this from `src/app/page.tsx` when you are ready to surface live stats.
 */
export async function fetchHomepageGitHubData(
  featuredProjects: GitHubProject[],
  {
    repoRevalidate = 300,
    contributorRevalidate = 1800,
    contributorPageSize = 50,
  }: HomepageGitHubOptions = {}
): Promise<HomepageGitHubData> {
  const statsBySlug = new Map<string, GitHubRepoStats | undefined>()
  const contributorLogins = new Set<string>()
  const errors: string[] = []

  await Promise.all(
    featuredProjects.map(async (project) => {
      const { data: repoData, error: repoError } = await getRepo(project.repository.owner, project.repository.name, {
        revalidate: repoRevalidate,
      })

      statsBySlug.set(project.slug, repoData)

      if (repoError) {
        errors.push(repoError)
      }

      const { data: contributors, error: contributorError } = await getContributors(
        project.repository.owner,
        project.repository.name,
        {
          revalidate: contributorRevalidate,
          perPage: contributorPageSize,
        }
      )

      if (contributors && contributors.length > 0) {
        contributors.forEach((contributor) => contributorLogins.add(contributor.login))
      }

      if (contributorError) {
        errors.push(contributorError)
      }
    })
  )

  return {
    statsBySlug,
    contributorLogins,
    errors,
  }
}

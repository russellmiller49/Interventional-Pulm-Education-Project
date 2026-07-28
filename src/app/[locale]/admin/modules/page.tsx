import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { ArrowLeft, EyeOff, Globe, Link2, Lock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  nonPublicModuleGroups,
  getNonPublicModuleStatuses,
  type ModuleAccessMode,
} from '@/lib/non-public-modules'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Modules in development | Admin',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

const accessCopy: Record<
  ModuleAccessMode,
  { label: string; variant: 'success' | 'info' | 'outline'; help: string }
> = {
  'direct-link': {
    label: 'Direct link',
    variant: 'success',
    help: 'Opens without an account. Share the link with a beta tester. Not indexed by search engines.',
  },
  'sign-in': {
    label: 'Sign-in required',
    variant: 'outline',
    help: 'The visitor needs a site account. A beta tester without one is sent to the login page.',
  },
  public: {
    label: 'Public and indexable',
    variant: 'info',
    help: 'Opens without an account and is not marked noindex, so search engines may list it.',
  },
}

/**
 * One place to find every module that is not part of the public site yet, and to see how each
 * one is actually gated.
 *
 * `/admin` and everything under it already requires the `site_admin` entitlement, enforced in
 * the proxy — this page adds no gate of its own. The access column is computed from the same
 * predicates the proxy uses rather than recorded by hand, so it cannot claim a level the site
 * does not enforce.
 */
export default async function AdminModulesPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  const modules = getNonPublicModuleStatuses()
  const shareable = modules.filter((entry) => entry.accessMode === 'direct-link')

  return (
    <div className="container space-y-8 py-8 md:py-12">
      <header className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link href={`/${locale}/admin` as Route}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Admin dashboard
          </Link>
        </Button>
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Admin</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-foreground">
            Modules in development
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {`Every module that is not part of the public site yet. ${shareable.length} of ${modules.length} open by direct link, so a beta tester can use them without an account.`}{' '}
            Access is read from the site&rsquo;s own gate, not recorded here, so this page always
            matches what the site actually enforces.
          </p>
        </div>
      </header>

      <section
        aria-label="What the access labels mean"
        className="rounded-2xl border border-border/70 bg-muted/30 p-5 text-sm"
      >
        <dl className="grid gap-4 md:grid-cols-3">
          {(Object.keys(accessCopy) as ModuleAccessMode[]).map((mode) => (
            <div key={mode}>
              <dt>
                <Badge
                  variant={accessCopy[mode].variant}
                  size="sm"
                  className="normal-case tracking-normal"
                >
                  {accessCopy[mode].label}
                </Badge>
              </dt>
              <dd className="mt-2 leading-6 text-muted-foreground">{accessCopy[mode].help}</dd>
            </div>
          ))}
        </dl>
      </section>

      {nonPublicModuleGroups.map((group) => {
        const groupModules = modules.filter((entry) => entry.group === group)
        if (groupModules.length === 0) return null
        return (
          <section key={group}>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">{group}</h2>
              <Badge variant="outline">{groupModules.length}</Badge>
            </div>
            <div className="space-y-3">
              {groupModules.map((entry) => {
                const access = accessCopy[entry.accessMode]
                const href = `/${locale}${entry.path}` as Route
                return (
                  <article
                    key={entry.path}
                    className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-foreground">{entry.title}</h3>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {entry.path}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={access.variant}
                          size="sm"
                          className="gap-1 normal-case tracking-normal"
                        >
                          {entry.accessMode === 'direct-link' ? (
                            <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
                          ) : entry.accessMode === 'public' ? (
                            <Globe aria-hidden="true" className="h-3.5 w-3.5" />
                          ) : (
                            <Lock aria-hidden="true" className="h-3.5 w-3.5" />
                          )}
                          {access.label}
                        </Badge>
                        {entry.hiddenFromNavigation ? (
                          <Badge
                            variant="outline"
                            size="sm"
                            className="gap-1 normal-case tracking-normal"
                          >
                            <EyeOff aria-hidden="true" className="h-3.5 w-3.5" />
                            Not in navigation
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{entry.summary}</p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button asChild size="sm">
                        <Link href={href}>Open module</Link>
                      </Button>
                      {entry.accessMode === 'direct-link' ? (
                        <code className="rounded-lg bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                          {href}
                        </code>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

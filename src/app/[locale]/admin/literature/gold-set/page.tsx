import type { Metadata } from 'next'
import { ArrowLeft, Database, Download, FlaskConical, ShieldCheck } from 'lucide-react'
import { setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GoldSetBatchFreezeButton } from '@/features/literature/components/GoldSetBatchFreezeButton'
import { GoldSetReviewWorkspace } from '@/features/literature/components/GoldSetReviewWorkspace'
import { literatureGoldBatchQuerySchema } from '@/features/literature/schemas/gold-set'
import { requireLiteratureSiteAdminPage } from '@/features/literature/server/access'
import {
  listLiteratureGoldSetBatches,
  loadLiteratureGoldReviewItem,
} from '@/features/literature/server/gold-set'
import { isActiveLocale, type ActiveLocale } from '@/i18n/locale'
import { Link } from '@/i18n/navigation'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Gold Set Review | IP Literature',
  robots: { index: false, follow: false },
}

interface GoldSetPageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function resolveLocale(locale: string): ActiveLocale {
  return isActiveLocale(locale) ? locale : 'en'
}

export default async function LiteratureGoldSetPage({ params, searchParams }: GoldSetPageProps) {
  const { locale: rawLocale } = await params
  const locale = resolveLocale(rawLocale)
  setRequestLocale(locale)
  await requireLiteratureSiteAdminPage(locale, '/admin/literature/gold-set')

  const rawQuery = await searchParams
  const query = literatureGoldBatchQuerySchema.safeParse({
    batchId: first(rawQuery?.batch),
    itemId: first(rawQuery?.item),
    status: first(rawQuery?.status) ?? 'unresolved',
    split: first(rawQuery?.split) ?? 'development',
  })
  const filters = query.success ? query.data : literatureGoldBatchQuerySchema.parse({})
  const [batchesResult, itemResult] = await Promise.all([
    listLiteratureGoldSetBatches(),
    loadLiteratureGoldReviewItem(filters.batchId, filters.itemId, filters.status, filters.split),
  ])
  const batches = batchesResult.data ?? []
  const selectedBatch =
    batches.find((batch) => batch.id === (filters.batchId ?? itemResult.data?.batchId)) ??
    batches[0]

  return (
    <div className="container space-y-7 py-8 md:py-12">
      <Link
        href="/admin/literature"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Literature administration
      </Link>

      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Single reviewer</Badge>
            <Badge variant="outline">Blinded first pass</Badge>
            <Badge variant="outline">Immutable revisions</Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Literature Gold Set Review
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            Label unique PubMed articles for relevance, metadata sufficiency, and — only when
            included — IP categorization. Your first decision is stored before automated signals can
            be revealed.
          </p>
        </div>
        {selectedBatch ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a
                href={`/api/admin/literature/gold-set/export?batchId=${selectedBatch.id}&format=csv&split=all`}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export CSV
              </a>
            </Button>
            <Button asChild variant="outline">
              <a
                href={`/api/admin/literature/gold-set/export?batchId=${selectedBatch.id}&format=json&split=all`}
              >
                Export JSON
              </a>
            </Button>
          </div>
        ) : null}
      </header>

      {batchesResult.error || itemResult.error ? (
        <Card className="border-destructive/40">
          <CardContent className="p-5 text-sm">
            {batchesResult.error ?? itemResult.error}. Start the isolated database with{' '}
            <code>npm run literature:local:start</code>, then restart the development server.
          </CardContent>
        </Card>
      ) : null}

      {batches.length > 0 ? (
        <>
          <Card>
            <CardContent className="gap-5 p-5">
              <form
                action={`/${locale}/admin/literature/gold-set`}
                method="get"
                className="grid gap-4 md:grid-cols-[minmax(16rem,1fr)_12rem_12rem_auto] md:items-end"
              >
                <label className="space-y-2 text-sm font-medium">
                  <span>Batch</span>
                  <select
                    name="batch"
                    defaultValue={selectedBatch?.id}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3"
                  >
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name} — {batch.completedCount}/{batch.totalCount}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  <span>Dataset split</span>
                  <select
                    name="split"
                    defaultValue={filters.split}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3"
                  >
                    <option value="development">Development</option>
                    <option value="test">Locked test</option>
                    <option value="all">All (inspection)</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  <span>Queue filter</span>
                  <select
                    name="status"
                    defaultValue={filters.status}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3"
                  >
                    <option value="unresolved">Unresolved</option>
                    <option value="return_later">Return later</option>
                    <option value="completed">Completed</option>
                    <option value="all">All items</option>
                  </select>
                </label>
                <Button type="submit">Open queue</Button>
              </form>
              {selectedBatch ? (
                <div className="grid gap-3 border-t border-border/70 pt-5 sm:grid-cols-2 lg:grid-cols-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-semibold">{selectedBatch.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Kind</p>
                    <p className="font-semibold">{selectedBatch.kind.replaceAll('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Completed</p>
                    <p className="font-semibold">{selectedBatch.completedCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className="font-semibold">{selectedBatch.remainingCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Development</p>
                    <p className="font-semibold">{selectedBatch.developmentCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Locked test</p>
                    <p className="font-semibold">{selectedBatch.testCount}</p>
                  </div>
                </div>
              ) : null}
              {selectedBatch?.status === 'active' &&
              selectedBatch.totalCount > 0 &&
              selectedBatch.completedCount === selectedBatch.totalCount ? (
                <GoldSetBatchFreezeButton batchId={selectedBatch.id} />
              ) : null}
            </CardContent>
          </Card>

          {itemResult.data ? (
            <GoldSetReviewWorkspace
              key={itemResult.data.id}
              item={itemResult.data}
              locale={locale}
              queueSplit={filters.split}
            />
          ) : (
            <Card>
              <CardContent className="items-center p-10 text-center">
                <ShieldCheck className="h-10 w-10 text-emerald-500" aria-hidden="true" />
                <h2 className="text-xl font-semibold">No articles match this queue filter</h2>
                <p className="max-w-xl text-sm text-muted-foreground">
                  If the unresolved queue is empty, the batch is ready for a final review and
                  freeze. Use the batch selector to inspect completed or return-later items.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <Database className="h-6 w-6 text-primary" aria-hidden="true" />
              <CardTitle>1. Start the local database</CardTitle>
              <CardDescription>
                The literature schema and data stay on this computer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <code className="whitespace-pre-wrap break-all rounded-xl bg-muted p-3 text-xs">
                npm run literature:local:start
              </code>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <FlaskConical className="h-6 w-6 text-primary" aria-hidden="true" />
              <CardTitle>2. Load the corpus and pilot</CardTitle>
              <CardDescription>
                Use the validated manifest, then inspect the sampling report before committing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <code className="whitespace-pre-wrap break-all rounded-xl bg-muted p-3 text-xs">
                npm run literature:import -- --manifest
                local-data/literature/ip-corpus-manifest.v1.json --commit --target local
              </code>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
              <CardTitle>3. Label and freeze</CardTitle>
              <CardDescription>
                Autosaved drafts are mutable; completed reviews become immutable revisions.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}
    </div>
  )
}

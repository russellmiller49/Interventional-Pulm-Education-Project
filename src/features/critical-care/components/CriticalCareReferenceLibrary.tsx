'use client'

import type { Route } from 'next'
import { useEffect, useMemo, useRef, useState } from 'react'
import Fuse from 'fuse.js'
import { Bookmark, BookmarkCheck, Search } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import {
  type CriticalCarePublicClientCatalog,
  type PublicCriticalCareReferenceItem,
} from '../content/publicCatalogTypes'
import {
  criticalCareNotebookItemKey,
  createEmptyCriticalCareNotebook,
  isCriticalCareNotebookItemSaved,
  readCriticalCareNotebook,
  toggleCriticalCareNotebookItem,
  writeCriticalCareNotebook,
  type CriticalCareNotebook,
} from '../notebook'
import {
  publicCriticalCareSearchCategories,
  recordPublicCriticalCareReferenceEvent,
  type PublicCriticalCareSearchCategory,
} from '../publicAnalytics'

function queryLengthBucket(length: number): string {
  if (length === 0) return 'none'
  if (length <= 3) return '1-3'
  if (length <= 12) return '4-12'
  return '13-plus'
}

function criticalCareAnalyticsCategory(value: string): PublicCriticalCareSearchCategory {
  return publicCriticalCareSearchCategories.find((category) => category === value) ?? 'all'
}

export function CriticalCareReferenceLibrary({
  catalog,
  selectedItemId,
}: {
  readonly catalog: CriticalCarePublicClientCatalog
  readonly selectedItemId?: string
}) {
  const referenceLibraryItems = catalog.referenceItems
  const publicReferenceCompetencyIds = useMemo(
    () => new Set(referenceLibraryItems.flatMap((item) => item.competencyIds)),
    [referenceLibraryItems],
  )
  const publicReferenceAssetTypes = useMemo(
    () =>
      [
        ...new Set(
          referenceLibraryItems.flatMap((item) => (item.assetType ? [item.assetType] : [])),
        ),
      ].sort(),
    [referenceLibraryItems],
  )
  const publicNotebookItemKeys = useMemo(
    () => new Set(referenceLibraryItems.map(criticalCareNotebookItemKey)),
    [referenceLibraryItems],
  )
  const [query, setQuery] = useState('')
  const [moduleId, setModuleId] = useState('all')
  const [competencyId, setCompetencyId] = useState('all')
  const [category, setCategory] = useState('all')
  const [assetType, setAssetType] = useState('all')
  const [deviceVersion, setDeviceVersion] = useState('all')
  const [notebook, setNotebook] = useState<CriticalCareNotebook>(createEmptyCriticalCareNotebook)
  const lastNoResultsSignature = useRef<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(
      () => setNotebook(readCriticalCareNotebook(window.localStorage, publicNotebookItemKeys)),
      0,
    )
    return () => window.clearTimeout(timer)
  }, [publicNotebookItemKeys])

  useEffect(() => {
    if (!selectedItemId) return
    const timer = window.setTimeout(() => {
      document.getElementById(selectedItemId)?.focus({ preventScroll: false })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [selectedItemId])

  const fuse = useMemo(
    () =>
      new Fuse(referenceLibraryItems, {
        keys: [
          { name: 'title', weight: 0.4 },
          { name: 'summary', weight: 0.25 },
          { name: 'category', weight: 0.1 },
          { name: 'competencyIds', weight: 0.1 },
          { name: 'evidenceIds', weight: 0.1 },
          { name: 'deviceVersion', weight: 0.05 },
        ],
        includeScore: true,
        threshold: 0.34,
        ignoreLocation: true,
      }),
    [referenceLibraryItems],
  )

  const results = useMemo(() => {
    const searched = query.trim()
      ? fuse.search(query.trim()).map((result) => result.item)
      : referenceLibraryItems
    return searched.filter(
      (item) =>
        (moduleId === 'all' || item.moduleIds.includes(moduleId)) &&
        (competencyId === 'all' || item.competencyIds.includes(competencyId)) &&
        (category === 'all' || item.category === category) &&
        (assetType === 'all' || item.assetType === assetType) &&
        (deviceVersion === 'all' || item.deviceVersion === deviceVersion),
    )
  }, [
    assetType,
    category,
    competencyId,
    deviceVersion,
    fuse,
    moduleId,
    query,
    referenceLibraryItems,
  ])

  useEffect(() => {
    if (results.length > 0 || (!query.trim() && moduleId === 'all' && category === 'all')) {
      lastNoResultsSignature.current = null
      return
    }
    const signature = [
      queryLengthBucket(query.trim().length),
      moduleId,
      competencyId,
      category,
      assetType,
      deviceVersion,
    ].join('|')
    if (lastNoResultsSignature.current === signature) return
    lastNoResultsSignature.current = signature
    recordPublicCriticalCareReferenceEvent({
      interaction: 'critical_care_reference_no_results',
      searchCategory: criticalCareAnalyticsCategory(category),
      resultCount: 0,
    })
  }, [assetType, category, competencyId, deviceVersion, moduleId, query, results.length])

  function toggleSaved(item: PublicCriticalCareReferenceItem) {
    const updated = toggleCriticalCareNotebookItem(
      notebook,
      { id: item.id, kind: item.kind },
      publicNotebookItemKeys,
    )
    setNotebook(updated)
    writeCriticalCareNotebook(window.localStorage, updated)
    if (!isCriticalCareNotebookItemSaved(notebook, item)) {
      recordPublicCriticalCareReferenceEvent({
        interaction: 'critical_care_notebook_saved',
        targetId: item.id,
        targetType: 'reference',
      })
    }
  }

  const deviceVersions = [
    ...new Set(
      referenceLibraryItems.flatMap((item) => (item.deviceVersion ? [item.deviceVersion] : [])),
    ),
  ].sort()
  const savedPublicItemCount = notebook.items.filter((item) =>
    publicNotebookItemKeys.has(`${item.kind}:${item.id}`),
  ).length

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Point-of-use retrieval
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Critical care reference</h1>
          <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
            Search shared waveform, formula, alarm, troubleshooting, safety, device, and model-limit
            records without replaying a lesson.
          </p>
        </div>
        <Link
          href={'/critical-care/notebook' as Route}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-semibold"
        >
          <Bookmark className="size-4" aria-hidden="true" /> Saved notebook ({savedPublicItemCount})
        </Link>
      </div>

      <section
        className="mt-8 rounded-2xl border bg-card p-4"
        aria-label="Reference search and filters"
      >
        <label className="relative block">
          <span className="sr-only">Search critical care reference</span>
          <Search
            className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search waveforms, formulas, alarms, devices, or evidence IDs"
            className="min-h-11 w-full rounded-xl border bg-background py-2 pl-10 pr-3 text-sm"
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="grid gap-1 text-xs font-semibold">
            Module
            <select
              value={moduleId}
              onChange={(event) => setModuleId(event.target.value)}
              className="min-h-11 rounded-xl border bg-background px-2 text-sm font-normal"
            >
              <option value="all">All modules</option>
              {catalog.modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.title}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Competency
            <select
              value={competencyId}
              onChange={(event) => setCompetencyId(event.target.value)}
              className="min-h-11 rounded-xl border bg-background px-2 text-sm font-normal"
            >
              <option value="all">All competencies</option>
              {catalog.competencies
                .filter((competency) => publicReferenceCompetencyIds.has(competency.id))
                .map((competency) => (
                  <option key={competency.id} value={competency.id}>
                    {competency.title}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="min-h-11 rounded-xl border bg-background px-2 text-sm font-normal"
            >
              <option value="all">All categories</option>
              {catalog.referenceCategories.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll('-', ' ')}
                </option>
              ))}
              <option value="asset">assets</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Asset type
            <select
              value={assetType}
              onChange={(event) => setAssetType(event.target.value)}
              className="min-h-11 rounded-xl border bg-background px-2 text-sm font-normal"
            >
              <option value="all">All asset types</option>
              {publicReferenceAssetTypes.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Device/version
            <select
              value={deviceVersion}
              onChange={(event) => setDeviceVersion(event.target.value)}
              className="min-h-11 rounded-xl border bg-background px-2 text-sm font-normal"
            >
              <option value="all">All devices</option>
              {deviceVersions.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <p className="mt-5 text-sm text-muted-foreground" role="status" aria-live="polite">
        {results.length} {results.length === 1 ? 'record' : 'records'}
      </p>
      {results.length === 0 ? (
        <section className="mt-4 rounded-2xl border border-dashed p-8 text-center">
          <h2 className="text-lg font-bold">No matching reference records</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Clear one or more filters or try a broader clinical term. Search text is not sent in
            analytics.
          </p>
        </section>
      ) : (
        <ol className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((item) => {
            const saved = isCriticalCareNotebookItemSaved(notebook, item)
            const relatedActivities = item.relatedActivities
            return (
              <li key={`${item.kind}:${item.id}`}>
                <article
                  id={item.id}
                  tabIndex={-1}
                  className={`h-full rounded-2xl border bg-card p-5 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary ${selectedItemId === item.id ? 'ring-2 ring-primary' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wide text-primary">
                        {item.kind} · {item.category.replaceAll('-', ' ')}
                      </span>
                      <h2 className="mt-2 text-lg font-bold">{item.title}</h2>
                    </div>
                    <button
                      type="button"
                      aria-pressed={saved}
                      aria-label={`${saved ? 'Remove from' : 'Save to'} notebook: ${item.title}`}
                      className="grid size-11 shrink-0 place-items-center rounded-xl border"
                      onClick={() => toggleSaved(item)}
                    >
                      {saved ? (
                        <BookmarkCheck className="size-5" aria-hidden="true" />
                      ) : (
                        <Bookmark className="size-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                  <dl className="mt-4 grid gap-2 border-t pt-4 text-xs">
                    <div>
                      <dt className="font-semibold">Modules</dt>
                      <dd className="mt-1 text-muted-foreground">{item.moduleIds.join(', ')}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Competencies</dt>
                      <dd className="mt-1 text-muted-foreground">
                        {item.competencyIds.join(', ')}
                      </dd>
                    </div>
                    {item.deviceVersion ? (
                      <div>
                        <dt className="font-semibold">Device/version</dt>
                        <dd className="mt-1 text-muted-foreground">{item.deviceVersion}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="font-semibold">Evidence IDs</dt>
                      <dd className="mt-1 text-muted-foreground">
                        {item.evidenceIds.join(', ') || 'Catalog boundary only'}
                      </dd>
                    </div>
                  </dl>
                  {relatedActivities.length > 0 ? (
                    <div className="mt-4 border-t pt-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide">
                        Related learning
                      </h3>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {relatedActivities.map((related) => (
                          <li key={related.id}>
                            <Link
                              href={related.href as Route}
                              className="inline-flex min-h-11 items-center rounded-xl border px-3 py-2 text-sm font-semibold text-primary"
                            >
                              {related.kind === 'assessment' ? 'Open assessment' : related.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <Link
                    href={`/critical-care/reference?item=${encodeURIComponent(item.id)}` as Route}
                    className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary"
                  >
                    Deep link to this record
                  </Link>
                </article>
              </li>
            )
          })}
        </ol>
      )}
    </main>
  )
}

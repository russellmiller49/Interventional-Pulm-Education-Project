'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Clock3,
  Eye,
  History,
  Keyboard,
  Save,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Kbd } from '@/components/ui/kbd'
import { Textarea } from '@/components/ui/textarea'
import {
  flattenLiteratureTaxonomy,
  literatureGoldSetLabels,
  literatureTaxonomy,
} from '@/features/literature/config'
import type {
  LiteratureGoldReviewItem,
  LiteratureGoldReviewPayload,
  LiteratureGoldSetItemAction,
} from '@/features/literature/gold-set/types'
import { literatureGoldCompleteReviewSchema } from '@/features/literature/schemas/gold-set'
import type { ActiveLocale } from '@/i18n/locale'
import { cn } from '@/lib/cn'

interface GoldSetReviewWorkspaceProps {
  item: LiteratureGoldReviewItem
  locale: ActiveLocale
  queueSplit: 'development' | 'test' | 'all'
}

const EMPTY_REVIEW: LiteratureGoldReviewPayload = {
  relevanceLabel: null,
  metadataSufficiency: null,
  reviewerConfidence: null,
  topicIds: [],
  technologyTags: [],
  clinicalPurposes: [],
  diseaseTags: [],
  studyDesign: null,
  publicationStatus: null,
  categorizationFromFullText: false,
  notes: '',
  usedSupplementalMetadata: false,
  reviewSeconds: 0,
}

const relevanceShortcut = {
  '1': 'include_core',
  '2': 'include_adjacent',
  '3': 'exclude',
  '4': 'uncertain',
} as const

const confidenceShortcut = {
  h: 'high',
  m: 'moderate',
  l: 'low',
} as const

const facetLabelOverrides: Record<string, string> = {
  'multiple-general-overview': 'Multiple/general overview',
}

function facetLabel(value: string) {
  const label = facetLabelOverrides[value] ?? value.replaceAll('-', ' ')
  return `${label.charAt(0).toLocaleUpperCase('en-US')}${label.slice(1)}`
}

function CheckboxOptions({
  legend,
  values,
  options,
  onChange,
}: {
  legend: string
  values: string[]
  options: Array<{ id: string; label: string }>
  onChange: (values: string[]) => void
}) {
  const selected = new Set(values)
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.id}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors',
              selected.has(option.id)
                ? 'border-primary/60 bg-primary/5'
                : 'border-border/70 hover:bg-muted/40',
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(option.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...values, option.id]
                    : values.filter((value) => value !== option.id),
                )
              }
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function errorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fallback
  const error = (body as Record<string, unknown>).error
  if (!error || typeof error !== 'object' || Array.isArray(error)) return fallback
  const message = (error as Record<string, unknown>).message
  return typeof message === 'string' ? message : fallback
}

export function GoldSetReviewWorkspace({
  item: initialItem,
  locale,
  queueSplit,
}: GoldSetReviewWorkspaceProps) {
  const router = useRouter()
  const [item, setItem] = useState(initialItem)
  const [review, setReview] = useState<LiteratureGoldReviewPayload>(
    initialItem.draft ??
      (initialItem.currentReview
        ? { ...initialItem.currentReview, reviewSeconds: 0 }
        : EMPTY_REVIEW),
  )
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const dirtyRef = useRef(false)
  const dirtyVersionRef = useRef(0)
  const completingRef = useRef(false)
  const openedAtRef = useRef(Date.now())
  const topicSectionRef = useRef<HTMLDivElement>(null)
  const studyDesignRef = useRef<HTMLSelectElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const frozen = item.batchStatus !== 'active'
  const included =
    review.relevanceLabel === 'include_core' || review.relevanceLabel === 'include_adjacent'

  const broadTopics = useMemo(
    () =>
      flattenLiteratureTaxonomy()
        .filter((topic) => topic.parentId === null)
        .map((topic) => ({
          id: topic.id,
          label:
            locale === 'es'
              ? (topic.labelEs ?? topic.labelEn)
              : locale === 'zh-CN'
                ? (topic.labelZhCn ?? topic.labelEn)
                : topic.labelEn,
        })),
    [locale],
  )
  const relevanceOptions = literatureGoldSetLabels.relevance_labels
  const metadataOptions = literatureGoldSetLabels.metadata_sufficiency_labels
  const confidenceOptions = literatureGoldSetLabels.reviewer_confidence_labels
  const progress = item.totalCount === 0 ? 0 : (item.completedCount / item.totalCount) * 100
  const citation = [
    item.article.journalAbbreviation ?? item.article.journalTitle,
    item.article.publicationYear,
  ]
    .filter(Boolean)
    .join(' · ')
  const authors = item.article.authors
    .slice(0, 6)
    .map((author) => author.abbreviatedName ?? author.fullName)
    .join(', ')

  const setReviewValue = useCallback(
    (update: (current: LiteratureGoldReviewPayload) => LiteratureGoldReviewPayload) => {
      dirtyRef.current = true
      dirtyVersionRef.current += 1
      setSaveState('dirty')
      setReview(update)
    },
    [],
  )

  const elapsedReview = useCallback(
    (payload: LiteratureGoldReviewPayload) => ({
      ...payload,
      reviewSeconds: Math.min(
        86_400,
        payload.reviewSeconds + Math.round((Date.now() - openedAtRef.current) / 1000),
      ),
    }),
    [],
  )

  const request = useCallback(
    async (
      payload:
        | { action: 'save_draft' | 'complete_review'; review: LiteratureGoldReviewPayload }
        | { action: LiteratureGoldSetItemAction },
    ) => {
      const response = await fetch(
        `/api/admin/literature/gold-set/item/${item.id}?split=${queueSplit}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const body = (await response.json().catch(() => null)) as {
        item?: LiteratureGoldReviewItem | null
      } | null
      if (!response.ok) {
        throw new Error(errorMessage(body, 'The review could not be saved.'))
      }
      if (body?.item) setItem(body.item)
      return body
    },
    [item.id, queueSplit],
  )

  useEffect(() => {
    if (!dirtyRef.current || frozen || completingRef.current || saving) return
    const timer = window.setTimeout(() => {
      const payload = elapsedReview(review)
      const savedVersion = dirtyVersionRef.current
      setSaving(true)
      void request({ action: 'save_draft', review: payload })
        .then(() => {
          const fullySaved = dirtyVersionRef.current === savedVersion
          dirtyRef.current = !fullySaved
          setSaveState(fullySaved ? 'saved' : 'dirty')
          openedAtRef.current = Date.now()
          setReview((current) => ({ ...current, reviewSeconds: payload.reviewSeconds }))
        })
        .catch((error: unknown) => {
          setSaveState('error')
          setMessage(error instanceof Error ? error.message : 'Autosave failed.')
        })
        .finally(() => setSaving(false))
    }, 900)
    return () => window.clearTimeout(timer)
  }, [elapsedReview, frozen, request, review, saving])

  const navigate = useCallback(
    (itemId: string | null, status = 'unresolved') => {
      const params = new URLSearchParams({ batch: item.batchId, split: queueSplit, status })
      if (itemId) params.set('item', itemId)
      router.push(`/${locale}/admin/literature/gold-set?${params.toString()}` as Route)
    },
    [item.batchId, locale, queueSplit, router],
  )

  const chooseRelevance = useCallback(
    (value: LiteratureGoldReviewPayload['relevanceLabel']) => {
      setReviewValue((current) => ({
        ...current,
        relevanceLabel: value,
        ...(value === 'include_core' || value === 'include_adjacent'
          ? {}
          : {
              topicIds: [],
              technologyTags: [],
              clinicalPurposes: [],
              diseaseTags: [],
              studyDesign: null,
              publicationStatus: null,
              categorizationFromFullText: false,
            }),
      }))
    },
    [setReviewValue],
  )

  const completeReview = useCallback(async () => {
    if (frozen || saving) return
    const payload = elapsedReview(review)
    const validation = literatureGoldCompleteReviewSchema.safeParse(payload)
    if (!validation.success) {
      setSaveState('error')
      setMessage(validation.error.issues[0]?.message ?? 'Complete the required labels.')
      return
    }

    completingRef.current = true
    setSaving(true)
    setMessage(null)
    try {
      await request({ action: 'complete_review', review: validation.data })
      dirtyRef.current = false
      setSaveState('saved')
      navigate(item.nextUnresolvedItemId)
    } catch (error) {
      completingRef.current = false
      setSaveState('error')
      setMessage(error instanceof Error ? error.message : 'The review could not be completed.')
    } finally {
      setSaving(false)
    }
  }, [elapsedReview, frozen, item.nextUnresolvedItemId, navigate, request, review, saving])

  const runAction = useCallback(
    async (action: LiteratureGoldSetItemAction) => {
      if (frozen || saving) return
      setSaving(true)
      setMessage(null)
      try {
        const body = await request({ action })
        if (action === 'reveal_supplemental') {
          setReviewValue((current) => ({ ...current, usedSupplementalMetadata: true }))
          if (!body?.item) router.refresh()
        } else if (action === 'return_later') {
          navigate(item.nextUnresolvedItemId)
        } else if (!body?.item) {
          router.refresh()
        }
      } catch (error) {
        setSaveState('error')
        setMessage(error instanceof Error ? error.message : 'The action could not be completed.')
      } finally {
        setSaving(false)
      }
    },
    [frozen, item.nextUnresolvedItemId, navigate, request, router, saving, setReviewValue],
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || frozen) return
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT'
      const key = event.key.toLocaleLowerCase('en-US')
      if (!typing && key in relevanceShortcut) {
        event.preventDefault()
        chooseRelevance(relevanceShortcut[key as keyof typeof relevanceShortcut])
      } else if (!typing && key in confidenceShortcut) {
        event.preventDefault()
        setReviewValue((current) => ({
          ...current,
          reviewerConfidence: confidenceShortcut[key as keyof typeof confidenceShortcut],
        }))
      } else if (!typing && key === 't' && included) {
        event.preventDefault()
        topicSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (!typing && key === 's' && included) {
        event.preventDefault()
        studyDesignRef.current?.focus()
      } else if (!typing && key === 'n') {
        event.preventDefault()
        notesRef.current?.focus()
      } else if (event.key === 'Enter' && target?.tagName !== 'TEXTAREA') {
        event.preventDefault()
        void completeReview()
      } else if (!typing && key === 'b' && item.previousItemId) {
        event.preventDefault()
        navigate(item.previousItemId, 'all')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    chooseRelevance,
    completeReview,
    frozen,
    included,
    item.previousItemId,
    navigate,
    setReviewValue,
  ])

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(24rem,0.85fr)]">
      <main className="space-y-6">
        <Card className="overflow-visible">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="info">
                  {item.automatedSignalsRevealed ? 'Post-decision revision' : 'Blinded review'}
                </Badge>
                <Badge variant="outline">PMID {item.article.pmid}</Badge>
                <Badge variant={item.reviewStatus === 'completed' ? 'success' : 'outline'}>
                  {item.reviewStatus.replace('_', ' ')}
                </Badge>
              </div>
              <span className="text-sm font-medium">
                Article {item.displayOrder} of {item.totalCount}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Gold-set review progress"
              aria-valuenow={item.completedCount}
              aria-valuemin={0}
              aria-valuemax={item.totalCount}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {item.completedCount} completed · {item.remainingCount} remaining · automated and
              source-query signals stay hidden until the first decision is submitted.
            </p>
          </CardHeader>
          <CardContent className="gap-5">
            <div>
              <h1 className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
                {item.article.title}
              </h1>
              {authors ? <p className="mt-3 text-sm text-muted-foreground">{authors}</p> : null}
              {citation ? <p className="mt-1 text-sm font-medium">{citation}</p> : null}
              {item.article.publicationTypes.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.article.publicationTypes.map((type) => (
                    <Badge key={type} variant="outline" className="normal-case tracking-normal">
                      {type}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Abstract</h2>
              <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">
                {item.article.abstract ?? 'No abstract is available in the imported PubMed record.'}
              </p>
            </div>
            {!item.supplementalMetadataRevealed ? (
              <Button
                type="button"
                variant="outline"
                disabled={frozen || saving}
                onClick={() => void runAction('reveal_supplemental')}
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                Reveal MeSH and author keywords
              </Button>
            ) : (
              <details
                className="rounded-2xl border border-border/70 p-4"
                open={!item.article.abstract}
              >
                <summary className="cursor-pointer text-sm font-semibold">
                  Supplemental metadata (use recorded)
                </summary>
                <div className="mt-4 space-y-3 text-sm">
                  <p>
                    <strong>MeSH:</strong>{' '}
                    {item.article.meshTerms?.join(' · ') || 'None in the imported record'}
                  </p>
                  <p>
                    <strong>Author keywords:</strong>{' '}
                    {item.article.authorKeywords?.join(' · ') || 'None in the imported record'}
                  </p>
                </div>
              </details>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>1. Relevance decision</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {relevanceOptions.map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={frozen}
                  aria-pressed={review.relevanceLabel === option.id}
                  onClick={() =>
                    chooseRelevance(option.id as LiteratureGoldReviewPayload['relevanceLabel'])
                  }
                  className={cn(
                    'relative rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                    review.relevanceLabel === option.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border/70 hover:bg-muted/40',
                  )}
                >
                  <span className="block pr-10 font-semibold">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {option.description}
                  </span>
                  <Kbd className="absolute right-3 top-3">{index + 1}</Kbd>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Metadata sufficiency and confidence</CardTitle>
          </CardHeader>
          <CardContent className="gap-6">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">Metadata sufficiency</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {metadataOptions.map((option) => (
                  <label
                    key={option.id}
                    className={cn(
                      'flex cursor-pointer gap-3 rounded-xl border p-3 text-sm',
                      review.metadataSufficiency === option.id
                        ? 'border-primary/60 bg-primary/5'
                        : 'border-border/70',
                    )}
                  >
                    <input
                      type="radio"
                      name="metadata-sufficiency"
                      value={option.id}
                      disabled={frozen}
                      checked={review.metadataSufficiency === option.id}
                      onChange={() =>
                        setReviewValue((current) => ({
                          ...current,
                          metadataSufficiency:
                            option.id as LiteratureGoldReviewPayload['metadataSufficiency'],
                        }))
                      }
                      className="mt-0.5 accent-primary"
                    />
                    <span>
                      <strong className="block">{option.label}</strong>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">Reviewer confidence</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {confidenceOptions.map((option) => {
                  const shortcut = option.id === 'high' ? 'H' : option.id === 'moderate' ? 'M' : 'L'
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm',
                        review.reviewerConfidence === option.id
                          ? 'border-primary/60 bg-primary/5'
                          : 'border-border/70',
                      )}
                    >
                      <span>{option.label}</span>
                      <input
                        type="radio"
                        name="reviewer-confidence"
                        value={option.id}
                        disabled={frozen}
                        checked={review.reviewerConfidence === option.id}
                        onChange={() =>
                          setReviewValue((current) => ({
                            ...current,
                            reviewerConfidence:
                              option.id as LiteratureGoldReviewPayload['reviewerConfidence'],
                          }))
                        }
                        className="sr-only"
                      />
                      <Kbd>{shortcut}</Kbd>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        {included ? (
          <Card ref={topicSectionRef}>
            <CardHeader>
              <CardTitle>3. Categorization for included articles</CardTitle>
            </CardHeader>
            <CardContent className="gap-7">
              <CheckboxOptions
                legend="Broad IP topics (one or more)"
                values={review.topicIds}
                options={broadTopics}
                onChange={(values) =>
                  setReviewValue((current) => ({ ...current, topicIds: values }))
                }
              />
              <CheckboxOptions
                legend="Technology tags (optional)"
                values={review.technologyTags}
                options={literatureGoldSetLabels.technology_tags}
                onChange={(values) =>
                  setReviewValue((current) => ({ ...current, technologyTags: values }))
                }
              />
              <CheckboxOptions
                legend="Clinical purposes (one or more)"
                values={review.clinicalPurposes}
                options={literatureTaxonomy.facets.clinical_purpose.map((id) => ({
                  id,
                  label: facetLabel(id),
                }))}
                onChange={(values) =>
                  setReviewValue((current) => ({ ...current, clinicalPurposes: values }))
                }
              />
              <CheckboxOptions
                legend="Disease tags (optional)"
                values={review.diseaseTags}
                options={literatureTaxonomy.facets.disease.map((id) => ({
                  id,
                  label: id.replaceAll('-', ' '),
                }))}
                onChange={(values) =>
                  setReviewValue((current) => ({ ...current, diseaseTags: values }))
                }
              />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold">
                  <span>Study design</span>
                  <select
                    ref={studyDesignRef}
                    value={review.studyDesign ?? ''}
                    disabled={frozen}
                    onChange={(event) =>
                      setReviewValue((current) => ({
                        ...current,
                        studyDesign: event.target.value || null,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal"
                  >
                    <option value="">Choose one</option>
                    {literatureTaxonomy.facets.study_design.map((value) => (
                      <option key={value} value={value}>
                        {facetLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-semibold">
                  <span>Publication status</span>
                  <select
                    value={review.publicationStatus ?? ''}
                    disabled={frozen}
                    onChange={(event) =>
                      setReviewValue((current) => ({
                        ...current,
                        publicationStatus: event.target.value || null,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal"
                  >
                    <option value="">Choose one</option>
                    {literatureTaxonomy.facets.publication_class.map((value) => (
                      <option key={value} value={value}>
                        {facetLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
                <input
                  type="checkbox"
                  checked={review.categorizationFromFullText}
                  disabled={frozen}
                  onChange={(event) =>
                    setReviewValue((current) => ({
                      ...current,
                      categorizationFromFullText: event.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="block font-semibold">
                    Categorization required full-text review
                  </span>
                  <span className="mt-1 block text-muted-foreground">
                    Category 3 information was unavailable in the abstract and was determined from
                    the full text.
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              ref={notesRef}
              value={review.notes}
              disabled={frozen}
              maxLength={4000}
              placeholder="Optional boundary-case rationale or correction note…"
              onChange={(event) =>
                setReviewValue((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </CardContent>
        </Card>
      </main>

      <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Review controls</CardTitle>
          </CardHeader>
          <CardContent>
            {frozen ? (
              <p className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-sm">
                This batch is frozen and read-only.
              </p>
            ) : null}
            <Button
              type="button"
              size="lg"
              disabled={frozen || saving}
              onClick={() => void completeReview()}
              className="w-full"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {item.currentReview ? 'Save revision and next' : 'Complete and next'}
              <Kbd className="border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground">
                Enter
              </Kbd>
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!item.previousItemId}
                onClick={() => navigate(item.previousItemId, 'all')}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!item.nextItemId}
                onClick={() => navigate(item.nextItemId, 'all')}
              >
                Next
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            {!item.currentReview ? (
              <Button
                type="button"
                variant="outline"
                disabled={frozen || saving}
                onClick={() => void runAction('return_later')}
                className="w-full"
              >
                <Clock3 className="h-4 w-4" aria-hidden="true" />
                Return later
              </Button>
            ) : null}
            <div className="flex min-h-6 items-center gap-2 text-xs text-muted-foreground">
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              {saving
                ? 'Saving…'
                : saveState === 'saved'
                  ? 'Draft saved'
                  : saveState === 'dirty'
                    ? 'Unsaved changes'
                    : saveState === 'error'
                      ? 'Save needs attention'
                      : 'Drafts autosave'}
            </div>
            {message ? (
              <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                {message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" aria-hidden="true" />
              Keyboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
              <Kbd>1–4</Kbd>
              <dd>Relevance</dd>
              <Kbd>H/M/L</Kbd>
              <dd>Confidence</dd>
              <Kbd>Enter</Kbd>
              <dd>Complete and next</dd>
              <Kbd>B</Kbd>
              <dd>Previous article</dd>
              <Kbd>T/S/N</Kbd>
              <dd>Topics / study design / notes</dd>
            </dl>
          </CardContent>
        </Card>

        {item.currentReview && !item.automatedSignalsRevealed ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" aria-hidden="true" />
                Post-decision analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your original blinded decision is immutable. You can now reveal sampling,
                source-query, and automated topic signals.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={frozen || saving}
                onClick={() => void runAction('reveal_automated')}
              >
                Reveal automated signals
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {item.automatedSignals ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" aria-hidden="true" />
                Automated signals
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div>
                <strong>Sampling:</strong>{' '}
                {item.automatedSignals.sampleStratum.replaceAll('_', ' ')}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                {item.automatedSignals.samplingReason}
              </p>
              <details>
                <summary className="cursor-pointer font-medium">
                  Sources ({item.automatedSignals.sources.length})
                </summary>
                <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
                  {item.automatedSignals.sources.map((source, index) => (
                    <li key={`${source.sourceFilename}:${index}`}>
                      {source.sourceKind} · {source.queryId ?? source.sourceId ?? 'unlabeled'} ·{' '}
                      {source.sourceFilename}
                    </li>
                  ))}
                </ul>
              </details>
              <details>
                <summary className="cursor-pointer font-medium">
                  Topic suggestions ({item.automatedSignals.suggestions.length})
                </summary>
                <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
                  {item.automatedSignals.suggestions.map((suggestion, index) => (
                    <li key={`${suggestion.topicId}:${suggestion.assignmentSource}:${index}`}>
                      {suggestion.topicId} · {suggestion.assignmentSource}
                      {suggestion.confidence === null
                        ? ''
                        : ` · ${Math.round(suggestion.confidence * 100)}%`}
                    </li>
                  ))}
                </ul>
              </details>
            </CardContent>
          </Card>
        ) : null}

        {item.reviewHistory.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" aria-hidden="true" />
                Review history
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                {item.reviewHistory.map((entry) => (
                  <li key={entry.id} className="rounded-xl border border-border/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <strong>Revision {entry.revision}</strong>
                      <Badge variant={entry.isBlinded ? 'info' : 'outline'}>
                        {entry.isBlinded ? 'blinded' : 'unblinded'}
                      </Badge>
                    </div>
                    <p className="mt-2">
                      {(entry.relevanceLabel ?? 'unknown').replaceAll('_', ' ')}
                    </p>
                    <time className="text-xs text-muted-foreground" dateTime={entry.completedAt}>
                      {new Date(entry.completedAt).toLocaleString(locale)}
                    </time>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ) : null}
      </aside>
    </div>
  )
}

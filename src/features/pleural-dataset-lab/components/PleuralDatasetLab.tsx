'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { CheckCircle2, Database, FileCheck2, ShieldCheck } from 'lucide-react'

import { LessonScaffold } from '@/components/learning/LessonScaffold'

import {
  getPleuralDatasetCollection,
  pleuralDatasetCollections,
  publicPleuralDatasetCases,
  type PleuralDatasetLabel,
  type PleuralDatasetSourceId,
} from '../content/datasetCases'
import { HandoffContent } from '@/i18n/handoff'

type SourceFilter = 'all' | PleuralDatasetSourceId

const sourceFilters: readonly { id: SourceFilter; label: string }[] = [
  { id: 'all', label: 'All raw cases' },
  { id: 'mendeley-lus-raw-snapshot-2026-06-03', label: 'Mendeley LUS' },
] as const

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return `${(bytes / 1024).toFixed(1)} KB`
}

export function PleuralDatasetLab() {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<PleuralDatasetLabel | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState({ correct: 0, attempted: 0 })

  const filteredCases = useMemo(() => {
    if (sourceFilter === 'all') {
      return publicPleuralDatasetCases
    }

    return publicPleuralDatasetCases.filter(
      (caseItem) => caseItem.sourceRegistryId === sourceFilter,
    )
  }, [sourceFilter])

  const safeIndex = filteredCases.length > 0 ? index % filteredCases.length : 0
  const caseItem = filteredCases[safeIndex]
  const collection = caseItem ? getPleuralDatasetCollection(caseItem.sourceRegistryId) : null
  const result =
    caseItem && answer
      ? {
          correct: answer === caseItem.groundTruth,
          chosenLabel: caseItem.answerOptions.find((option) => option.id === answer)?.label,
        }
      : null

  if (!caseItem || !collection) {
    return <HandoffContent>{null}</HandoffContent>
  }

  function chooseSourceFilter(nextFilter: SourceFilter) {
    setSourceFilter(nextFilter)
    setIndex(0)
    setAnswer(null)
    setRevealed(false)
  }

  function reveal() {
    if (!answer || revealed) {
      return
    }

    const correct = answer === caseItem.groundTruth
    setScore((previous) => ({
      correct: previous.correct + (correct ? 1 : 0),
      attempted: previous.attempted + 1,
    }))
    setRevealed(true)
  }

  function nextCase() {
    setIndex((previous) => (previous + 1) % filteredCases.length)
    setAnswer(null)
    setRevealed(false)
  }

  return (
    <HandoffContent>
      {
        <LessonScaffold
          title="Raw dataset teaching-use lab"
          objectives={[
            'Use raw CC BY images and safe metadata to choose a pleural teaching bucket.',
            'Separate a large simple effusion from lung findings and normal-lung distractors.',
            'Trace every embedded case back to source URL, archive, original path, license, and checksum.',
          ]}
          howToUse={[
            'Pick a source filter if you want to focus on one dataset.',
            'Use the image and safe metadata together; some raw files include labels inside the pixels.',
            'Commit to the teaching use before opening the attribution and reviewer notes.',
          ]}
          clinicalAnchor={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>
                Teaching-use review {safeIndex + 1} of {filteredCases.length}:{' '}
                {caseItem.neutralVignette}
              </p>
              <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
                Score: {score.correct}/{score.attempted}
              </span>
            </div>
          }
          reveal={
            result ? (
              <div
                className={
                  result.correct
                    ? 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm leading-6 text-emerald-900 dark:text-emerald-100'
                    : 'rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-sm leading-6 text-amber-900 dark:text-amber-100'
                }
              >
                <h3 className="font-semibold">{result.correct ? 'Correct' : 'Not quite'}</h3>
                <p className="mt-2">
                  You chose {result.chosenLabel}; the teaching target is {caseItem.groundTruthLabel}
                  .
                </p>
                <p className="mt-2">
                  Source metadata: {caseItem.sourceFindingLabel}; record-level class:{' '}
                  {caseItem.sourceRecordClass}.
                </p>
                <p className="mt-2">{caseItem.revealCaption}</p>
                <p className="mt-2">{caseItem.teachingPoint}</p>
                <button
                  type="button"
                  onClick={nextCase}
                  className="mt-4 rounded-lg border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Next raw case
                </button>
              </div>
            ) : null
          }
          revealed={revealed}
          onReveal={reveal}
          canReveal={answer !== null}
          revealLabel="Check teaching use"
          keyTakeaway={
            <p>
              The embedded files are raw CC BY examples for education and review. They can tune
              visual realism and teach source-label limits, but they should not become diagnostic AI
              or patient-specific decision support.
            </p>
          }
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {pleuralDatasetCollections.map((source) => (
              <div
                key={source.id}
                className="rounded-lg border border-border/80 bg-card p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sky-600">
                    <Database className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{source.shortLabel}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {source.snapshotCount} embedded from {source.rawImageCount.toLocaleString()}{' '}
                      raw images
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-border/80 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-emerald-600">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">CC BY snapshot</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Reviewed subset only; full archives remain audit targets.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border/80 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-violet-600">
                  <FileCheck2 className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Checksum tracked</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Each public image records source path, size, and SHA-256.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {sourceFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={sourceFilter === filter.id}
                onClick={() => chooseSourceFilter(filter.id)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10"
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
              <div className="relative min-h-[24rem] bg-muted/40 p-4">
                <div className="relative flex min-h-[22rem] items-center justify-center rounded-lg border border-border bg-background">
                  <Image
                    src={caseItem.path}
                    alt={revealed ? caseItem.revealCaption : caseItem.alt}
                    width={caseItem.width}
                    height={caseItem.height}
                    className="max-h-[36rem] w-full object-contain"
                    sizes="(min-width: 1024px) 64vw, 100vw"
                    priority={safeIndex === 0}
                  />
                </div>
              </div>
              {revealed ? (
                <div className="grid gap-4 border-t border-border/80 p-4 text-xs leading-5 text-muted-foreground md:grid-cols-2">
                  <div>
                    <p className="font-semibold text-foreground">Attribution</p>
                    <p className="mt-1">{caseItem.attribution}</p>
                    <p className="mt-1">
                      <a
                        href={caseItem.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-sky-500 underline-offset-4"
                      >
                        {caseItem.license}
                      </a>{' '}
                      with attribution required.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Raw source</p>
                    <p className="mt-1">Archive: {caseItem.originalArchiveFile}</p>
                    <p className="mt-1 break-all">Image name: {caseItem.sourceImageName}</p>
                    <p className="mt-1 break-all">Path: {caseItem.originalRelativePath}</p>
                    <p className="mt-1">
                      Dimensions: {caseItem.width} x {caseItem.height}; size:{' '}
                      {formatBytes(caseItem.sizeBytes)}
                    </p>
                    <p className="mt-1 break-all">SHA-256: {caseItem.sha256}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="space-y-4">
              <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sky-600">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Choose teaching use</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Source metadata is visible below; this is a module-review decision, not an app
                      diagnosis.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  {caseItem.answerOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={answer === option.id}
                      disabled={revealed}
                      onClick={() => setAnswer(option.id)}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10 disabled:opacity-60"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-card p-5 text-sm leading-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Source snapshot
                </p>
                <h3 className="mt-2 font-semibold text-foreground">{collection.title}</h3>
                <p className="mt-2 text-muted-foreground">{collection.useScope}</p>
                <dl className="mt-4 grid gap-2 text-xs text-muted-foreground">
                  <div>
                    <dt className="font-semibold text-foreground">Record</dt>
                    <dd>{caseItem.sourceRecordId}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Image name</dt>
                    <dd className="break-all">{caseItem.sourceImageName}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Metadata lookup</dt>
                    <dd className="break-all">{caseItem.metadataLookupKey}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Safe metadata</dt>
                    <dd>
                      {caseItem.metadataReview.worksheet}, row {caseItem.metadataReview.row}:{' '}
                      {caseItem.metadataReview.findingValue}
                    </dd>
                    {caseItem.metadataReview.positiveFlag ? (
                      <dd>{caseItem.metadataReview.positiveFlag}</dd>
                    ) : null}
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Source class</dt>
                    <dd>{caseItem.sourceRecordClass}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Review use</dt>
                    <dd>{caseItem.moduleUse}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Policy</dt>
                    <dd>{caseItem.rawAssetPolicyNote}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Archive hash</dt>
                    <dd className="break-all">
                      {collection.archiveHashAlgorithm.toUpperCase()}: {collection.archiveHash}
                    </dd>
                  </div>
                </dl>
              </div>
            </aside>
          </div>
        </LessonScaffold>
      }
    </HandoffContent>
  )
}

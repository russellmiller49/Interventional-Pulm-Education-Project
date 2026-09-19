'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { betaModuleById, betaModules } from './catalog'
import { feedbackStatuses, type FeedbackEntry } from './schema'
import { feedbackMode } from './config'
import {
  clearOwnerFeedback,
  listOwnerFeedback,
  updateOwnerFeedback,
  type OwnerFeedbackEntry,
} from './ownerFeedbackStore'
import { exportOwnerFeedback } from './ownerFeedbackExport'

type ReviewEntry = FeedbackEntry | OwnerFeedbackEntry

function FeedbackCard({ entry, onSaved }: { entry: ReviewEntry; onSaved: () => void }) {
  const [status, setStatus] = useState(entry.status)
  const [notes, setNotes] = useState(entry.reviewer_notes)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showImage, setShowImage] = useState(false)
  const [imageError, setImageError] = useState(false)
  const localEntry = 'storage_mode' in entry ? entry : null
  const screenshot = localEntry?.screenshot
  const [localImageUrl, setLocalImageUrl] = useState('')
  useEffect(() => {
    if (!screenshot) return
    const url = URL.createObjectURL(screenshot.blob)
    setLocalImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [screenshot])
  const imageUrl = localEntry ? localImageUrl : `/api/module-feedback/${entry.id}/image`
  const hasScreenshot = localEntry
    ? Boolean(screenshot)
    : Boolean((entry as FeedbackEntry).screenshot_path)
  async function save() {
    setSaving(true)
    setMessage('')
    try {
      if (localEntry) {
        await updateOwnerFeedback(entry.id, { status, reviewerNotes: notes })
      } else {
        const response = await fetch(`/api/module-feedback/${entry.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, reviewerNotes: notes }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Review could not be saved.')
      }
      setMessage('Review saved.')
      onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Review could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <article className="space-y-4 rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {betaModuleById(entry.module_id)?.title ?? entry.module_id}
          </h2>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {localEntry ? 'Owner review' : (entry as FeedbackEntry).tester_email} ·{' '}
            {new Date(entry.created_at).toLocaleString()} · {entry.id}
          </p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-semibold">
          {entry.status === 'in-review'
            ? 'In review'
            : entry.status === 'resolved'
              ? 'Resolved'
              : 'New'}
        </span>
      </div>
      <Link
        className="block break-all text-sm underline underline-offset-4"
        href={entry.page_path as Route}
        target="_blank"
        rel="noreferrer"
      >
        Open reported page: {entry.page_path}
      </Link>
      {entry.selected_text && (
        <blockquote className="whitespace-pre-wrap border-l-4 border-primary/50 bg-muted/30 p-3 text-sm">
          {entry.selected_text}
        </blockquote>
      )}
      <p className="whitespace-pre-wrap break-words text-sm leading-7">{entry.comment}</p>
      {hasScreenshot && (
        <div className="space-y-3">
          <Button variant="outline" size="sm" onClick={() => setShowImage(!showImage)}>
            {showImage ? 'Hide screenshot' : 'View annotated screenshot'}
          </Button>
          {showImage && imageUrl && (
            <>
              {/* Local Blob URL or authenticated endpoint; never a public screenshot asset. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`Screenshot attached by ${localEntry ? 'the owner' : 'the beta tester'}, including their highlighted areas`}
                src={imageUrl}
                className="h-auto max-h-[800px] max-w-full rounded-lg border object-contain"
                onError={() => setImageError(true)}
              />
              {imageError ? (
                <p role="alert" className="text-sm text-destructive">
                  Screenshot could not be loaded. Refresh to try again.
                </p>
              ) : (
                <a className="text-sm underline" href={imageUrl} target="_blank" rel="noreferrer">
                  Open full image
                </a>
              )}
            </>
          )}
        </div>
      )}
      <div className="grid gap-3 border-t pt-4 md:grid-cols-[160px_1fr]">
        <label className="space-y-1 text-sm font-medium">
          Review status
          <select
            aria-label="Review status"
            value={status}
            onChange={(event) => setStatus(event.target.value as FeedbackEntry['status'])}
            className="block w-full rounded-lg border bg-background p-2"
          >
            {feedbackStatuses.map((value) => (
              <option key={value} value={value}>
                {value === 'in-review' ? 'In review' : value === 'new' ? 'New' : 'Resolved'}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          Private review notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={10000}
            className="block min-h-20 w-full rounded-lg border bg-background p-2"
          />
        </label>
      </div>
      <div className="flex items-center justify-end gap-3">
        <p role="status" className="text-sm">
          {message}
        </p>
        <Button size="sm" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save review'}
        </Button>
      </div>
    </article>
  )
}

export function FeedbackWorkspace({ locale }: { locale: string }) {
  const local = feedbackMode() === 'owner-local'
  const [entries, setEntries] = useState<ReviewEntry[]>([])
  const [managing, setManaging] = useState(false)
  const [managementMessage, setManagementMessage] = useState('')
  const [count, setCount] = useState(0)
  const [moduleId, setModuleId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++generation.current
    setLoading(true)
    setError('')
    try {
      let result: { entries: ReviewEntry[]; count: number }
      if (local) {
        const all = await listOwnerFeedback({ moduleId, status })
        result = { entries: all.slice(page * 30, page * 30 + 30), count: all.length }
      } else {
        const response = await fetch(
          `/api/module-feedback?${new URLSearchParams({ module: moduleId, status, page: String(page) })}`,
          { cache: 'no-store' },
        )
        result = await response.json()
        if (!response.ok)
          throw new Error((result as { error?: string }).error || 'Feedback could not be loaded.')
      }
      if (current !== generation.current) return
      setEntries(result.entries)
      setCount(result.count)
    } catch (err) {
      if (current === generation.current)
        setError(err instanceof Error ? err.message : 'Feedback could not be loaded.')
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }, [local, moduleId, status, page])
  useEffect(() => {
    void refresh()
    return () => {
      // Invalidate any pending request; this ref is a counter, not a DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++
    }
  }, [refresh])
  async function exportFeedback(filtered: boolean) {
    setManaging(true)
    setManagementMessage('')
    try {
      const filters = filtered ? { moduleId, status } : {}
      const all = await listOwnerFeedback(filters)
      const { blob, filename } = await exportOwnerFeedback(all, filters)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Allow the browser to start consuming the download before revoking the URL.
      setTimeout(() => URL.revokeObjectURL(url), 30000)
      setManagementMessage(`Export prepared: ${all.length} reports. Local feedback has been kept.`)
    } catch (err) {
      setManagementMessage(err instanceof Error ? err.message : 'Export could not be prepared.')
    } finally {
      setManaging(false)
    }
  }
  async function clearFeedback() {
    if (
      !window.confirm(
        'Permanently remove ALL local reports and screenshots from this browser? Export feedback first if you need a copy. This cannot be undone.',
      )
    )
      return
    setManaging(true)
    setManagementMessage('')
    try {
      await clearOwnerFeedback()
      setPage(0)
      await refresh()
      setManagementMessage('All local reports and screenshots were removed from this browser.')
    } catch (err) {
      setManagementMessage(
        err instanceof Error ? err.message : 'Local feedback could not be cleared.',
      )
    } finally {
      setManaging(false)
    }
  }
  return (
    <div className="container max-w-6xl space-y-6 py-10">
      <header className="space-y-4">
        <div className="flex flex-wrap gap-4 text-sm underline underline-offset-4">
          {!local && <Link href={`/${locale}/admin/modules` as Route}>Modules in development</Link>}
          <Link href={`/${locale}/development-beta` as Route}>Beta-testing hub</Link>
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {local ? 'Owner review · Module development' : 'Admin · Module development'}
        </p>
        <h1 className="text-4xl font-bold tracking-tight">
          {local ? 'Owner review feedback · local to this browser' : 'Feedback workspace'}
        </h1>
        <p className="max-w-2xl leading-7 text-muted-foreground">
          Review {local ? 'owner findings' : 'tester comments'} and annotated screenshots. Track
          each report from new to resolved, with private notes for your next revision.
        </p>
      </header>
      {local && (
        <section
          aria-label="Local feedback management"
          className="space-y-3 rounded-xl border border-primary/40 bg-muted/30 p-4"
        >
          <p className="text-sm leading-6">
            Reports and screenshots are saved only in this browser on this site, with no account
            identity or server upload. Clearing site data, private browsing, or browser storage
            eviction can remove them. Export regularly. Disable owner-local mode before sharing
            external beta links.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={managing} onClick={() => exportFeedback(false)}>
              Export feedback
            </Button>
            <Button
              variant="outline"
              disabled={managing || (!moduleId && !status)}
              onClick={() => exportFeedback(true)}
            >
              Export filtered feedback
            </Button>
            <Button variant="outline" disabled={managing} onClick={clearFeedback}>
              Clear local feedback
            </Button>
          </div>
          {managementMessage && (
            <p role="status" className="text-sm">
              {managementMessage}
            </p>
          )}
        </section>
      )}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/20 p-4">
        <label className="min-w-0 max-w-full text-sm font-medium">
          Module
          <select
            aria-label="Module"
            value={moduleId}
            onChange={(event) => {
              setModuleId(event.target.value)
              setPage(0)
            }}
            className="mt-1 block w-full max-w-full rounded-lg border bg-background p-2"
          >
            <option value="">All modules</option>
            {betaModules.map((entry) => (
              <option value={entry.id} key={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 max-w-full text-sm font-medium">
          Status
          <select
            aria-label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(0)
            }}
            className="mt-1 block rounded-lg border bg-background p-2"
          >
            <option value="">All statuses</option>
            {feedbackStatuses.map((value) => (
              <option key={value} value={value}>
                {value === 'in-review' ? 'In review' : value === 'new' ? 'New' : 'Resolved'}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          Refresh
        </Button>
      </div>
      {error ? (
        <p role="alert" className="rounded-xl border p-5 text-destructive">
          {error}
        </p>
      ) : loading ? (
        <p role="status">Loading feedback…</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {count} {count === 1 ? 'report' : 'reports'}
            {count > 0 && ` · Showing ${page * 30 + 1}–${Math.min(count, (page + 1) * 30)}`}
          </p>
          {entries.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
              No feedback matches these filters.
            </div>
          ) : (
            entries.map((entry) => (
              <FeedbackCard
                key={`${entry.id}:${entry.status}:${entry.reviewer_notes}`}
                entry={entry}
                onSaved={refresh}
              />
            ))
          )}
          <div className="flex justify-between">
            <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={(page + 1) * 30 >= count}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

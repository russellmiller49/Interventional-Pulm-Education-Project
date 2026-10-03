'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { feedbackMode } from './config'
import { ownerFeedbackExists, saveOwnerFeedback } from './ownerFeedbackStore'
import {
  deleteOwnerDraft,
  deleteUnreadableOwnerDrafts,
  readOwnerDrafts,
  saveOwnerDraft,
} from './ownerDraftStore'
import { isMeaningfulDraft } from './draftContent'
import { betaModuleById, betaModuleForPath, feedbackPagePath, type BetaModule } from './catalog'
import {
  ScreenshotEditor,
  createScreenshotDraft,
  type ScreenshotDraft,
  type ScreenshotEditorHandle,
} from './ScreenshotEditor'
import { decodeScreenshotSource, encodeScreenshotSource } from './screenshotDraftImage'

const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export function BetaTestingFrame({
  moduleEntry,
  locale,
}: {
  moduleEntry: BetaModule
  locale: string
}) {
  const local = feedbackMode() === 'owner-local'
  const shell = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const screenshotDraft = useRef<ScreenshotDraft>(createScreenshotDraft())
  const editor = useRef<ScreenshotEditorHandle>(null)
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [selectedText, setSelectedText] = useState('')
  const [pagePath, setPagePath] = useState(`/${locale}${moduleEntry.path}`)
  const [reportModule, setReportModule] = useState<BetaModule>(moduleEntry)
  const [reportId, setReportId] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [screenshotRevision, setScreenshotRevision] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sending, setSending] = useState(false)
  const [capturing, setCapturing] = useState(false)
  // Owner-local only: unsent drafts are also kept in this browser. Server drafts stay in memory.
  const [draftReady, setDraftReady] = useState(!local)
  const [draftProblem, setDraftProblem] = useState('')
  const [unreadableDrafts, setUnreadableDrafts] = useState<IDBValidKey[]>([])
  const latest = useRef({ reportId, comment, selectedText, pagePath, moduleId: reportModule.id })
  // Set synchronously with the draft's ID, so queued storage work never acts on a stale draft.
  const activeDraftId = useRef('')
  const dirty = useRef(false)
  const storedDraftId = useRef('')
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  // "Continue feedback" is a claim that unsent work exists; a reserved report ID is not that.
  const pendingDraft = isMeaningfulDraft({ comment, selectedText, hasImage })

  useEffect(() => {
    latest.current = { reportId, comment, selectedText, pagePath, moduleId: reportModule.id }
  })

  // One storage operation at a time, so a late draft write can never follow its own removal.
  const enqueue = useCallback(<T,>(task: () => Promise<T>) => {
    const run = queue.current.then(task)
    queue.current = run.catch(() => undefined)
    return run
  }, [])

  const persistDraft = useCallback(
    () =>
      enqueue(async () => {
        const draft = latest.current
        if (!local || !draft.reportId || !dirty.current) return
        if (draft.reportId !== activeDraftId.current) return
        dirty.current = false
        const source = screenshotDraft.current.source
        try {
          let image = null
          let imageProblem = ''
          if (source)
            try {
              image = encodeScreenshotSource(source)
            } catch (err) {
              imageProblem = `${message(err, 'The screenshot could not be kept in the draft.')} The rest of this draft is kept.`
            }
          // Store only what can be offered back: never an empty record standing in for an image.
          if (
            !isMeaningfulDraft({
              comment: draft.comment,
              selectedText: draft.selectedText,
              hasImage: Boolean(image),
            })
          ) {
            if (storedDraftId.current === draft.reportId) {
              await deleteOwnerDraft(draft.reportId)
              storedDraftId.current = ''
            }
            setDraftProblem(imageProblem)
            return
          }
          await saveOwnerDraft(
            {
              id: draft.reportId,
              hostModuleId: moduleEntry.id,
              moduleId: draft.moduleId,
              pagePath: draft.pagePath,
              comment: draft.comment,
              selectedText: draft.selectedText,
              annotations: image ? screenshotDraft.current.annotations : [],
            },
            image,
          )
          storedDraftId.current = draft.reportId
          setDraftProblem(imageProblem)
        } catch (err) {
          // A draft that was saved or discarded while this write ran has nothing left to report.
          if (draft.reportId !== activeDraftId.current) return
          dirty.current = true
          setDraftProblem(message(err, 'This draft could not be kept on this browser.'))
        }
      }),
    [enqueue, local, moduleEntry.id],
  )

  const forgetStoredDraft = useCallback(
    (id: string) => {
      dirty.current = false
      if (!local || !id) return Promise.resolve()
      // Queued behind any write still in flight for this draft, so that write cannot outlive it.
      return enqueue(async () => {
        if (storedDraftId.current !== id) return
        await deleteOwnerDraft(id)
        storedDraftId.current = ''
      })
    },
    [enqueue, local],
  )

  // Offer the newest unsent draft started on this testing page. It is restored, never submitted.
  const restoreDraft = useCallback(
    () =>
      enqueue(async () => {
        if (!local) return
        try {
          const stored = await readOwnerDrafts()
          const unreadable = [...stored.unreadable]
          for (const draft of stored.drafts) {
            if (draft.host_module_id !== moduleEntry.id) continue
            // Never replace a draft the owner has open or has begun since this read started.
            if (activeDraftId.current) break
            // A committed report with this ID means the draft was already saved; finish clearing it.
            if (await ownerFeedbackExists(draft.id).catch(() => false)) {
              await deleteOwnerDraft(draft.id)
              continue
            }
            let source = null
            if (draft.screenshot)
              try {
                source = await decodeScreenshotSource(draft.screenshot)
              } catch {
                unreadable.push(draft.id)
                continue
              }
            if (activeDraftId.current) break
            screenshotDraft.current = { source, annotations: draft.annotations }
            activeDraftId.current = draft.id
            storedDraftId.current = draft.id
            dirty.current = false
            setReportId(draft.id)
            setReportModule(betaModuleById(draft.module_id)!)
            setPagePath(draft.page_path)
            setComment(draft.comment)
            setSelectedText(draft.selected_text)
            setHasImage(Boolean(source))
            break
          }
          setUnreadableDrafts(unreadable)
        } catch (err) {
          setDraftProblem(message(err, 'Unsent drafts on this browser could not be read.'))
        } finally {
          setDraftReady(true)
        }
      }),
    [enqueue, local, moduleEntry.id],
  )

  useEffect(() => {
    void restoreDraft()
  }, [restoreDraft])

  useEffect(() => {
    if (!local || !draftReady || !reportId) return
    const timer = window.setTimeout(() => void persistDraft(), 400)
    return () => window.clearTimeout(timer)
  }, [local, draftReady, reportId, comment, selectedText, screenshotRevision, persistDraft])

  useEffect(() => {
    if (!local) return
    const keep = () => void persistDraft()
    const hidden = () => {
      if (document.visibilityState === 'hidden') keep()
    }
    window.addEventListener('pagehide', keep)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('pagehide', keep)
      document.removeEventListener('visibilitychange', hidden)
      // Leaving through a site link unmounts without a page unload.
      keep()
    }
  }, [local, persistDraft])

  // The site header and footer still sit under this fixed shell. Left alone, the hidden page
  // keeps its own scroll range behind the module frame whenever they outgrow the viewport, and
  // its covered navigation stays in the tab order and the accessibility tree beside the
  // module's own copy. Both are undone when the shell unmounts.
  useEffect(() => {
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    const page = shell.current?.closest('main')
    const covered = Array.from(page?.parentElement?.children ?? []).filter(
      (element) => element !== page && !element.hasAttribute('inert'),
    )
    for (const element of covered) element.setAttribute('inert', '')
    return () => {
      root.style.overflow = previous
      for (const element of covered) element.removeAttribute('inert')
    }
  }, [])

  function resetDraft() {
    dirty.current = false
    activeDraftId.current = ''
    screenshotDraft.current = createScreenshotDraft()
    setReportId('')
    setComment('')
    setSelectedText('')
    setHasImage(false)
  }
  function beginFeedback() {
    setError('')
    setSuccess('')
    // An unsent draft keeps its original location and screenshot, wherever the module is now.
    if (reportId && pendingDraft) {
      setOpen(true)
      return
    }
    try {
      const window = frame.current?.contentWindow
      if (!window) return
      const url = new URL(window.location.href)
      const currentModule = betaModuleForPath(url.pathname)
      if (!currentModule) {
        setError('Return to a development module before sending feedback.')
        return
      }
      const selection = (window.getSelection()?.toString() ?? '').slice(0, 3000)
      const id = crypto.randomUUID()
      screenshotDraft.current = createScreenshotDraft()
      activeDraftId.current = id
      dirty.current = true
      setPagePath(feedbackPagePath(url))
      setReportModule(currentModule)
      setSelectedText(selection)
      setComment('')
      setHasImage(false)
      setReportId(id)
      setOpen(true)
    } catch {
      setError('Return to a module on this site before sending feedback.')
    }
  }
  function closeDialog() {
    setOpen(false)
    if (pendingDraft) {
      void persistDraft()
      return
    }
    // Nothing unsent: the next report starts from wherever the tester is then.
    void forgetStoredDraft(reportId).catch((err) =>
      setDraftProblem(message(err, 'The empty draft could not be removed from this browser.')),
    )
    resetDraft()
  }
  async function discardDraft() {
    const id = reportId
    setOpen(false)
    setError('')
    setDraftProblem('')
    resetDraft()
    try {
      await forgetStoredDraft(id)
    } catch (err) {
      setDraftProblem(message(err, 'The draft could not be removed from this browser.'))
    }
    void restoreDraft()
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      const image = await editor.current?.exportImage()
      let savedId: string
      if (local) {
        const saved = await saveOwnerFeedback(
          {
            id: reportId,
            moduleId: reportModule.id,
            pagePath,
            comment,
            selectedText,
          },
          image,
        )
        savedId = saved.id
      } else {
        const body = new FormData()
        body.set('id', reportId)
        body.set('moduleId', reportModule.id)
        body.set('pagePath', pagePath)
        body.set('comment', comment)
        body.set('selectedText', selectedText)
        if (image) body.set('screenshot', image, 'feedback.png')
        const response = await fetch('/api/module-feedback', { method: 'POST', body })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Feedback could not be saved.')
        savedId = result.id
      }
      // The report has committed. Only now is its draft cleared; if that removal fails, the next
      // load finds the saved report by ID and finishes clearing instead of offering it again.
      setOpen(false)
      setDraftProblem('')
      resetDraft()
      setSuccess(`Feedback saved${local ? ' locally' : ''}. Reference ${savedId.slice(0, 8)}.`)
      await forgetStoredDraft(savedId).catch(() => undefined)
      void restoreDraft()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feedback could not be saved. Please retry.')
    } finally {
      setSending(false)
    }
  }
  async function removeUnreadableDrafts() {
    try {
      await enqueue(() => deleteUnreadableOwnerDrafts(unreadableDrafts))
      setUnreadableDrafts([])
    } catch (err) {
      setDraftProblem(message(err, 'The unreadable draft could not be removed.'))
    }
  }
  return (
    <div ref={shell} className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5 sm:px-4">
        <Link
          aria-label="All beta modules"
          href={`/${locale}/development-beta` as Route}
          className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center gap-1 text-sm underline underline-offset-4 sm:justify-start"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden whitespace-nowrap sm:inline">All modules</span>
        </Link>
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-xs font-semibold text-primary">
            {local ? 'Owner review · saved locally on this browser' : 'Beta testing'}
          </p>
          <h1 className="line-clamp-2 text-sm font-semibold [overflow-wrap:anywhere] md:text-base">
            {moduleEntry.title}
          </h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {local && (
            <Link href={`/${locale}/admin/module-feedback` as Route} className="text-sm underline">
              Review feedback
            </Link>
          )}
          <Button size="sm" onClick={beginFeedback} disabled={!draftReady}>
            <MessageSquare className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {pendingDraft ? 'Continue feedback' : 'Give feedback'}
          </Button>
        </div>
      </header>
      {success && (
        <p role="status" className="border-b bg-muted px-4 py-2 text-sm">
          {success}
        </p>
      )}
      {error && !open && (
        <p role="alert" className="border-b px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {draftProblem && !open && (
        <p role="alert" className="border-b px-4 py-2 text-sm text-destructive">
          {draftProblem}
        </p>
      )}
      {unreadableDrafts.length > 0 && (
        <p role="alert" className="border-b px-4 py-2 text-sm text-destructive">
          An unsent draft on this browser cannot be opened by this version (unsupported or damaged).
          It has not been removed.{' '}
          <button type="button" className="underline" onClick={removeUnreadableDrafts}>
            Remove unreadable draft
          </button>
        </p>
      )}
      <iframe
        ref={frame}
        title={moduleEntry.title}
        src={`/${locale}${moduleEntry.path}`}
        className="min-h-0 w-full flex-1 border-0"
        allow="fullscreen; clipboard-write"
      />
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (sending || capturing) return
          if (value) setOpen(true)
          else closeDialog()
        }}
      >
        <DialogContent
          overlayClassName={capturing ? 'invisible' : undefined}
          className={`max-h-[90dvh] max-w-4xl overflow-y-auto p-4 sm:p-6 ${capturing ? 'invisible' : ''}`}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Module feedback</DialogTitle>
            <DialogDescription>
              {reportModule.title} ·{' '}
              {local
                ? 'Saved locally on this browser for owner review.'
                : 'Saved to the site team’s private review workspace.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <p className="break-all text-xs text-muted-foreground">Page: {pagePath}</p>
            <label className="block space-y-2 text-sm font-medium">
              What should we know?
              <textarea
                required
                maxLength={10000}
                value={comment}
                onChange={(event) => {
                  dirty.current = true
                  setComment(event.target.value)
                }}
                className="min-h-32 w-full rounded-lg border bg-background p-3"
                placeholder="What happened, what you expected, or what would make this clearer…"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Text or section you’re referring to (optional)
              <textarea
                maxLength={3000}
                value={selectedText}
                onChange={(event) => {
                  dirty.current = true
                  setSelectedText(event.target.value)
                }}
                className="min-h-16 w-full rounded-lg border bg-background p-3"
                placeholder="Select text in the module before opening feedback, or paste it here."
              />
            </label>
            <ScreenshotEditor
              key={reportId}
              ref={editor}
              draft={screenshotDraft}
              onCaptureVisibilityChange={setCapturing}
              onDraftChange={() => {
                const source = screenshotDraft.current.source
                dirty.current = true
                // Encode a new image once, now, while the editor is still showing it as loading;
                // later draft writes reuse those bytes. A failure is reported when it is written.
                if (local && source)
                  try {
                    encodeScreenshotSource(source)
                  } catch {}
                setHasImage(Boolean(source))
                setScreenshotRevision((revision) => revision + 1)
              }}
            />
            {local && (
              <p className="text-xs leading-5 text-muted-foreground">
                Not saved yet. What you add here is kept on this browser until you save or discard
                it, and is offered again after a reload.
              </p>
            )}
            {draftProblem && (
              <p role="alert" className="text-sm text-destructive">
                {draftProblem}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" disabled={sending} onClick={discardDraft}>
                Discard draft
              </Button>
              <Button type="button" variant="outline" disabled={sending} onClick={closeDialog}>
                Continue testing
              </Button>
              <Button type="submit" disabled={sending || !comment.trim()}>
                {sending ? 'Saving…' : local ? 'Save feedback locally' : 'Send feedback'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

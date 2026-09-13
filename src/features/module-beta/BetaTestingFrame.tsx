'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useRef, useState } from 'react'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { betaModuleForPath, feedbackPagePath, type BetaModule } from './catalog'
import {
  ScreenshotEditor,
  type ScreenshotDraft,
  type ScreenshotEditorHandle,
} from './ScreenshotEditor'

export function BetaTestingFrame({
  moduleEntry,
  locale,
}: {
  moduleEntry: BetaModule
  locale: string
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const screenshotDraft = useRef<ScreenshotDraft>({ source: null, rects: [] })
  const editor = useRef<ScreenshotEditorHandle>(null)
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [selectedText, setSelectedText] = useState('')
  const [pagePath, setPagePath] = useState(`/${locale}${moduleEntry.path}`)
  const [reportModule, setReportModule] = useState(moduleEntry)
  const [reportId, setReportId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sending, setSending] = useState(false)
  const [capturing, setCapturing] = useState(false)

  function beginFeedback() {
    setError('')
    setSuccess('')
    // A closed, unsent draft keeps its original location and screenshot.
    if (reportId) {
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
      setPagePath(feedbackPagePath(url))
      setReportModule(currentModule)
      setSelectedText((window.getSelection()?.toString() ?? '').slice(0, 3000))
      setReportId(crypto.randomUUID())
      setOpen(true)
    } catch {
      setError('Return to a module on this site before sending feedback.')
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      const image = await editor.current?.exportImage()
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
      setOpen(false)
      setComment('')
      setSelectedText('')
      setReportId('')
      screenshotDraft.current = { source: null, rects: [] }
      setSuccess(`Feedback saved. Reference ${result.id.slice(0, 8)}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feedback could not be saved. Please retry.')
    } finally {
      setSending(false)
    }
  }
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            aria-label="All beta modules"
            href={`/${locale}/development-beta` as Route}
            className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> All modules
          </Link>
          <div>
            <p className="text-xs font-semibold text-primary">Beta testing</p>
            <h1 className="text-sm font-semibold md:text-base">{moduleEntry.title}</h1>
          </div>
        </div>
        <Button size="sm" onClick={beginFeedback}>
          <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
          {reportId ? 'Continue feedback' : 'Give feedback'}
        </Button>
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
          if (!sending) setOpen(value)
        }}
      >
        <DialogContent
          overlayClassName={capturing ? 'invisible' : undefined}
          className={`max-h-[90dvh] max-w-2xl overflow-y-auto ${capturing ? 'invisible' : ''}`}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Module feedback</DialogTitle>
            <DialogDescription>
              {reportModule.title} · Saved to the site team’s private review workspace.
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
                onChange={(event) => setComment(event.target.value)}
                className="min-h-32 w-full rounded-lg border bg-background p-3"
                placeholder="What happened, what you expected, or what would make this clearer…"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Text or section you’re referring to (optional)
              <textarea
                maxLength={3000}
                value={selectedText}
                onChange={(event) => setSelectedText(event.target.value)}
                className="min-h-16 w-full rounded-lg border bg-background p-3"
                placeholder="Select text in the module before opening feedback, or paste it here."
              />
            </label>
            <ScreenshotEditor
              key={reportId}
              ref={editor}
              draft={screenshotDraft}
              onCaptureVisibilityChange={setCapturing}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={sending}
                onClick={() => {
                  setOpen(false)
                  setReportId('')
                  screenshotDraft.current = { source: null, rects: [] }
                  setComment('')
                  setSelectedText('')
                  setError('')
                }}
              >
                Discard draft
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={sending}
                onClick={() => setOpen(false)}
              >
                Continue testing
              </Button>
              <Button type="submit" disabled={sending || !comment.trim()}>
                {sending ? 'Saving…' : 'Send feedback'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

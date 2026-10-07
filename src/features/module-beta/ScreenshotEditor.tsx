'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ArrowUpRight, Camera, Pencil, Square, Type, Undo2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { maxScreenshotBytes } from './schema'
import { captureSiteTab, SiteTabCaptureError, supportsSiteTabCapture } from './captureSiteTab'
import { canvasPng } from './screenshotDraftImage'
import {
  drawAnnotation,
  type Point,
  type ScreenshotAnnotation,
  type ScreenshotTool,
} from './screenshotAnnotations'

// Synchronous on purpose: Save takes the final image in the same turn as the rest of its
// snapshot, so nothing can change between the two.
export type ScreenshotEditorHandle = { exportImage: () => Blob | null }
export type ScreenshotDraft = {
  source: HTMLCanvasElement | null
  annotations: ScreenshotAnnotation[]
}
export const createScreenshotDraft = (): ScreenshotDraft => ({ source: null, annotations: [] })
const tools = [
  { id: 'box', label: 'Box', icon: Square },
  { id: 'arrow', label: 'Arrow', icon: ArrowUpRight },
  { id: 'draw', label: 'Draw', icon: Pencil },
  { id: 'text', label: 'Text', icon: Type },
] as const

export const ScreenshotEditor = forwardRef<
  ScreenshotEditorHandle,
  {
    draft: React.RefObject<ScreenshotDraft>
    onCaptureVisibilityChange: (hidden: boolean) => void
    // Called after the image or its committed annotations change, never for a pointer preview.
    onDraftChange?: () => void
    // A save is in progress: the image and its marks cannot be changed until it settles.
    locked?: boolean
  }
>(function ScreenshotEditor({ draft, onCaptureVisibilityChange, onDraftChange, locked }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const gesture = useRef<{ pointerId: number; annotation: ScreenshotAnnotation } | null>(null)
  const operation = useRef<AbortController | null>(null)
  const [hasImage, setHasImage] = useState(Boolean(draft.current.source))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [canCapture, setCanCapture] = useState(false)
  const [marks, setMarks] = useState(draft.current.annotations.length)
  const [tool, setTool] = useState<ScreenshotTool>('box')
  const [note, setNote] = useState('')

  useEffect(() => {
    setCanCapture(supportsSiteTabCapture())
    const canvas = canvasRef.current,
      source = draft.current.source
    if (canvas && source) {
      canvas.width = source.width
      canvas.height = source.height
      draw()
    }
    return () => operation.current?.abort()
    // Restore the draft once when reopening the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function draw(preview?: ScreenshotAnnotation) {
    const canvas = canvasRef.current,
      source = draft.current.source
    if (!canvas || !source) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(source, 0, 0)
    for (const annotation of draft.current.annotations) drawAnnotation(ctx, annotation)
    if (preview) drawAnnotation(ctx, preview)
  }
  function setSourceImage(image: CanvasImageSource, width: number, height: number) {
    const scale = Math.min(1, 2000 / Math.max(width, height))
    const source = document.createElement('canvas')
    source.width = Math.max(1, Math.round(width * scale))
    source.height = Math.max(1, Math.round(height * scale))
    source.getContext('2d')!.drawImage(image, 0, 0, source.width, source.height)
    draft.current.source = source
    draft.current.annotations = []
    gesture.current = null
    const canvas = canvasRef.current!
    canvas.width = source.width
    canvas.height = source.height
    setMarks(0)
    setHasImage(true)
    setTool('box')
    draw()
    onDraftChange?.()
  }
  async function loadFile(file?: File) {
    if (!file || operation.current || locked) return
    setError('')
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    ) {
      setError('Choose a PNG, JPEG, or WebP image under 15 MB.')
      return
    }
    const controller = new AbortController()
    operation.current = controller
    setBusy(true)
    try {
      const image = await createImageBitmap(file)
      try {
        if (!controller.signal.aborted) setSourceImage(image, image.width, image.height)
      } finally {
        image.close()
      }
    } catch {
      if (!controller.signal.aborted)
        setError('This image could not be opened. Try another screenshot.')
    } finally {
      operation.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  async function capture() {
    if (operation.current || locked) return
    const controller = new AbortController()
    operation.current = controller
    onCaptureVisibilityChange(true)
    setError('')
    setBusy(true)
    try {
      const image = await captureSiteTab(controller.signal)
      if (!controller.signal.aborted) setSourceImage(image, image.width, image.height)
    } catch (err) {
      if (!controller.signal.aborted)
        setError(
          err instanceof SiteTabCaptureError
            ? err.message
            : err instanceof Error && err.name === 'NotAllowedError'
              ? 'Capture cancelled. Try again, or upload or paste a screenshot.'
              : 'Tab capture is unavailable. Upload or paste a screenshot instead.',
        )
    } finally {
      operation.current = null
      if (!controller.signal.aborted) setBusy(false)
      onCaptureVisibilityChange(false)
    }
  }
  useImperativeHandle(ref, () => ({
    exportImage: () => {
      if (operation.current) throw new Error('Wait for the screenshot to finish loading.')
      if (!hasImage || !canvasRef.current) return null
      // Export only committed annotations, never a half-drawn pointer preview.
      draw()
      const blob = canvasPng(canvasRef.current)
      if (!blob) throw new Error('The screenshot could not be prepared.')
      if (blob.size > maxScreenshotBytes)
        throw new Error(
          'The screenshot is too detailed to send. Use a smaller image (up to 3 MB after processing).',
        )
      return blob
    },
  }))
  function point(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = event.currentTarget,
      box = canvas.getBoundingClientRect()
    return {
      x: Math.max(
        0,
        Math.min(canvas.width, ((event.clientX - box.left) * canvas.width) / box.width),
      ),
      y: Math.max(
        0,
        Math.min(canvas.height, ((event.clientY - box.top) * canvas.height) / box.height),
      ),
    }
  }
  function commit(annotation: ScreenshotAnnotation) {
    draft.current.annotations.push(annotation)
    setMarks(draft.current.annotations.length)
    draw()
    onDraftChange?.()
  }
  function addNote(position: Point) {
    if (!note.trim()) {
      setError('Enter a text note, then click the image to place it.')
      return
    }
    setError('')
    commit({ tool: 'text', point: position, text: note.trim() })
  }
  function cancelGesture() {
    gesture.current = null
    draw()
  }
  return (
    <section
      className="space-y-3 rounded-xl border p-4"
      aria-label="Screenshot attachment"
      onPaste={(event) => {
        if (busy || locked) return
        const item = Array.from(event.clipboardData.items).find((entry) =>
          entry.type.startsWith('image/'),
        )
        if (item) {
          event.preventDefault()
          void loadFile(item.getAsFile() ?? undefined)
        }
      }}
    >
      <h3 className="font-semibold">
        Screenshot <span className="font-normal text-muted-foreground">(optional)</span>
      </h3>
      <p className="text-sm leading-5 text-muted-foreground">
        Capture the module, then mark the part you’re referring to. Do not include patient
        information.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {canCapture && (
          <Button type="button" size="sm" onClick={capture} disabled={busy}>
            <Camera className="mr-2 h-4 w-4" aria-hidden />
            {busy ? 'Preparing…' : hasImage ? 'Retake this tab' : 'Capture this tab'}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" aria-hidden /> Upload image
        </Button>
        <input
          ref={fileRef}
          aria-label="Upload screenshot"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          disabled={busy}
          onChange={(event) => {
            void loadFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <span className="text-xs text-muted-foreground">or paste an image here</span>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {canCapture
          ? 'When the browser asks, choose “This Tab” and Share. Only this site tab will be attached.'
          : 'Tab capture is unavailable in this browser. Upload or paste a screenshot to annotate it.'}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {hasImage && (
        <div className="space-y-2">
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Annotation tools"
          >
            {tools.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={tool === id ? 'default' : 'outline'}
                aria-pressed={tool === id}
                disabled={busy}
                onClick={() => {
                  cancelGesture()
                  setTool(id)
                }}
              >
                <Icon className="mr-1.5 h-4 w-4" aria-hidden />
                {label}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !marks}
              onClick={() => {
                cancelGesture()
                draft.current.annotations.pop()
                setMarks(draft.current.annotations.length)
                draw()
                onDraftChange?.()
              }}
            >
              <Undo2 className="mr-1.5 h-4 w-4" aria-hidden />
              Undo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy || !marks}
              onClick={() => {
                cancelGesture()
                draft.current.annotations = []
                setMarks(0)
                draw()
                onDraftChange?.()
              }}
            >
              Clear marks
            </Button>
          </div>
          {tool === 'text' ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-sm font-medium">
                Text note
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={80}
                  className="mt-1 block w-full rounded-lg border bg-background p-2"
                  disabled={busy}
                  placeholder="Describe what needs attention…"
                />
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !note.trim()}
                onClick={() =>
                  addNote({
                    x: canvasRef.current!.width * 0.05,
                    y: canvasRef.current!.height * 0.05,
                  })
                }
              >
                Add note at top
              </Button>
            </div>
          ) : null}
          <p id="screenshot-tool-help" className="text-xs text-muted-foreground">
            {tool === 'text'
              ? 'Enter a note, then click to place it. “Add note at top” also works with the keyboard.'
              : tool === 'draw'
                ? 'Drag to draw on the screenshot.'
                : tool === 'arrow'
                  ? 'Drag from the arrow’s tail toward the part you want to point out.'
                  : 'Drag to draw a box around the part you want to highlight.'}
          </p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        aria-label="Screenshot preview. Use the annotation tools to mark the image, or describe the area in your comment."
        aria-describedby={hasImage ? 'screenshot-tool-help' : undefined}
        className={
          hasImage
            ? `h-auto w-full touch-none rounded border ${busy ? 'pointer-events-none' : 'cursor-crosshair'}`
            : 'hidden'
        }
        onPointerDown={(event) => {
          if (busy || locked || event.button !== 0 || gesture.current) return
          const start = point(event)
          if (tool === 'text') {
            addNote(start)
            return
          }
          event.currentTarget.setPointerCapture(event.pointerId)
          gesture.current = {
            pointerId: event.pointerId,
            annotation:
              tool === 'draw' ? { tool: 'draw', points: [start] } : { tool, start, end: start },
          }
        }}
        onPointerMove={(event) => {
          const active = gesture.current
          if (!active || active.pointerId !== event.pointerId) return
          const end = point(event)
          if (active.annotation.tool === 'draw') active.annotation.points.push(end)
          else if (active.annotation.tool !== 'text') active.annotation.end = end
          draw(active.annotation)
        }}
        onPointerUp={(event) => {
          const active = gesture.current
          if (!active || active.pointerId !== event.pointerId) return
          const annotation = active.annotation,
            end = point(event)
          gesture.current = null
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId)
          if (annotation.tool === 'draw') {
            annotation.points.push(end)
            if (
              annotation.points.some(
                (p) => Math.hypot(p.x - annotation.points[0].x, p.y - annotation.points[0].y) > 3,
              )
            )
              commit(annotation)
          } else if (annotation.tool !== 'text') {
            annotation.end = end
            const dx = Math.abs(end.x - annotation.start.x),
              dy = Math.abs(end.y - annotation.start.y)
            if (annotation.tool === 'box' ? dx > 3 && dy > 3 : Math.hypot(dx, dy) > 3)
              commit(annotation)
          }
          draw()
        }}
        onPointerCancel={cancelGesture}
        onLostPointerCapture={cancelGesture}
      />
      {hasImage && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground" role="status">
            {marks} {marks === 1 ? 'annotation' : 'annotations'} · Included with your feedback
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              gesture.current = null
              draft.current.source = null
              draft.current.annotations = []
              setHasImage(false)
              setMarks(0)
              onDraftChange?.()
            }}
          >
            Remove image
          </Button>
        </div>
      )}
    </section>
  )
})

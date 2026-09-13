'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { maxScreenshotBytes } from './schema'

export type ScreenshotEditorHandle = { exportImage: () => Promise<Blob | null> }
export type ScreenshotDraft = { source: HTMLCanvasElement | null; rects: Rect[] }
type Rect = { x: number; y: number; width: number; height: number }

export const ScreenshotEditor = forwardRef<
  ScreenshotEditorHandle,
  { draft: React.RefObject<ScreenshotDraft>; onCaptureVisibilityChange: (hidden: boolean) => void }
>(function ScreenshotEditor({ draft, onCaptureVisibilityChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const [hasImage, setHasImage] = useState(Boolean(draft.current.source))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [marks, setMarks] = useState(draft.current.rects.length)

  useEffect(() => {
    const canvas = canvasRef.current,
      source = draft.current.source
    if (canvas && source) {
      canvas.width = source.width
      canvas.height = source.height
      draw()
    }
    // The draft belongs to this mounted editor; redraw once after mounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function draw(preview?: Rect) {
    const canvas = canvasRef.current,
      source = draft.current.source
    if (!canvas || !source) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(source, 0, 0)
    for (const rect of [...draft.current.rects, ...(preview ? [preview] : [])]) {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.25)'
      ctx.strokeStyle = '#d97706'
      ctx.lineWidth = Math.max(3, canvas.width / 500)
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
    }
  }
  function setSourceImage(image: CanvasImageSource, width: number, height: number) {
    const scale = Math.min(1, 2000 / Math.max(width, height))
    const source = document.createElement('canvas')
    source.width = Math.round(width * scale)
    source.height = Math.round(height * scale)
    source.getContext('2d')!.drawImage(image, 0, 0, source.width, source.height)
    draft.current.source = source
    const canvas = canvasRef.current!
    canvas.width = source.width
    canvas.height = source.height
    draft.current.rects = []
    setMarks(0)
    setHasImage(true)
    draw()
  }
  async function loadFile(file?: File) {
    if (!file) return
    setError('')
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    ) {
      setError('Choose a PNG, JPEG, or WebP image under 15 MB.')
      return
    }
    setBusy(true)
    try {
      const image = await createImageBitmap(file)
      try {
        setSourceImage(image, image.width, image.height)
      } finally {
        image.close()
      }
    } catch {
      setError('This image could not be opened. Try another screenshot.')
    } finally {
      setBusy(false)
    }
  }
  async function capture() {
    onCaptureVisibilityChange(true)
    setError('')
    setBusy(true)
    let stream: MediaStream | undefined
    try {
      if (!navigator.mediaDevices?.getDisplayMedia)
        throw new Error('Upload or paste a screenshot on this browser.')
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const video = document.createElement('video')
      video.srcObject = stream
      video.muted = true
      await video.play()
      await new Promise<void>((resolve) =>
        video.requestVideoFrameCallback
          ? video.requestVideoFrameCallback(() => resolve())
          : requestAnimationFrame(() => resolve()),
      )
      setSourceImage(video, video.videoWidth, video.videoHeight)
      video.pause()
      video.srcObject = null
    } catch (err) {
      setError(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Capture cancelled. You can still upload or paste an image.'
          : 'Screen capture is unavailable. Upload or paste a screenshot instead.',
      )
    } finally {
      stream?.getTracks().forEach((track) => track.stop())
      setBusy(false)
      onCaptureVisibilityChange(false)
    }
  }
  useImperativeHandle(ref, () => ({
    exportImage: async () => {
      if (busy) throw new Error('Wait for the screenshot to finish loading.')
      if (!hasImage || !canvasRef.current) return null
      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current!.toBlob(resolve, 'image/png'),
      )
      if (!blob) throw new Error('The screenshot could not be prepared.')
      if (blob.size > maxScreenshotBytes)
        throw new Error(
          'The screenshot is too detailed to send. Use a smaller image (up to 3 MB after processing).',
        )
      return blob
    },
  }))
  function point(event: React.PointerEvent<HTMLCanvasElement>) {
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
  function rectangle(end: { x: number; y: number }): Rect {
    const start = startRef.current!
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    }
  }
  return (
    <section
      className="space-y-3 rounded-xl border p-4"
      aria-label="Screenshot attachment"
      onPaste={(event) => {
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
        Image or screenshot <span className="font-normal text-muted-foreground">(optional)</span>
      </h3>
      <p className="text-xs leading-5 text-muted-foreground">
        Upload or paste an image here, or capture a screen you choose. Drag on the image to
        highlight an area. Use the comment to describe the marked area. Do not include patient
        information.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm">
          Upload image
          <input
            aria-label="Upload screenshot"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="mt-1 block max-w-full text-xs"
            disabled={busy}
            onChange={(event) => {
              void loadFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
        <Button type="button" variant="outline" size="sm" onClick={capture} disabled={busy}>
          {busy ? 'Preparing…' : 'Capture screen'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <canvas
        ref={canvasRef}
        aria-label="Screenshot preview. Drag to highlight an area; describe the area in your comment as a keyboard alternative."
        className={hasImage ? 'h-auto w-full touch-none rounded border' : 'hidden'}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.currentTarget.setPointerCapture(event.pointerId)
          startRef.current = point(event)
        }}
        onPointerMove={(event) => {
          if (startRef.current) draw(rectangle(point(event)))
        }}
        onPointerUp={(event) => {
          if (!startRef.current) return
          const rect = rectangle(point(event))
          if (rect.width > 3 && rect.height > 3) draft.current.rects.push(rect)
          startRef.current = null
          setMarks(draft.current.rects.length)
          draw()
        }}
        onPointerCancel={() => {
          startRef.current = null
          draw()
        }}
      />
      {hasImage && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!marks}
            onClick={() => {
              draft.current.rects.pop()
              setMarks(draft.current.rects.length)
              draw()
            }}
          >
            Undo highlight
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              draft.current.source = null
              draft.current.rects = []
              setHasImage(false)
              setMarks(0)
            }}
          >
            Remove image
          </Button>
          <span className="text-xs text-muted-foreground">
            {marks} highlighted {marks === 1 ? 'area' : 'areas'}
          </span>
        </div>
      )}
    </section>
  )
})

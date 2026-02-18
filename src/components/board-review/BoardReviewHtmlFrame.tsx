'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface BoardReviewHtmlFrameProps {
  html: string
  title: string
}

const MIN_FRAME_HEIGHT = 1200
const HEIGHT_EVENT = 'board-review-html-height'

function injectResizeScript(html: string) {
  const script = `<script>
  (function () {
    function postHeight() {
      var body = document.body
      var root = document.documentElement
      var height = Math.max(
        body ? body.scrollHeight : 0,
        root ? root.scrollHeight : 0,
        body ? body.offsetHeight : 0,
        root ? root.offsetHeight : 0
      )

      if (window.parent) {
        window.parent.postMessage({ type: '${HEIGHT_EVENT}', height: height }, '*')
      }
    }

    window.addEventListener('load', postHeight)
    window.addEventListener('resize', postHeight)

    if (typeof ResizeObserver !== 'undefined' && document.body) {
      var observer = new ResizeObserver(postHeight)
      observer.observe(document.body)
    }

    setTimeout(postHeight, 50)
    setTimeout(postHeight, 300)
    setTimeout(postHeight, 1000)
  })()
  <\/script>`

  if (html.includes('</body>')) {
    return html.replace('</body>', `${script}</body>`)
  }

  return `${html}\n${script}`
}

export function BoardReviewHtmlFrame({ html, title }: BoardReviewHtmlFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(MIN_FRAME_HEIGHT)
  const srcDoc = useMemo(() => injectResizeScript(html), [html])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return
      }

      const payload = event.data as { type?: string; height?: number } | undefined
      if (!payload || payload.type !== HEIGHT_EVENT) {
        return
      }

      if (typeof payload.height !== 'number' || !Number.isFinite(payload.height)) {
        return
      }

      const nextHeight = Math.max(MIN_FRAME_HEIGHT, Math.ceil(payload.height) + 8)
      setHeight((current) => (Math.abs(nextHeight - current) > 4 ? nextHeight : current))
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const handleLoad = () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) {
      return
    }

    const fallbackHeight = Math.max(
      MIN_FRAME_HEIGHT,
      doc.documentElement?.scrollHeight ?? 0,
      doc.body?.scrollHeight ?? 0,
    )
    setHeight(fallbackHeight + 8)
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-sm">
      <iframe
        ref={iframeRef}
        title={`${title} chapter`}
        srcDoc={srcDoc}
        onLoad={handleLoad}
        className="w-full border-0 bg-white"
        style={{ height: `${height}px` }}
        sandbox="allow-same-origin allow-scripts"
      />
    </div>
  )
}

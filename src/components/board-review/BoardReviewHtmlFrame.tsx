'use client'

import { useEffect, useMemo, useRef } from 'react'

import { MermaidDiagram } from './MermaidDiagram'
import { HandoffContent } from '@/i18n/handoff'

interface BoardReviewHtmlFrameProps {
  html: string
  title: string
}

interface HtmlPart {
  type: 'html' | 'mermaid'
  content: string
}

const mermaidBlockPattern = /<div\s+class=["']mermaid["'][^>]*>([\s\S]*?)<\/div>/gi

export function BoardReviewHtmlFrame({ html, title }: BoardReviewHtmlFrameProps) {
  const articleRef = useRef<HTMLElement>(null)
  const parts = useMemo(() => splitHtmlIntoParts(extractBodyHtml(html)), [html])

  useEffect(() => {
    const root = articleRef.current
    if (!root) {
      return
    }

    root.querySelectorAll('table').forEach((table) => {
      if (table.parentElement?.classList.contains('board-review-table-scroll')) {
        return
      }

      const wrapper = document.createElement('div')
      wrapper.className = 'board-review-table-scroll'
      table.parentNode?.insertBefore(wrapper, table)
      wrapper.appendChild(table)
    })
  }, [parts])

  return (
    <HandoffContent>
      {
        <article
          ref={articleRef}
          className="board-review-html"
          aria-label={`${title} chapter content`}
        >
          {parts.map((part, index) =>
            part.type === 'mermaid' ? (
              <MermaidDiagram key={`${part.type}-${index}`} chart={part.content} variant="light" />
            ) : (
              <div
                key={`${part.type}-${index}`}
                className="board-review-html-content"
                dangerouslySetInnerHTML={{ __html: part.content }}
              />
            ),
          )}
        </article>
      }
    </HandoffContent>
  )
}

function extractBodyHtml(html: string) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const body = bodyMatch?.[1] ?? html

  return body
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .trim()
}

function splitHtmlIntoParts(html: string): HtmlPart[] {
  const parts: HtmlPart[] = []
  let lastIndex = 0

  for (const match of html.matchAll(mermaidBlockPattern)) {
    const startIndex = match.index ?? 0
    const htmlBefore = html.slice(lastIndex, startIndex)

    if (htmlBefore.trim()) {
      parts.push({ type: 'html', content: htmlBefore })
    }

    parts.push({ type: 'mermaid', content: decodeEntities(match[1].trim()) })
    lastIndex = startIndex + match[0].length
  }

  const htmlAfter = html.slice(lastIndex)
  if (htmlAfter.trim()) {
    parts.push({ type: 'html', content: htmlAfter })
  }

  return parts
}

function decodeEntities(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

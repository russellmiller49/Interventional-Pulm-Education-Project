'use client'

import { useEffect, useId, useState } from 'react'

type MermaidInstance = typeof import('mermaid')['default']

let mermaidLoader: Promise<MermaidInstance> | null = null

async function getMermaid(): Promise<MermaidInstance> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Mermaid is only available in the browser'))
  }

  if (!mermaidLoader) {
    mermaidLoader = import('mermaid').then(async ({ default: mermaid }) => {
      const win = window as typeof window & { __mermaidInitialized?: boolean }

      if (!win.__mermaidInitialized) {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'dark',
          themeVariables: {
            primaryColor: '#1d4ed8',
            primaryTextColor: '#0f172a',
            primaryBorderColor: '#2563eb',
            lineColor: '#94a3b8',
            secondaryColor: '#0f172a',
            tertiaryColor: '#111827',
            background: 'transparent',
            clusterBkg: '#0f172a',
            clusterBorder: '#1f2937',
            nodeTextColor: '#e2e8f0',
          },
          flowchart: {
            curve: 'basis',
            htmlLabels: true,
          },
        })

        win.__mermaidInitialized = true
      }

      return mermaid as unknown as MermaidInstance
    })
  }

  return mermaidLoader
}

interface MermaidDiagramProps {
  chart: string
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const id = useId().replace(/[:]/g, '')

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        setError(null)
        const mermaid = await getMermaid()
        const normalizedChart = decodeEntities(chart)
        await mermaid.parse(normalizedChart)
        const { svg } = await mermaid.render(`mermaid-${id}`, normalizedChart)
        if (!cancelled) {
          setSvg(svg)
        }
      } catch (err) {
        console.error('Mermaid render failed', err)
        if (!cancelled) {
          setError('Unable to render flowchart.')
          setSvg(null)
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [chart, id])

  return (
    <div className="my-6 overflow-x-auto rounded-3xl border border-border/60 bg-background/90 p-5 text-sm text-muted-foreground shadow-sm">
      {error ? (
        <div>{error}</div>
      ) : svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div>Rendering flowchart…</div>
      )}
    </div>
  )
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

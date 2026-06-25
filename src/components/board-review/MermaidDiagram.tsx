'use client'

import { useEffect, useId, useState } from 'react'

import { cn } from '@/lib/cn'
import { HandoffContent } from '@/i18n/handoff'

type MermaidInstance = (typeof import('mermaid'))['default']

let mermaidLoader: Promise<MermaidInstance> | null = null

async function getMermaid(): Promise<MermaidInstance> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Mermaid is only available in the browser'))
  }

  if (!mermaidLoader) {
    mermaidLoader = import('mermaid').then(({ default: mermaid }) => mermaid as MermaidInstance)
  }

  return mermaidLoader
}

interface MermaidDiagramProps {
  chart: string
  variant?: 'dark' | 'light'
}

export function MermaidDiagram({ chart, variant = 'dark' }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const id = useId().replace(/[:]/g, '')

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        setError(null)
        const mermaid = await getMermaid()
        let normalizedChart = decodeEntities(chart)

        // Remove <br/> and <br> tags that break Mermaid parsing
        normalizedChart = normalizedChart.replace(/<br\s*\/?>/gi, ' ')

        mermaid.initialize(getMermaidConfig(variant))
        await mermaid.parse(normalizedChart)
        const { svg } = await mermaid.render(`mermaid-${id}`, normalizedChart)

        if (!cancelled) {
          setSvg(svg)
        }
      } catch (err) {
        console.error('Mermaid render failed:', err)
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
  }, [chart, id, variant])

  return (
    <HandoffContent>
      {
        <div
          className={cn(
            'my-6 overflow-x-auto rounded-2xl border p-5 text-sm shadow-sm',
            variant === 'light'
              ? 'border-slate-200 bg-white text-slate-600'
              : 'border-border/60 bg-background/90 text-muted-foreground',
          )}
        >
          {error ? (
            <div>{error}</div>
          ) : svg ? (
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div>Rendering flowchart…</div>
          )}
        </div>
      }
    </HandoffContent>
  )
}

function getMermaidConfig(variant: 'dark' | 'light') {
  if (variant === 'light') {
    return {
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      themeVariables: {
        primaryColor: '#e0f2fe',
        primaryTextColor: '#0f172a',
        primaryBorderColor: '#38bdf8',
        lineColor: '#64748b',
        secondaryColor: '#ecfdf5',
        tertiaryColor: '#f8fafc',
        background: 'transparent',
        clusterBkg: '#f8fafc',
        clusterBorder: '#cbd5e1',
        nodeTextColor: '#0f172a',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      flowchart: {
        curve: 'basis',
        htmlLabels: true,
      },
    } as const
  }

  return {
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
  } as const
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

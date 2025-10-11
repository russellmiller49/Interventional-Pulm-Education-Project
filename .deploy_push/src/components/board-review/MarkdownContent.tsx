'use client'

import { useMemo } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/cn'

import { MermaidDiagram } from './MermaidDiagram'

interface MarkdownContentProps {
  content: string
  className?: string
}

interface MarkdownCodeProps extends HTMLAttributes<HTMLElement> {
  inline?: boolean
  className?: string
  children?: ReactNode
}

const markdownComponents: Components = {
  pre: (props) => {
    // Check if this pre contains a code block with mermaid
    const code = props.children as React.ReactElement
    if (code?.props?.className?.includes('language-mermaid')) {
      // Extract raw text content, handling both string and array of strings
      let content = code.props.children
      if (Array.isArray(content)) {
        content = content.join('')
      }
      const rawContent = String(content || '').trim()
      return <MermaidDiagram chart={rawContent} />
    }

    // For regular code blocks, render them nicely
    if (code?.props?.className?.startsWith('language-')) {
      return (
        <pre className="my-4 overflow-x-auto rounded-2xl border border-border/60 bg-background/80 p-4 text-xs text-muted-foreground">
          {props.children}
        </pre>
      )
    }

    return <pre {...props} />
  },
  p: (props) => <p className="leading-7 text-muted-foreground" {...props} />,
  li: ({ children, ...props }) => (
    <li className="leading-7 text-muted-foreground" {...props}>
      {children}
    </li>
  ),
  h2: (props) => <h2 className="text-lg font-semibold tracking-tight text-foreground" {...props} />,
  h3: (props) => (
    <h3 className="text-base font-semibold tracking-tight text-foreground" {...props} />
  ),
  strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-2xl border border-border/60 bg-card/70 shadow-sm">
      <table className="min-w-full border-separate border-spacing-0 text-sm">{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead
      className="bg-muted/40 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
      {...props}
    >
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => (
    <tbody className="[&>tr:nth-child(even)]:bg-muted/30" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }) => (
    <tr className="last:border-b-0" {...props}>
      {children}
    </tr>
  ),
  th: (props) => (
    <th
      className="border-b border-border/60 px-4 py-3 text-left text-muted-foreground"
      {...props}
    />
  ),
  td: (props) => (
    <td
      className="border-b border-border/40 px-4 py-3 align-top text-muted-foreground"
      {...props}
    />
  ),
  code: ({ inline, className, children, ...props }: MarkdownCodeProps) => {
    const match = /language-(\w+)/.exec(className ?? '')
    const language = match?.[1]
    const content = Array.isArray(children)
      ? children.join('')
      : typeof children === 'string'
        ? children
        : String(children ?? '')

    if (!inline && language === 'mermaid') {
      return <MermaidDiagram chart={content.trim()} />
    }

    if (!inline) {
      return (
        <pre className="my-4 overflow-x-auto rounded-2xl border border-border/60 bg-background/80 p-4 text-xs text-muted-foreground">
          <code {...props}>{children}</code>
        </pre>
      )
    }

    return (
      <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground" {...props}>
        {children}
      </code>
    )
  },
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const normalized = useMemo(() => content.replace(/\u2028|\u2029/g, '\n'), [content])

  return (
    <div
      className={cn(
        'prose prose-sm prose-invert prose-headings:scroll-mt-28 max-w-none dark:prose-invert',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {normalized}
      </ReactMarkdown>
    </div>
  )
}

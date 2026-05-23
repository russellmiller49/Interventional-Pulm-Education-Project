import type { ReactNode } from 'react'

interface DebriefPanelProps {
  title: string
  children: ReactNode
}

export function DebriefPanel({ title, children }: DebriefPanelProps) {
  return (
    <section className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <div className="mt-3 text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  )
}

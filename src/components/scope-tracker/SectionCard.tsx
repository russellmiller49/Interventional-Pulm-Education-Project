import type { ReactNode } from 'react'

interface SectionCardProps {
  title: string
  description?: string
  children: ReactNode
}

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-border/70 bg-card/70 p-6 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

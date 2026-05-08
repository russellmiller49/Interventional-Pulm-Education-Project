'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { Images, Sparkles } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/cn'

const resourceTabs = [
  {
    href: '/resources/creative-commons',
    label: 'Creative Commons Medical Images',
    description: 'Curated open-license figures for teaching and presentations',
    icon: Images,
  },
  {
    href: '/resources/vibe-coding-for-clinicians',
    label: 'Vibe Coding for Clinicians',
    description: 'A practical AI coding companion for physician-builders',
    icon: Sparkles,
  },
] as const

export function ResourceTabsNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Resource collections" className="mt-8">
      <div className="grid gap-3 rounded-2xl border border-border/80 bg-background/70 p-2 shadow-sm md:grid-cols-2">
        {resourceTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`)

          return (
            <Link
              key={tab.href}
              href={tab.href as Route}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group flex min-h-24 items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isActive
                  ? 'border-primary/40 bg-primary/10 text-foreground shadow-sm'
                  : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                  isActive
                    ? 'border-primary/30 bg-primary text-primary-foreground'
                    : 'border-border bg-card text-primary',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 space-y-1">
                <span className="block text-sm font-semibold">{tab.label}</span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  {tab.description}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

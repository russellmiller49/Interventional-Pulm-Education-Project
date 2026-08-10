import type { Route } from 'next'
import Link from 'next/link'

import { cn } from '@/lib/cn'

/**
 * Server-rendered tabs as plain links driven by URL params. Keyboard-accessible by nature
 * (they are anchors), no client JS, and the selected tab is announced via `aria-current`.
 */
export function LinkTabs({
  label,
  tabs,
}: {
  label: string
  tabs: { key: string; label: string; href: Route; active: boolean }[]
}) {
  return (
    <nav aria-label={label} className="overflow-x-auto">
      <ul className="flex min-w-max gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              aria-current={tab.active ? 'page' : undefined}
              className={cn(
                'inline-block rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tab.active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

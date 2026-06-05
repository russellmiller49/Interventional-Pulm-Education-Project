import Link from 'next/link'
import type { Route } from 'next'

import { cn } from '@/lib/cn'

import type { ModuleNavItem } from '../types'

const columnClassByCount: Record<number, string> = {
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-2 xl:grid-cols-4',
  5: 'md:grid-cols-3 xl:grid-cols-5',
  6: 'md:grid-cols-3 xl:grid-cols-6',
}

interface ModuleNavProps {
  items: readonly ModuleNavItem[]
  activeHref: string
  ariaLabel?: string
}

/**
 * Generalized section nav (the parameterized successor to ChestDrainageNav).
 * Pass the module's section list and the current href; the matching tab is
 * highlighted. This is the shared spine that makes every templated module read
 * the same way.
 */
export function ModuleNav({ items, activeHref, ariaLabel = 'Module sections' }: ModuleNavProps) {
  const columns = columnClassByCount[items.length] ?? 'md:grid-cols-3'

  return (
    <nav className="container" aria-label={ariaLabel}>
      <div
        className={cn(
          'grid gap-2 rounded-lg border border-border/80 bg-background/80 p-2 shadow-sm',
          columns,
        )}
      >
        {items.map((item) => {
          const isActive = item.href === activeHref

          return (
            <Link
              key={item.href}
              href={item.href as Route}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isActive
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span className="block font-semibold">{item.title}</span>
              <span className={cn('mt-1 block text-xs leading-5', isActive && 'text-sky-50')}>
                {item.description}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

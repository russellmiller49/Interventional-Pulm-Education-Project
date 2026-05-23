import Link from 'next/link'
import type { Route } from 'next'

import { cn } from '@/lib/cn'

export const chestDrainageNavItems = [
  {
    href: '/pleural-procedures/chest-drainage',
    title: 'Overview',
    description: 'Dry-seal simulator and module map',
  },
  {
    href: '/pleural-procedures/chest-drainage/learn',
    title: 'Learn',
    description: 'Pressure, water seal, suction, and drain interpretation',
  },
  {
    href: '/pleural-procedures/chest-drainage/simulators',
    title: 'Simulators',
    description: 'Dry-seal knobology and trend cockpit',
  },
  {
    href: '/pleural-procedures/chest-drainage/troubleshooting',
    title: 'Troubleshooting',
    description: 'Patient-first branching cases',
  },
  {
    href: '/pleural-procedures/chest-drainage/assessment',
    title: 'Assessment',
    description: 'Quiz and scenario reasoning checks',
  },
  {
    href: '/pleural-procedures/chest-drainage/references',
    title: 'References',
    description: 'Sources and clinical review packet',
  },
] as const

interface ChestDrainageNavProps {
  activeHref: (typeof chestDrainageNavItems)[number]['href']
}

export function ChestDrainageNav({ activeHref }: ChestDrainageNavProps) {
  return (
    <nav className="container" aria-label="Chest drainage module sections">
      <div className="grid gap-2 rounded-lg border border-border/80 bg-background/80 p-2 shadow-sm md:grid-cols-3 xl:grid-cols-6">
        {chestDrainageNavItems.map((item) => {
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

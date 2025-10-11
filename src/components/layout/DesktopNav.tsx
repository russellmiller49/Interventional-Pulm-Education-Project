'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useMemo } from 'react'

import { cn } from '@/lib/cn'

export interface NavItem {
  title: string
  href: Route
  description?: string
}

interface DesktopNavProps {
  items: NavItem[]
  activePath?: string | null
}

export function DesktopNav({ items, activePath }: DesktopNavProps) {
  const normalizedPath = useMemo(() => {
    if (!activePath) {
      return '/'
    }

    if (activePath.length > 1 && activePath.endsWith('/')) {
      return activePath.slice(0, -1)
    }

    return activePath
  }, [activePath])

  if (!items.length) {
    return null
  }

  return (
    <nav
      aria-label="Primary"
      className="hidden flex-1 items-center justify-center gap-6 md:flex xl:gap-8"
    >
      {items.map((item) => {
        const isActive =
          normalizedPath === item.href ||
          (normalizedPath.startsWith(item.href) && item.href !== '/')

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-1 py-1 text-sm font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
              isActive && 'text-foreground'
            )}
          >
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}

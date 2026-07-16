'use client'

import type { Route } from 'next'
import { ChevronDownIcon } from '@radix-ui/react-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/cn'
import { HandoffContent } from '@/i18n/handoff'

export interface NavItem {
  title: string
  href: Route
  description?: string
  shortTitle?: string
  activePaths?: readonly string[]
}

interface DesktopNavProps {
  items: NavItem[]
  activePath?: string | null
}

const quickNavHrefs = new Set([
  '/ebus-training',
  '/journal-club-podcasts',
  '/learn/anatomy',
  '/board-prep',
  '/fluoroview',
  '/bronch-navigation-trainer',
])

export function DesktopNav({ items, activePath }: DesktopNavProps) {
  const t = useTranslations('navigation')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  const normalizedPath = useMemo(() => {
    if (!activePath) {
      return '/'
    }

    if (activePath.length > 1 && activePath.endsWith('/')) {
      return activePath.slice(0, -1)
    }

    return activePath
  }, [activePath])

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (navRef.current?.contains(event.target as Node)) {
        return
      }

      setIsMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  if (!items.length) {
    return <HandoffContent>{null}</HandoffContent>
  }

  const isItemActive = (item: NavItem) =>
    normalizedPath === item.href ||
    (normalizedPath.startsWith(item.href) && String(item.href) !== '/') ||
    item.activePaths?.some(
      (path) => normalizedPath === path || normalizedPath.startsWith(`${path}/`),
    ) === true

  const quickItems = items.filter((item) => quickNavHrefs.has(item.href))
  const hasActiveOverflowItem = items.some(isItemActive) && !quickItems.some(isItemActive)

  return (
    <HandoffContent>
      {
        <nav
          ref={navRef}
          aria-label={t('primary')}
          className="relative hidden min-w-0 flex-1 items-center justify-start gap-0.5 lg:flex xl:gap-1"
        >
          <button
            type="button"
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none xl:px-3',
              (isMenuOpen || hasActiveOverflowItem) && 'bg-primary/10 text-primary',
            )}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((value) => !value)}
          >
            {t('modules')}
            <ChevronDownIcon
              className={cn('h-4 w-4 transition-transform', isMenuOpen && 'rotate-180')}
              aria-hidden
            />
          </button>
          {quickItems.map((item) => {
            const isActive = isItemActive(item)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none xl:px-3',
                  isActive && 'bg-primary/10 text-primary',
                )}
              >
                {item.shortTitle ?? item.title}
              </Link>
            )
          })}
          {isMenuOpen ? (
            <div
              role="menu"
              className="absolute left-1/2 top-[calc(100%+0.75rem)] z-50 w-[min(36rem,calc(100vw-3rem))] -translate-x-1/2 overflow-hidden rounded-lg border bg-popover p-2 text-popover-foreground shadow-xl"
            >
              <div className="grid gap-1 sm:grid-cols-2">
                {items.map((item) => {
                  const isActive = isItemActive(item)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setIsMenuOpen(false)}
                      className={cn(
                        'block rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover motion-reduce:transition-none',
                        isActive && 'bg-primary/10 text-primary',
                      )}
                    >
                      <span className="block text-sm font-semibold">{item.title}</span>
                      {item.description ? (
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : null}
        </nav>
      }
    </HandoffContent>
  )
}

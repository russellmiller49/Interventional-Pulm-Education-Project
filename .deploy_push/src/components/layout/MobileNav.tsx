'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { GitHubLogoIcon, HamburgerMenuIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/cn'

import type { NavItem } from './DesktopNav'
import { ModeToggle } from './mode-toggle'
import { SearchShortcut } from './SearchShortcut'

interface MobileNavProps {
  items: NavItem[]
  activePath?: string | null
}

export function MobileNav({ items, activePath }: MobileNavProps) {
  const normalizedPath = useMemo(() => {
    if (!activePath) {
      return '/'
    }
    if (activePath.length > 1 && activePath.endsWith('/')) {
      return activePath.slice(0, -1)
    }
    return activePath
  }, [activePath])

  return (
    <div className="flex items-center gap-1 md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open navigation menu"
            className="h-10 w-10"
          >
            <HamburgerMenuIcon className="h-5 w-5" aria-hidden />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex h-full flex-col gap-6 bg-background/95 pb-8 backdrop-blur"
          aria-label="Mobile navigation"
        >
          <SheetHeader className="space-y-1">
            <SheetTitle className="text-lg">Navigate</SheetTitle>
            <SheetDescription>
              Explore tools, board prep modules, and community updates.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-6 overflow-y-auto">
            <nav aria-label="Primary mobile" className="flex flex-col gap-3">
              {items.map((item) => {
                const isActive =
                  normalizedPath === item.href ||
                  (normalizedPath.startsWith(item.href) && item.href !== '/')

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'rounded-md px-3 py-2 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
                      isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <span className="block">{item.title}</span>
                    {item.description ? (
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {item.description}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </nav>
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                className="justify-between gap-3"
                aria-label="Search (placeholder)"
              >
                <span className="flex items-center gap-2 text-base">
                  <MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
                  Search coming soon
                </span>
                <SearchShortcut />
              </Button>
              <Button
                asChild
                variant="secondary"
                className="justify-center gap-2"
                aria-label="Visit the GitHub organization"
              >
                <a href="https://github.com/interventional-pulm" target="_blank" rel="noreferrer">
                  <GitHubLogoIcon className="h-4 w-4" aria-hidden />
                  GitHub · 1.2k stars
                </a>
              </Button>
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Display
                </p>
                <ModeToggle className="w-full justify-center" />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

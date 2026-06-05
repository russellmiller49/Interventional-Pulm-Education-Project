'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useMemo } from 'react'
import { HamburgerMenuIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import type { NavAuthStatus, NavUserSummary } from './Navigation'
import { SearchShortcut } from './SearchShortcut'

interface MobileNavProps {
  items: NavItem[]
  activePath?: string | null
  authStatus: NavAuthStatus
  currentUser: NavUserSummary | null
  onLogout: () => void
}

export function MobileNav({
  items,
  activePath,
  authStatus,
  currentUser,
  onLogout,
}: MobileNavProps) {
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
    <div className="flex items-center gap-1 lg:hidden">
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
              Explore EBUS training, TNM-9 staging, anatomy, Nav Bronch, FluoroView, and resources.
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
              {currentUser ? (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold">
                      Welcome, {currentUser.displayName}
                    </p>
                    {currentUser.email ? (
                      <p className="truncate text-xs text-muted-foreground">{currentUser.email}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center"
                    onClick={onLogout}
                    disabled={authStatus === 'signing-out'}
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    {authStatus === 'signing-out' ? 'Logging out' : 'Log out'}
                  </Button>
                </div>
              ) : authStatus === 'checking' ? null : (
                <Button asChild variant="default" className="justify-center">
                  <Link href={'/login' as Route}>Sign in</Link>
                </Button>
              )}
              <form action="/search" className="space-y-2" role="search">
                <Input
                  type="search"
                  name="q"
                  placeholder="Search resources"
                  leadingIcon={<MagnifyingGlassIcon className="h-4 w-4" aria-hidden />}
                  aria-label="Search resources and guides"
                />
                <Button type="submit" variant="outline" className="w-full justify-between gap-3">
                  <span>Search resources</span>
                  <SearchShortcut />
                </Button>
              </form>
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

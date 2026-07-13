'use client'

import type { Route } from 'next'
import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { HamburgerMenuIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { LogOut, ShieldCheck } from 'lucide-react'

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
import { isActiveLocale } from '@/i18n/locale'
import { Link } from '@/i18n/navigation'
import { localizePath } from '@/i18n/path'
import { cn } from '@/lib/cn'

import type { NavItem } from './DesktopNav'
import { LanguageSelector } from './LanguageSelector'
import { ModeToggle } from './mode-toggle'
import type { NavAuthStatus, NavUserSummary } from './Navigation'
import { SearchShortcut } from './SearchShortcut'
import { HandoffContent } from '@/i18n/handoff'

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
  const locale = useLocale()
  const activeLocale = isActiveLocale(locale) ? locale : 'en'
  const common = useTranslations('common')
  const nav = useTranslations('navigation')
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
    <HandoffContent>
      {
        <div className="flex items-center gap-1 lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={nav('openMenu')}
                className="h-10 w-10"
              >
                <HamburgerMenuIcon className="h-5 w-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex h-full flex-col gap-6 bg-background/95 pb-8 backdrop-blur"
              aria-label={nav('mobileLabel')}
            >
              <SheetHeader className="space-y-1">
                <SheetTitle className="text-lg">{nav('navigate')}</SheetTitle>
                <SheetDescription>{nav('mobileDescription')}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-6 overflow-y-auto">
                <nav aria-label={nav('primary')} className="flex flex-col gap-3">
                  {items.map((item) => {
                    const isActive =
                      normalizedPath === item.href ||
                      (normalizedPath.startsWith(item.href) && String(item.href) !== '/') ||
                      item.activePaths?.some(
                        (path) => normalizedPath === path || normalizedPath.startsWith(`${path}/`),
                      ) === true

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'rounded-md px-3 py-2 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted',
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
                          {common.rich('welcome', {
                            name: currentUser.displayName,
                            userName: (chunks) => chunks,
                          })}
                        </p>
                        {currentUser.email ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {currentUser.email}
                          </p>
                        ) : null}
                      </div>
                      {currentUser.isAdmin ? (
                        <Button asChild variant="outline" className="w-full justify-center">
                          <Link href={'/admin' as Route}>
                            <ShieldCheck className="h-4 w-4" aria-hidden />
                            {common('admin')}
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-center"
                        onClick={onLogout}
                        disabled={authStatus === 'signing-out'}
                      >
                        <LogOut className="h-4 w-4" aria-hidden />
                        {authStatus === 'signing-out' ? common('loggingOut') : common('logOut')}
                      </Button>
                    </div>
                  ) : authStatus === 'checking' ? null : (
                    <Button asChild variant="default" className="justify-center">
                      <Link href={'/login' as Route}>{common('signIn')}</Link>
                    </Button>
                  )}
                  <form
                    action={localizePath('/search', activeLocale)}
                    className="space-y-2"
                    role="search"
                  >
                    <Input
                      type="search"
                      name="q"
                      placeholder={nav('searchResources')}
                      leadingIcon={<MagnifyingGlassIcon className="h-4 w-4" aria-hidden />}
                      aria-label={nav('searchResourcesAndGuides')}
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full justify-between gap-3"
                    >
                      <span>{nav('searchResources')}</span>
                      <SearchShortcut />
                    </Button>
                  </form>
                  <div className="space-y-3 rounded-lg border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {nav('display')}
                    </p>
                    <LanguageSelector className="w-full justify-between" />
                    <ModeToggle className="w-full justify-center" />
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      }
    </HandoffContent>
  )
}

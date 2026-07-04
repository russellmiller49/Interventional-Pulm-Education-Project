'use client'

import type { Route } from 'next'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { LogOut, ShieldCheck } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { isActiveLocale } from '@/i18n/locale'
import { localizePath } from '@/i18n/path'
import { isVisibleModulePath } from '@/lib/draft-modules'
import { supabaseBrowser, supabaseCookieBrowser } from '@/lib/supabase/browser'

import { DesktopNav, type NavItem } from './DesktopNav'
import { LanguageSelector } from './LanguageSelector'
import { MobileNav } from './MobileNav'
import { ModeToggle } from './mode-toggle'
import { HandoffContent } from '@/i18n/handoff'

export type NavAuthStatus = 'checking' | 'signed-in' | 'signed-out' | 'signing-out'

export interface NavUserSummary {
  displayName: string
  email: string | null
  isAdmin: boolean
}

interface SiteProfileName {
  first_name: string | null
  last_name: string | null
}

function getMetadataString(user: User, keys: string[]) {
  for (const key of keys) {
    const value = user.user_metadata?.[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function getProfileDisplayName(profile: SiteProfileName | null) {
  const displayName = [profile?.first_name, profile?.last_name]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ')

  return displayName || null
}

function getUserDisplayName(user: User, profile: SiteProfileName | null, fallbackName: string) {
  const metadataName = [
    getMetadataString(user, ['first_name']),
    getMetadataString(user, ['last_name']),
  ]
    .filter(Boolean)
    .join(' ')

  return (
    getProfileDisplayName(profile) ??
    getMetadataString(user, ['full_name', 'name']) ??
    (metadataName || null) ??
    user.email?.split('@')[0] ??
    fallbackName
  )
}

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale()
  const activeLocale = isActiveLocale(locale) ? locale : 'en'
  const common = useTranslations('common')
  const nav = useTranslations('navigation')
  const genericUserName = common('genericUser')
  const [searchQuery, setSearchQuery] = useState('')
  const [authStatus, setAuthStatus] = useState<NavAuthStatus>('checking')
  const [currentUser, setCurrentUser] = useState<NavUserSummary | null>(null)
  const allNavigationItems = useMemo<NavItem[]>(
    () => [
      {
        title: nav('items.ebusTraining.title'),
        shortTitle: nav('items.ebusTraining.shortTitle'),
        href: '/ebus-training' as Route,
        description: nav('items.ebusTraining.description'),
      },
      {
        title: nav('items.ebusVirtualBronch.title'),
        shortTitle: nav('items.ebusVirtualBronch.shortTitle'),
        href: '/ebus-training/virtual-bronchoscopy' as Route,
        description: nav('items.ebusVirtualBronch.description'),
      },
      {
        title: nav('items.podcastLibrary.title'),
        shortTitle: nav('items.podcastLibrary.shortTitle'),
        href: '/journal-club-podcasts' as Route,
        description: nav('items.podcastLibrary.description'),
      },
      {
        title: nav('items.tnm9.title'),
        shortTitle: nav('items.tnm9.shortTitle'),
        href: '/tnm-9-staging' as Route,
        description: nav('items.tnm9.description'),
      },
      {
        title: nav('items.anatomy.title'),
        shortTitle: nav('items.anatomy.shortTitle'),
        href: '/learn/anatomy' as Route,
        description: nav('items.anatomy.description'),
      },
      {
        title: nav('items.boardPrep.title'),
        shortTitle: nav('items.boardPrep.shortTitle'),
        href: '/board-prep' as Route,
        description: nav('items.boardPrep.description'),
      },
      {
        title: nav('items.fluoroview.title'),
        shortTitle: nav('items.fluoroview.shortTitle'),
        href: '/fluoroview' as Route,
        description: nav('items.fluoroview.description'),
      },
      {
        title: nav('items.bronchNavigation.title'),
        shortTitle: nav('items.bronchNavigation.shortTitle'),
        href: '/bronch-navigation-trainer' as Route,
        description: nav('items.bronchNavigation.description'),
      },
      {
        title: nav('items.thermalAblation.title'),
        shortTitle: nav('items.thermalAblation.shortTitle'),
        href: '/thermal-ablation' as Route,
        description: nav('items.thermalAblation.description'),
      },
      {
        title: nav('items.pleuralProcedures.title'),
        shortTitle: nav('items.pleuralProcedures.shortTitle'),
        href: '/pleural-procedures' as Route,
        description: nav('items.pleuralProcedures.description'),
      },
      {
        title: nav('items.resources.title'),
        shortTitle: nav('items.resources.shortTitle'),
        href: '/resources' as Route,
        description: nav('items.resources.description'),
      },
      {
        title: nav('items.socalEbusCourse.title'),
        shortTitle: nav('items.socalEbusCourse.shortTitle'),
        href: '/socal-ebus-course' as Route,
        description: nav('items.socalEbusCourse.description'),
      },
      {
        title: nav('items.rapidOnsiteCytology.title'),
        shortTitle: nav('items.rapidOnsiteCytology.shortTitle'),
        href: '/rapid-onsite-cytology' as Route,
        description: nav('items.rapidOnsiteCytology.description'),
      },
      {
        title: nav('items.introBronchoscopy.title'),
        shortTitle: nav('items.introBronchoscopy.shortTitle'),
        href: '/intro-bronchoscopy' as Route,
        description: nav('items.introBronchoscopy.description'),
      },
      {
        title: nav('items.ipRegistry.title'),
        shortTitle: nav('items.ipRegistry.shortTitle'),
        href: '/ip-registry' as Route,
        description: nav('items.ipRegistry.description'),
      },
      {
        title: nav('items.comingSoon.title'),
        shortTitle: nav('items.comingSoon.shortTitle'),
        href: '/coming-soon' as Route,
        description: nav('items.comingSoon.description'),
      },
    ],
    [nav],
  )
  const navigationItems = useMemo(
    () =>
      allNavigationItems.filter((item) =>
        isVisibleModulePath(item.href, {
          isAdmin: currentUser?.isAdmin === true,
        }),
      ),
    [allNavigationItems, currentUser?.isAdmin],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      const input = e.target as HTMLInputElement
      input.focus()
    }
  }

  const loadCurrentUser = useCallback(
    async (isActive: () => boolean) => {
      try {
        const supabase = supabaseCookieBrowser()
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (!isActive()) {
          return
        }

        if (error || !user) {
          setCurrentUser(null)
          setAuthStatus('signed-out')
          return
        }

        const [{ data: profileData }, { data: adminEntitlement }] = await Promise.all([
          supabase
            .from('site_profiles')
            .select('first_name,last_name')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('site_entitlements')
            .select('entitlement')
            .eq('user_id', user.id)
            .eq('entitlement', 'site_admin')
            .eq('status', 'active')
            .maybeSingle(),
        ])

        if (!isActive()) {
          return
        }

        const profile = profileData as SiteProfileName | null

        setCurrentUser({
          displayName: getUserDisplayName(user, profile, genericUserName),
          email: user.email ?? null,
          isAdmin: Boolean(adminEntitlement),
        })
        setAuthStatus('signed-in')
      } catch {
        if (!isActive()) {
          return
        }

        setCurrentUser(null)
        setAuthStatus('signed-out')
      }
    },
    [genericUserName],
  )

  useEffect(() => {
    let isActive = true
    const isStillActive = () => isActive

    let unsubscribe: (() => void) | undefined

    try {
      const supabase = supabaseCookieBrowser()
      queueMicrotask(() => {
        void loadCurrentUser(isStillActive)
      })

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(() => {
        void loadCurrentUser(isStillActive)
      })

      unsubscribe = () => subscription.unsubscribe()
    } catch {
      queueMicrotask(() => {
        if (!isStillActive()) {
          return
        }

        setCurrentUser(null)
        setAuthStatus('signed-out')
      })
    }

    return () => {
      isActive = false
      unsubscribe?.()
    }
  }, [loadCurrentUser])

  const handleLogout = useCallback(async () => {
    setAuthStatus('signing-out')

    const signOutTasks: Promise<unknown>[] = []

    try {
      signOutTasks.push(supabaseCookieBrowser().auth.signOut())
    } catch {
      // Supabase may be unavailable in local static previews.
    }

    try {
      signOutTasks.push(supabaseBrowser().auth.signOut())
    } catch {
      // Also clear the legacy local-storage client when it exists.
    }

    await Promise.allSettled(signOutTasks)
    setCurrentUser(null)
    setAuthStatus('signed-out')
    router.replace('/login' as Route)
    router.refresh()
  }, [router])

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  return (
    <HandoffContent>
      {
        <div className="flex w-full min-w-0 items-center justify-between gap-2 lg:gap-3">
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-md px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                {common('shortBrand')}
              </span>
            </Link>
          </div>
          <DesktopNav items={navigationItems} activePath={pathname} />
          <div className="hidden shrink-0 items-center justify-end gap-2 lg:flex">
            <Button asChild variant="ghost" size="icon" className="h-9 w-9 min-[1700px]:hidden">
              <Link href={'/search' as Route} aria-label={nav('searchResources')}>
                <MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <form
              action={localizePath('/search', activeLocale)}
              className="hidden items-center gap-1 min-[1700px]:flex"
              role="search"
            >
              <Input
                type="search"
                name="q"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={nav('searchPlaceholder')}
                leadingIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
                className="w-48 text-sm min-[1850px]:w-52"
                aria-label={nav('searchResourcesAndGuides')}
              />
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label={nav('searchResources')}
              >
                <MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
              </Button>
            </form>
            {currentUser ? (
              <div className="flex min-w-0 items-center gap-2">
                <p className="hidden max-w-36 truncate text-sm text-muted-foreground min-[1500px]:block min-[1850px]:max-w-44">
                  {common.rich('welcome', {
                    name: currentUser.displayName,
                    userName: (chunks) => (
                      <span className="font-semibold text-foreground">{chunks}</span>
                    ),
                  })}
                </p>
                {currentUser.isAdmin ? (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 px-0 min-[1500px]:w-auto min-[1500px]:px-4"
                  >
                    <Link href={'/admin' as Route}>
                      <ShieldCheck className="h-4 w-4" aria-hidden />
                      <span className="sr-only min-[1500px]:not-sr-only">{common('admin')}</span>
                    </Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 px-0 min-[1500px]:w-auto min-[1500px]:px-4"
                  onClick={handleLogout}
                  disabled={authStatus === 'signing-out'}
                  aria-label={
                    authStatus === 'signing-out' ? common('loggingOut') : common('logOut')
                  }
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  <span className="sr-only min-[1500px]:not-sr-only">
                    {authStatus === 'signing-out' ? common('loggingOut') : common('logOut')}
                  </span>
                </Button>
              </div>
            ) : authStatus === 'checking' ? null : (
              <Button asChild variant="outline" size="sm" className="hidden xl:inline-flex">
                <Link href={'/login' as Route}>{common('signIn')}</Link>
              </Button>
            )}
            <LanguageSelector compact className="hidden xl:inline-flex" />
            <ModeToggle
              size="sm"
              className="h-9 w-9 px-0 min-[1500px]:w-auto min-[1500px]:px-4 [&>span:last-child]:hidden min-[1500px]:[&>span:last-child]:inline"
            />
          </div>
          <MobileNav
            items={navigationItems}
            activePath={pathname}
            authStatus={authStatus}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        </div>
      }
    </HandoffContent>
  )
}

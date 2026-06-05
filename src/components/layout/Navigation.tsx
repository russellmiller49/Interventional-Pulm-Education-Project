'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useState, useEffect } from 'react'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { LogOut } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isVisibleModulePath } from '@/lib/draft-modules'
import { supabaseBrowser, supabaseCookieBrowser } from '@/lib/supabase/browser'

import { DesktopNav, type NavItem } from './DesktopNav'
import { MobileNav } from './MobileNav'
import { ModeToggle } from './mode-toggle'

export type NavAuthStatus = 'checking' | 'signed-in' | 'signed-out' | 'signing-out'

export interface NavUserSummary {
  displayName: string
  email: string | null
}

interface SiteProfileName {
  first_name: string | null
  last_name: string | null
}

const allNavigationItems: NavItem[] = [
  {
    title: 'EBUS Training',
    shortTitle: 'EBUS',
    href: '/ebus-training' as Route,
    description: 'Knobology, stations, and simulator modules',
  },
  {
    title: 'TNM-9 Staging',
    shortTitle: 'TNM-9',
    href: '/tnm-9-staging' as Route,
    description: 'Standalone lung cancer staging module',
  },
  {
    title: '3D Anatomy',
    shortTitle: 'Anatomy',
    href: '/learn/anatomy',
    description: '3D and interactive anatomy viewer',
  },
  {
    title: 'IP Board Prep',
    shortTitle: 'Board Prep',
    href: '/board-prep',
    description: 'Interactive board review chapters',
  },
  {
    title: 'FluoroView',
    href: '/fluoroview',
    description: 'C-arm airway simulation lab',
  },
  {
    title: 'Bronch Navigation',
    shortTitle: 'Nav Bronch',
    href: '/bronch-navigation-trainer' as Route,
    description: 'CT-to-bronchoscope navigation simulator',
  },
  {
    title: 'Pleural Procedures',
    href: '/pleural-procedures' as Route,
    description: 'Pleural disease and procedure modules',
  },
  {
    title: 'Resources',
    href: '/resources' as Route,
    description: 'Creative Commons assets & study aids',
  },
  {
    title: 'SoCal EBUS Course',
    shortTitle: 'EBUS Course',
    href: '/socal-ebus-course',
    description: 'For Southern California EBUS Course participants',
  },
  {
    title: 'Rapid Onsite Cytology',
    shortTitle: 'Cytology',
    href: '/rapid-onsite-cytology' as Route,
    description: 'ROSE and Diff-Quik slide interpretation trainer',
  },
  {
    title: 'Intro Bronchoscopy',
    href: '/intro-bronchoscopy' as Route,
    description: 'Foundational scope sizing, reach, and tool fit modules',
  },
  { title: 'IP Registry', href: '/ip-registry', description: 'Launch the Procedure Suite UI' },
  {
    title: 'Coming Soon',
    href: '/coming-soon',
    description: 'Upcoming pleural, bronchoscopy, and rigid bronchoscopy modules',
  },
]

const navigationItems = allNavigationItems.filter((item) => isVisibleModulePath(item.href))

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

function getUserDisplayName(user: User, profile: SiteProfileName | null) {
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
    'there'
  )
}

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [authStatus, setAuthStatus] = useState<NavAuthStatus>('checking')
  const [currentUser, setCurrentUser] = useState<NavUserSummary | null>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      const input = e.target as HTMLInputElement
      input.focus()
    }
  }

  const loadCurrentUser = useCallback(async (isActive: () => boolean) => {
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

      const { data: profileData } = await supabase
        .from('site_profiles')
        .select('first_name,last_name')
        .eq('id', user.id)
        .maybeSingle()

      if (!isActive()) {
        return
      }

      const profile = profileData as SiteProfileName | null

      setCurrentUser({
        displayName: getUserDisplayName(user, profile),
        email: user.email ?? null,
      })
      setAuthStatus('signed-in')
    } catch {
      if (!isActive()) {
        return
      }

      setCurrentUser(null)
      setAuthStatus('signed-out')
    }
  }, [])

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
    <div className="flex w-full min-w-0 items-center justify-between gap-3 lg:gap-4">
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            IP Lab
          </span>
          <span className="hidden text-sm font-medium text-muted-foreground xl:inline 2xl:hidden">
            Clinical Education
          </span>
        </Link>
      </div>
      <DesktopNav items={navigationItems} activePath={pathname} />
      <div className="hidden shrink-0 items-center gap-2 lg:flex">
        <form action="/search" className="hidden items-center gap-1 2xl:flex" role="search">
          <Input
            type="search"
            name="q"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search resources and guides"
            leadingIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
            className="w-64 text-sm"
            aria-label="Search resources and guides"
          />
          <Button type="submit" variant="ghost" size="icon" aria-label="Search resources">
            <MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
          </Button>
        </form>
        {currentUser ? (
          <div className="hidden min-w-0 items-center gap-2 xl:flex">
            <p className="max-w-44 truncate text-sm text-muted-foreground">
              Welcome,{' '}
              <span className="font-semibold text-foreground">{currentUser.displayName}</span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={authStatus === 'signing-out'}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {authStatus === 'signing-out' ? 'Logging out' : 'Log out'}
            </Button>
          </div>
        ) : authStatus === 'checking' ? null : (
          <Button asChild variant="outline" className="hidden xl:inline-flex">
            <Link href={'/login' as Route}>Sign in</Link>
          </Button>
        )}
        <ModeToggle
          size="sm"
          className="h-9 w-9 px-0 xl:w-auto xl:px-4 [&>span:last-child]:hidden xl:[&>span:last-child]:inline"
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
  )
}

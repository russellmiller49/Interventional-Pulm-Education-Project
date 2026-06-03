'use client'

import Link from 'next/link'
import type { Route } from 'next'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isVisibleModulePath } from '@/lib/draft-modules'

import { DesktopNav, type NavItem } from './DesktopNav'
import { MobileNav } from './MobileNav'
import { ModeToggle } from './mode-toggle'
import { SearchShortcut } from './SearchShortcut'

const SignInModal = dynamic(() => import('@/components/auth/SignInModal'), {
  ssr: false,
})

const allNavigationItems: NavItem[] = [
  {
    title: 'EBUS Training',
    shortTitle: 'EBUS',
    href: '/ebus-training' as Route,
    description: 'Public knobology, stations, and simulator modules',
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
    shortTitle: 'Bronch Nav',
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

export function Navigation() {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSignInOpen, setIsSignInOpen] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      const input = e.target as HTMLInputElement
      input.focus()
    }
  }

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
        <div className="hidden 2xl:flex items-center">
          <SearchShortcut className="text-xs" />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsSignInOpen(true)}
          className="hidden xl:inline-flex"
        >
          Sign in
        </Button>
        <ModeToggle
          size="sm"
          className="h-9 w-9 px-0 xl:w-auto xl:px-4 [&>span:last-child]:hidden xl:[&>span:last-child]:inline"
        />
      </div>
      <MobileNav
        items={navigationItems}
        activePath={pathname}
        onRequestSignIn={() => setIsSignInOpen(true)}
      />
      {isSignInOpen ? <SignInModal onClose={() => setIsSignInOpen(false)} /> : null}
    </div>
  )
}

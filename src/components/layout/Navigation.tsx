'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { GitHubLogoIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import SignInModal from '@/components/auth/SignInModal'

import { DesktopNav, type NavItem } from './DesktopNav'
import { MobileNav } from './MobileNav'
import { ModeToggle } from './mode-toggle'
import { SearchShortcut } from './SearchShortcut'

const navigationItems: NavItem[] = [
  { title: 'IP Board Prep', href: '/board-prep', description: 'Interactive board review chapters' },
  { title: '3D Anatomy', href: '/learn/anatomy', description: '3D & interactive anatomy viewer' },
  { title: 'FluoroView', href: '/fluoroview', description: 'C-arm airway simulation lab' },
  {
    title: 'Resources',
    href: '/resources/creative-commons',
    description: 'Creative Commons assets & study aids',
  },
  {
    title: 'Coming Soon',
    href: '/coming-soon',
    description: 'Tools, DIY Lab, training modules, and community features in progress',
  },
]

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSignInOpen, setIsSignInOpen] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/resources/creative-commons?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    <div className="flex w-full items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            IP Lab
          </span>
          <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
            Open Source Education
          </span>
        </Link>
      </div>
      <DesktopNav items={navigationItems} activePath={pathname} />
      <div className="hidden items-center gap-2 md:flex">
        <form onSubmit={handleSearch} className="hidden lg:block">
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search resources and guides"
            leadingIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
            className="w-64 text-sm"
            aria-label="Search resources and guides"
          />
        </form>
        <div className="hidden lg:flex items-center">
          <SearchShortcut className="text-xs" />
        </div>
        <Button
          asChild
          variant="ghost"
          className="hidden items-center gap-2 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none lg:inline-flex"
        >
          <a href="https://github.com/interventional-pulm" target="_blank" rel="noreferrer">
            <GitHubLogoIcon className="h-4 w-4" aria-hidden />
            <span>GitHub</span>
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsSignInOpen(true)}
          className="hidden lg:inline-flex"
        >
          Sign in
        </Button>
        <ModeToggle size="sm" />
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

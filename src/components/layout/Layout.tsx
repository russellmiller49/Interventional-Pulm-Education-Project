import type { ReactNode } from 'react'

import { Footer } from './Footer'
import { Navigation } from './Navigation'
import { SiteHeaderHeight } from './SiteHeaderHeight'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header
        id="site-header"
        className="site-header sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75"
      >
        <div className="container flex min-h-16 items-center justify-between gap-4 py-4 md:min-h-20">
          <Navigation />
        </div>
      </header>
      <SiteHeaderHeight headerId="site-header" />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}

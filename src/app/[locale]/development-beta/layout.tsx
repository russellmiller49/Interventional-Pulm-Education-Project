import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Development beta testing',
  robots: { index: false, follow: false, noarchive: true },
}
// The site's proxy requires the same verified, onboarded account used by the main site.
export default function BetaLayout({ children }: { children: ReactNode }) {
  return children
}

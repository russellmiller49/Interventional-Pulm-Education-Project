import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Development beta testing',
  robots: { index: false, follow: false, noarchive: true },
}
// Server mode requires a verified, onboarded account; owner-local serves only browser-local UI.
export default function BetaLayout({ children }: { children: ReactNode }) {
  return children
}

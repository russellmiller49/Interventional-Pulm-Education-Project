import type { Metadata } from 'next'
import type { ReactNode } from 'react'
export const metadata: Metadata = {
  title: 'EBUS: Guided Course',
  description: 'A self-paced guided linear EBUS course for early pulmonary fellows.',
  robots: { index: false, follow: false, noarchive: true },
}
export default function Layout({ children }: { children: ReactNode }) {
  return children
}

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
export const metadata: Metadata = {
  title: 'EUS-B: Guided Course',
  description:
    'A self-paced guided course on the EBUS scope in the esophagus, for pulmonologists who already perform linear EBUS.',
  robots: { index: false, follow: false, noarchive: true },
}
export default function Layout({ children }: { children: ReactNode }) {
  return children
}

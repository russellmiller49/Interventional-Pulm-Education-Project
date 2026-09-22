import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: 'SOCRATES training and study',
  robots: { index: false, follow: false, noarchive: true },
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

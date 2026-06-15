import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

export default function AirwayAnatomyDraftLayout({ children }: { children: ReactNode }) {
  notFound()
  return children
}

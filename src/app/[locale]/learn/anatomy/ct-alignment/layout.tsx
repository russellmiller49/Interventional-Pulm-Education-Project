import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

export default function CtAlignmentSandboxLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return children
}

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Bronchial Branch Tracing — CT to the Bronchoscopic View',
  description:
    'Unpublished educational course: match the CT to the bronchoscopic view, identify each opening and navigate to a lesion.',
  robots: { index: false, follow: false, noarchive: true },
}
export default function BranchTracingLayout({ children }: { children: ReactNode }) {
  return children
}

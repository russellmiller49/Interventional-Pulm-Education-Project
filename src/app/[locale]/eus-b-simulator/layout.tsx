import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'EUS-B Simulator',
  description:
    'A development-preview simulator of the esophageal approach with the EBUS endoscope: 3D anatomy, simulated ultrasound and CT correlation from one CT and its segmentation.',
  robots: { index: false, follow: false, noarchive: true },
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}

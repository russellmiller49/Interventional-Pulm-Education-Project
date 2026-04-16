'use client'

import dynamic from 'next/dynamic'

import type { XRViewerProps } from '@/components/XRViewer'

const XRViewer = dynamic(() => import('@/components/XRViewer'), { ssr: false })

export function XRViewerDynamic(props: XRViewerProps) {
  return <XRViewer {...props} />
}

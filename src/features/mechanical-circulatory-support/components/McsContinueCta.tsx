'use client'

import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { nextIncompleteMcsSectionLink, type McsContinueLink } from '../content/pathwayResolver'
import { readMcsProgress } from '../engine'
import styles from './mechanical-circulatory-support.module.css'

const FRESH: McsContinueLink = nextIncompleteMcsSectionLink({
  completedLessonIds: [],
  masteredCaseIds: [],
})

/**
 * The one Continue.
 *
 * A client island so a server-rendered hub or landing still resolves "continue" through the one
 * resolver. The server pass and the first client render are deliberately identical — a fresh
 * envelope, so section one — and the link changes only once stored progress has been read, which
 * keeps hydration honest.
 */
export function McsContinueCta({ className }: { readonly className?: string }) {
  const [link, setLink] = useState<McsContinueLink>(FRESH)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLink(nextIncompleteMcsSectionLink(readMcsProgress()))
      setResolved(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <Link
      href={link.href}
      className={className ?? styles.continueCta}
      data-mcs-continue={
        resolved ? (link.state === 'complete' ? 'complete' : 'resolved') : 'pending'
      }
      data-mcs-continue-section={link.section?.id ?? ''}
    >
      {link.label} <ArrowRight aria-hidden="true" />
    </Link>
  )
}

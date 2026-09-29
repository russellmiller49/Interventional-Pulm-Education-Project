'use client'

import { ArrowRight } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { curriculumSections } from '../../content/curriculum'
import { nextStep, sectionLinkTarget } from '../../content/pathwayResolver'
import { useThoracoscopyProgress } from '../useThoracoscopyProgress'
import styles from './medical-thoracoscopy-hub.module.css'

/**
 * The one door: the primary call to action on the hub and the Learn landing. It resolves through
 * `nextStep` and nothing else, and it only ever leads to a section a learner can open. While none
 * can be, it says so and offers no link.
 */
export function ContinueCta() {
  const { progress, hydrated } = useThoracoscopyProgress()
  const step = nextStep(progress)

  if (step.kind === 'none-open') {
    return (
      <p className={styles.status} role="status" data-continue="none-open">
        No section is open yet. Sections open here as they are written.
      </p>
    )
  }
  if (step.kind === 'all-reviewed') {
    return (
      <p className={styles.status} role="status" data-continue="all-reviewed">
        You have marked every open section reviewed. More open as they are written.
      </p>
    )
  }
  const verb = step.resumed ? 'Resume' : step.fresh ? 'Start' : 'Continue'
  return (
    <Link
      href={sectionLinkTarget(step.section.id)}
      className={styles.continue}
      data-continue={hydrated ? 'resolved' : 'pending'}
      data-next-section={step.section.id}
    >
      <span>
        {verb}: {step.section.title}
        <small>
          Section {step.section.number} of {curriculumSections.length} · about{' '}
          {step.section.minutes} min
        </small>
      </span>
      <ArrowRight aria-hidden="true" />
    </Link>
  )
}

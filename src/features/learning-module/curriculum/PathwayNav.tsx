'use client'

import { FastForward } from 'lucide-react'
import type { ReactNode } from 'react'

import type { LearningPathway } from './types'
import styles from './learning-pathway.module.css'

interface PathwayNavProps {
  readonly pathway: LearningPathway
  readonly activeSectionId: string
  readonly onSelect: (sectionId: string) => void
  /** Rail heading, e.g. "PAC learning pathway". Defaults to a neutral label. */
  readonly label?: string
}

/**
 * The persistent section rail, rendered inside every section rather than only above Learn.
 *
 * Every button stays enabled. The pathway orders the work and shows the learner where they are;
 * it never withholds a section, and no transition here is conditional on correctness.
 */
export function PathwayNav({
  pathway,
  activeSectionId,
  onSelect,
  label = 'Learning pathway',
}: PathwayNavProps) {
  const activeIndex = pathway.sections.findIndex((section) => section.id === activeSectionId)

  return (
    <nav className={styles.pathwayNav} aria-label={`${label} sections`}>
      <div className={styles.pathwayNavIntro}>
        <span>{label}</span>
        <strong>
          Section {activeIndex + 1} of {pathway.sections.length}
        </strong>
        <small>
          <FastForward className="size-3" aria-hidden="true" />
          Jump ahead or revisit any section
        </small>
      </div>
      <ol>
        {pathway.sections.map((section, index) => {
          const active = section.id === activeSectionId
          return (
            <li key={section.id}>
              <button
                type="button"
                aria-current={active ? 'step' : undefined}
                aria-label={`${index + 1}. ${section.title}${
                  section.stage === 'integration' ? ', integration capstone' : ''
                }`}
                onClick={() => {
                  if (!active) onSelect(section.id)
                }}
              >
                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span>
                  <strong>{section.shortTitle}</strong>
                  <small>
                    {section.stage === 'integration' ? 'Integration capstone' : section.title}
                  </small>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function PathwayViewport({
  children,
  ...navProps
}: PathwayNavProps & { readonly children: ReactNode }) {
  return (
    <div className={styles.pathwayViewport}>
      <PathwayNav {...navProps} />
      <div className={styles.pathwaySurface}>{children}</div>
    </div>
  )
}

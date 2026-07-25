'use client'

import { FastForward } from 'lucide-react'
import type { ReactNode } from 'react'

import { pacLearningPathwaySections, type PacLearningPathwaySectionId } from '../content'
import styles from './icu-hemodynamics.module.css'

interface PacLearningPathwayNavProps {
  readonly activeSectionId: PacLearningPathwaySectionId
  readonly onSelect: (sectionId: PacLearningPathwaySectionId) => void
}

export function PacLearningPathwayNav({ activeSectionId, onSelect }: PacLearningPathwayNavProps) {
  const activeIndex = pacLearningPathwaySections.findIndex(
    (section) => section.id === activeSectionId,
  )

  return (
    <nav className={styles.pacPathwayNav} aria-label="PAC learning pathway sections">
      <div className={styles.pacPathwayNavIntro}>
        <span>PAC learning pathway</span>
        <strong>
          Section {activeIndex + 1} of {pacLearningPathwaySections.length}
        </strong>
        <small>
          <FastForward className="size-3" aria-hidden="true" />
          Jump ahead or revisit any section
        </small>
      </div>
      <ol>
        {pacLearningPathwaySections.map((section, index) => {
          const active = section.id === activeSectionId
          return (
            <li key={section.id}>
              <button
                type="button"
                aria-current={active ? 'step' : undefined}
                aria-label={`${index + 1}. ${section.title}${section.kind === 'capstone' ? ', integration capstone' : ''}`}
                onClick={() => {
                  if (!active) onSelect(section.id)
                }}
              >
                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span>
                  <strong>{section.shortTitle}</strong>
                  <small>
                    {section.kind === 'capstone' ? 'Integration capstone' : section.title}
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

export function PacLearningPathwayViewport({
  activeSectionId,
  onSelect,
  children,
}: PacLearningPathwayNavProps & { readonly children: ReactNode }) {
  return (
    <div className={styles.pacPathwayViewport}>
      <PacLearningPathwayNav activeSectionId={activeSectionId} onSelect={onSelect} />
      <div className={styles.pacPathwaySurface}>{children}</div>
    </div>
  )
}

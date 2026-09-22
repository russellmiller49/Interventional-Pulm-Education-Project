'use client'

import { Link } from '@/i18n/navigation'

import { glossaryProvenanceLabel, termsForSection } from '../../content/glossary'
import {
  imagingLesson,
  peripheralImagingSectionIds,
  type ImagingSectionId,
} from '../../content/pathway'
import { imagingSectionLinkTarget } from '../../content/pathwayResolver'
import styles from './imaging-stage.module.css'

/**
 * The terms a section uses, defined where they are used (reports CW3, O2, 1.1/6.1, 1.8, 4.4, 4.6).
 *
 * Printed on the section's first step and again in Help, so a learner who deep-links into Section
 * 10 meets the definitions there and a learner on any later step can reach them without leaving the
 * step. Each definition says where its words come from, and links the section that teaches the term
 * in full when that is elsewhere. Nothing here gates anything.
 */
export function SectionGlossary({
  sectionId,
  variant,
}: {
  readonly sectionId: ImagingSectionId
  readonly variant: 'teaching' | 'help'
}) {
  const terms = termsForSection(sectionId)
  if (terms.length === 0) return null
  return (
    <details className={styles.glossary} data-section-glossary={variant}>
      <summary>Terms used in this section ({terms.length})</summary>
      <dl className={styles.glossaryList}>
        {terms.map((term) => {
          const elsewhere = term.taughtIn && term.taughtIn !== sectionId ? term.taughtIn : null
          return (
            <div key={term.id} data-glossary-term={term.id} data-glossary-status={term.status}>
              <dt>{term.term}</dt>
              <dd>
                {term.definition}{' '}
                <small className={styles.glossarySource}>
                  {glossaryProvenanceLabel(term)}
                  {elsewhere ? (
                    <>
                      {' '}
                      · taught in full in{' '}
                      <Link
                        href={imagingSectionLinkTarget(elsewhere)}
                        data-glossary-taught-in={elsewhere}
                      >
                        Section {peripheralImagingSectionIds.indexOf(elsewhere) + 1},{' '}
                        {imagingLesson(elsewhere).title}
                      </Link>
                    </>
                  ) : null}
                  .
                </small>
              </dd>
            </div>
          )
        })}
      </dl>
    </details>
  )
}

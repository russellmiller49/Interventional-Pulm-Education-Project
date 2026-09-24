'use client'

import { BookA } from 'lucide-react'
import { useId } from 'react'

import {
  CRRT_GLOSSARY_GROUPS,
  CRRT_GLOSSARY_STATUS,
  crrtGlossary,
  type CrrtGlossaryBasis,
  type CrrtGlossaryEntry,
} from '../content/glossary'
import { baxterCrrtLearnerFacingSourceById } from '../content/learnerSourceMap'
import { CrrtDialog } from './CrrtDialog'
import styles from './crrt-glossary.module.css'

function basisText(basis: CrrtGlossaryBasis): string {
  if (basis.kind === 'module-drawing') return basis.detail
  const titles = basis.sourceIds.map((id) => {
    const source = baxterCrrtLearnerFacingSourceById.get(id)
    return source ? `${source.sourceTitle}, ${source.pageOrSection} (${id})` : id
  })
  return `${basis.detail} ${titles.join('; ')}.`
}

function GlossaryEntry({ entry }: { entry: CrrtGlossaryEntry }) {
  return (
    <div className={styles.entry} id={`crrt-glossary-${entry.id}`} data-glossary-term={entry.id}>
      <dt>{entry.term}</dt>
      <dd>
        <p>{entry.definition}</p>
        {entry.alsoCalled.length > 0 ? (
          <p className={styles.aliases}>
            <strong>Also called:</strong> {entry.alsoCalled.join('; ')}
          </p>
        ) : null}
        {entry.notTheSameAs.length > 0 ? (
          <div className={styles.distinct}>
            <strong>Not the same as:</strong>
            <ul>
              {entry.notTheSameAs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {entry.openQuestion ? (
          <p className={styles.open} data-glossary-open-question>
            <strong>Not settled here:</strong> {entry.openQuestion}
          </p>
        ) : null}
        <details className={styles.basis}>
          <summary>Where this definition comes from</summary>
          <ul>
            {entry.basis.map((basis) => (
              <li key={`${basis.kind}:${basis.detail}`}>{basisText(basis)}</li>
            ))}
          </ul>
        </details>
      </dd>
    </div>
  )
}

/** The glossary body: grouped terms, each with its distinctions, open questions and basis. */
export function CrrtGlossaryContent() {
  const headingPrefix = useId()
  return (
    <div className={styles.glossary} data-crrt-glossary>
      <p className={styles.status}>{CRRT_GLOSSARY_STATUS}</p>
      {/* Buttons, not #hash links: a fragment navigation fires popstate, which the Learn page
          treats as a lesson change and would restart the lesson underneath the dialog. */}
      <nav aria-label="Glossary groups" className={styles.groups}>
        {CRRT_GLOSSARY_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => {
              const heading = document.getElementById(`${headingPrefix}-${group.id}`)
              heading?.scrollIntoView({ block: 'start', behavior: 'instant' })
              heading?.focus({ preventScroll: true })
            }}
          >
            {group.title}
          </button>
        ))}
      </nav>
      {CRRT_GLOSSARY_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`${headingPrefix}-${group.id}`}>
          <h3 id={`${headingPrefix}-${group.id}`} tabIndex={-1}>
            {group.title}
          </h3>
          <dl>
            {crrtGlossary
              .filter((entry) => entry.group === group.id)
              .map((entry) => (
                <GlossaryEntry key={entry.id} entry={entry} />
              ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

/**
 * The glossary, one button away wherever a CRRT learner reads (F-24): the hub, every Learn
 * lesson header, and the Practice / Challenge task panel. Opening it changes nothing in a
 * lesson or a run.
 */
export function CrrtGlossaryButton({ className }: { readonly className?: string }) {
  return (
    <CrrtDialog
      title="CRRT glossary"
      description="Plain definitions of the terms this module uses, what each is not the same as, and where each definition comes from. Opening it changes nothing in your lesson or run."
      trigger={
        <button type="button" className={className ?? styles.trigger} data-crrt-glossary-trigger>
          <BookA aria-hidden="true" /> Glossary
        </button>
      }
    >
      <CrrtGlossaryContent />
    </CrrtDialog>
  )
}

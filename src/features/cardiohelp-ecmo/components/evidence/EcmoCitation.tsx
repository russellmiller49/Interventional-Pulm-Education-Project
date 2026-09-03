'use client'

import { useEffect, useRef, useState } from 'react'

import type { EcmoResolvedCitation } from '../../content/evidenceResolver'
import styles from './evidence.module.css'

/**
 * One cited source, rendered the same way everywhere.
 *
 * The badge names the source class in words, the title is the record's resolved title, and each
 * "Supports" line states a claim this surface takes from the source — the caller's claim when it
 * gave one, otherwise what the record itself supports. The registry id is carried only by the
 * `data-evidence-id` attribute; nothing a learner reads contains it.
 *
 * Copying is feature-detected. The Clipboard API is absent in some embedded and older browsers and
 * its promise rejects when the page has not been granted the permission, so both paths reveal a
 * read-only field holding the same text, selected on focus, and say so in a status region rather
 * than failing silently.
 */

const COPIED_STATUS = 'Citation copied'
const COPY_FALLBACK_STATUS = 'Copy is not available here — select the text to copy it'

export interface EcmoCitationProps {
  readonly citation: EcmoResolvedCitation
  /** One "Supports" line and no limit line: the density for a card that is about something else. */
  readonly compact?: boolean
  /** Show the record's limitation even in compact mode. Full mode always shows it. */
  readonly showLimitations?: boolean
}

export function EcmoCitation({ citation, compact = false, showLimitations }: EcmoCitationProps) {
  const [status, setStatus] = useState('')
  const [fallbackVisible, setFallbackVisible] = useState(false)
  const fallbackRef = useRef<HTMLInputElement>(null)

  // The field appears in answer to a click on the copy control, so focus follows it there: the
  // text is selected on focus, and the learner's next keystroke is the copy they asked for.
  useEffect(() => {
    if (fallbackVisible) fallbackRef.current?.focus()
  }, [fallbackVisible])

  const supports = compact ? citation.supports.slice(0, 1) : citation.supports
  const limitVisible = (showLimitations ?? !compact) && citation.limitations.length > 0

  const revealFallback = () => {
    setFallbackVisible(true)
    setStatus(COPY_FALLBACK_STATUS)
  }

  const copy = async () => {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    if (!clipboard || typeof clipboard.writeText !== 'function') {
      revealFallback()
      return
    }
    try {
      await clipboard.writeText(citation.copyText)
      setStatus(COPIED_STATUS)
    } catch {
      revealFallback()
    }
  }

  return (
    <li
      className={compact ? `${styles.item} ${styles.compactItem}` : styles.item}
      data-evidence-id={citation.id}
      data-source-class={citation.sourceClass}
      data-citation-density={compact ? 'compact' : 'full'}
    >
      <span className={styles.badge} data-source-class={citation.sourceClass}>
        {citation.sourceClassLabel}
      </span>
      <cite className={styles.title} data-citation-title>
        {citation.title}
      </cite>
      <p className={styles.citation} data-citation-reference>
        {citation.citation}
        {citation.pages ? ` Pages ${citation.pages}.` : ''}
      </p>
      {supports.map((entry) => (
        <p key={entry} className={styles.supports} data-citation-supports>
          <span className={styles.key}>Supports: </span>
          {entry}
        </p>
      ))}
      {limitVisible ? (
        <p className={styles.limit} data-citation-limit>
          <span className={styles.key}>Limit: </span>
          {citation.limitations}
        </p>
      ) : null}
      <div className={styles.actions}>
        {citation.href ? (
          <a
            className={styles.link}
            href={citation.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open source: ${citation.title}`}
          >
            Open source
          </a>
        ) : null}
        <button
          type="button"
          className={styles.copy}
          aria-label={`Copy citation: ${citation.title}`}
          onClick={copy}
        >
          Copy citation
        </button>
        <span role="status" className={styles.status} data-citation-status>
          {status}
        </span>
      </div>
      {fallbackVisible ? (
        <input
          ref={fallbackRef}
          className={styles.fallback}
          type="text"
          readOnly
          value={citation.copyText}
          aria-label={`Citation text: ${citation.title}`}
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </li>
  )
}

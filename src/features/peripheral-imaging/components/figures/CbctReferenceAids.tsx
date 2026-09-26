'use client'

import {
  FIXED_MOBILE_COMPARISON,
  FIXED_MOBILE_LIMIT,
  FIXED_MOBILE_MODEL_NOTE,
  TEAM_READINESS_ABSENT,
  TEAM_READINESS_ROWS,
  TEAM_READINESS_STATUS,
  teamReadinessText,
} from '../../content/cbctReferences'
import { peripheralImagingSectionIds } from '../../content/pathway'
import { SOURCE_BY_ID } from '../../data/sources'
import type { SourceId } from '../../types'
import { CopyTextButton } from './CopyTextButton'
import styles from './figures.module.css'

function shortCitation(id: SourceId): string {
  const source = SOURCE_BY_ID.get(id)
  if (!source) return id
  const lead = source.authors.split(/[,;]/)[0].trim().split(/\s+/)[0]
  return `${lead} ${source.year}`
}

/**
 * The fixed-installation and mobile-scanner comparison for Sections 13 and 14 (OD4-09, brief B).
 * Workflow and capability in words, drawn from the course's own sections and the studies they
 * cite. It names no device, ranks nothing and prints no number; the course's 3D scenes no longer
 * draw the two fields differently, and the note under the table says so.
 */
export function FixedMobileComparison() {
  const sourceIds = [...new Set(FIXED_MOBILE_COMPARISON.flatMap((row) => row.sourceIds))]
  return (
    <section className={styles.figure} data-fixed-mobile-comparison>
      <p className={styles.kicker}>Fixed installation and mobile scanner · what differs</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Aspect</th>
            <th scope="col">Fixed installation</th>
            <th scope="col">Mobile scanner in an existing room</th>
          </tr>
        </thead>
        <tbody>
          {FIXED_MOBILE_COMPARISON.map((row) => (
            <tr key={row.id} data-comparison-row={row.id}>
              <th scope="row">{row.aspect}</th>
              {row.both ? (
                <td colSpan={2} data-label="Both" data-comparison-both>
                  {row.both}
                </td>
              ) : (
                <>
                  <td data-label="Fixed installation">{row.fixed}</td>
                  <td data-label="Mobile scanner">{row.mobile}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.note} data-model-note>
        {FIXED_MOBILE_MODEL_NOTE}
      </p>
      <p className={styles.note} data-comparison-limit>
        {FIXED_MOBILE_LIMIT} Drawn from this course’s Sections 12 to 14 and{' '}
        {sourceIds.map(shortCitation).join(', ')}.
      </p>
    </section>
  )
}

/**
 * The team-readiness teaching aid for Section 12 (OD4-10, brief C). A teaching reference only —
 * the status line says what it is not, first — with the source-backed rows and none of the two
 * organizational suggestions the owner removed. It copies with Section 18's pattern.
 */
export function TeamReadinessAid() {
  const roles = [...new Set(TEAM_READINESS_ROWS.map((row) => row.role))]
  return (
    <section className={`${styles.figure} ${styles.readiness}`} data-team-readiness>
      <p className={styles.kicker}>Before a CBCT spin, confirm · teaching aid</p>
      <p className={styles.modelLabel} data-readiness-status>
        {TEAM_READINESS_STATUS}
      </p>
      <ul className={styles.roleList}>
        {roles.map((role) => (
          <li key={role} data-readiness-role={role}>
            <h4>{role}</h4>
            <ul>
              {TEAM_READINESS_ROWS.filter((row) => row.role === role).map((row) => (
                <li key={row.id} data-readiness-row={row.id}>
                  {row.confirm}{' '}
                  <span className={styles.basis}>
                    {/* A no-break space keeps "Section" with its number on a narrow line. */}
                    Section{'\u00a0'}
                    {peripheralImagingSectionIds.indexOf(row.basis.sectionId) + 1}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className={styles.note}>{TEAM_READINESS_ABSENT}</p>
      <div className={styles.actions}>
        <CopyTextButton
          text={teamReadinessText()}
          label="Copy the aid"
          dataAttribute="data-copy-readiness-aid"
        />
      </div>
    </section>
  )
}

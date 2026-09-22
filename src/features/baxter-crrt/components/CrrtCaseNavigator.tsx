'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { formatCrrtCasePosition, selectCrrtCaseNavigation } from '../caseNavigation'
import {
  baxterCrrtCurriculum,
  baxterCrrtStationLabels,
  getBaxterCrrtCaseCatalogEntry,
  type CrrtCurriculumStationNumber,
} from '../content/curriculum'
import type { CrrtCaseId } from '../content/schema'
import styles from './crrt-case-navigator.module.css'

/**
 * The visible Cases control (F-09).
 *
 * Before this, the only case picker and the additional-case list sat inside the collapsed
 * "Current task" drawer. Every control here routes through the caller's `onChoose`, which is
 * Practice's canonical `chooseCase` — the one path that moves the address bar — so there is no
 * second store of which case is open. The position line is navigation only: it says where a case
 * sits in an authored list, never how far a learner has got.
 */
export function CrrtCaseNavigator({
  caseId,
  visitedCaseIds,
  onChoose,
  notice,
  recommendation,
}: {
  readonly caseId: CrrtCaseId
  readonly visitedCaseIds: readonly string[]
  readonly onChoose: (caseId: CrrtCaseId) => void
  readonly notice?: ReactNode
  readonly recommendation?: ReactNode
}) {
  const position = selectCrrtCaseNavigation(caseId)
  const entry = getBaxterCrrtCaseCatalogEntry(caseId)
  const groupWord = position.group === 'core' ? 'core' : 'additional'
  const visited = new Set(visitedCaseIds)
  const optionLabel = (id: CrrtCaseId) => {
    const place = selectCrrtCaseNavigation(id)
    const prefix =
      place.group === 'core' ? `Case ${place.position}` : `Additional ${place.position}`
    return `${prefix} · ${getBaxterCrrtCaseCatalogEntry(id).title}${
      visited.has(id) ? ' · visited' : ''
    }`
  }
  const stepButton = (direction: 'previous' | 'next') => {
    const target = direction === 'previous' ? position.previousCaseId : position.nextCaseId
    if (!target) {
      // A truthful reason in place of an unexplained disabled button.
      return (
        <span className={styles.stepEnd} data-direction={direction}>
          {direction === 'previous'
            ? `First ${groupWord} case`
            : position.group === 'core'
              ? 'Last core case · more in Cases'
              : 'Last additional case'}
        </span>
      )
    }
    const title = getBaxterCrrtCaseCatalogEntry(target).title
    return (
      <button
        type="button"
        className={styles.stepButton}
        data-direction={direction}
        aria-label={`${direction === 'previous' ? 'Previous case' : 'Next case'}: ${title}`}
        onClick={() => onChoose(target)}
      >
        {direction === 'previous' ? <ChevronLeft aria-hidden="true" /> : null}
        <span>{direction === 'previous' ? 'Previous case' : 'Next case'}</span>
        {direction === 'next' ? <ChevronRight aria-hidden="true" /> : null}
      </button>
    )
  }

  return (
    <nav className={styles.navigator} aria-label="Practice cases" data-crrt-case-navigation>
      {notice}
      <p className={styles.position} data-crrt-case-position>
        <strong>{formatCrrtCasePosition(position)}</strong>
        <span>
          Station {entry.station} · {baxterCrrtStationLabels[entry.station]}. Any order; this is a
          place in the list, not a score or a requirement.
        </span>
      </p>
      <div className={styles.controls}>
        {stepButton('previous')}
        <label className={styles.picker}>
          <span>Cases</span>
          <select value={caseId} onChange={(event) => onChoose(event.target.value as CrrtCaseId)}>
            {baxterCrrtCurriculum.map((unit) => (
              <optgroup
                key={unit.id}
                label={`Station ${unit.station} · ${stationLabel(unit.station)}`}
              >
                {unit.coreCaseIds.map((id) => (
                  <option key={id} value={id}>
                    {optionLabel(id)}
                  </option>
                ))}
              </optgroup>
            ))}
            <optgroup label="Additional cases · optional">
              {baxterCrrtCurriculum.flatMap((unit) =>
                unit.additionalCaseIds.map((id) => (
                  <option key={id} value={id}>
                    {optionLabel(id)}
                  </option>
                )),
              )}
            </optgroup>
          </select>
        </label>
        {stepButton('next')}
      </div>
      {recommendation ? <div className={styles.recommendation}>{recommendation}</div> : null}
    </nav>
  )
}

function stationLabel(station: CrrtCurriculumStationNumber): string {
  return baxterCrrtStationLabels[station]
}

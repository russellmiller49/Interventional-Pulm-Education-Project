'use client'

import { useEffect, useState } from 'react'

import { Link } from '@/i18n/navigation'

import { dolphinMicroCaseById, nextMicroCase } from '../../content/microCases'
import {
  DOLPHIN_PRACTICE_HREF,
  dolphinPracticeCaseLinkTarget,
  dolphinSectionLinkTarget,
} from '../../content/routes'
import { DOLPHIN_SECTION_META } from '../../content/sectionCatalog'
import { toDolphinClinicalItem } from '../../content/stageItems'
import { troubleRowById } from '../../content/troubleGrammar'
import { recordDolphinLocation } from '../../engine/selfPacedProgress'
import { DolphinItemCheck } from '../stage/DolphinItemCheck'
import styles from '../stage/dolphin-stage.module.css'

/**
 * One practice case: the situation, one decision, the verdict and explanation, and — where the
 * case turns on a complication — the trouble-grammar row. Opening it is the only thing recorded.
 */
export function DolphinCaseActivity({ caseId }: { readonly caseId: string }) {
  const microCase = dolphinMicroCaseById.get(caseId)
  const [committed, setCommitted] = useState<string | undefined>(undefined)
  useEffect(() => {
    recordDolphinLocation({ kind: 'practice-case', id: caseId })
  }, [caseId])
  if (!microCase) return null
  const item = toDolphinClinicalItem(microCase.sectionId, microCase.item, 'predict')
  const row = microCase.troubleRowId ? troubleRowById.get(microCase.troubleRowId) : undefined
  const next = nextMicroCase(caseId)
  return (
    <article className={styles.steps} data-practice-case={caseId}>
      <p className={styles.kicker}>Practice case</p>
      <h1 className="text-2xl font-bold">{microCase.presentationTitle}</h1>
      <DolphinItemCheck
        item={item}
        situation={microCase.situation}
        frameId={microCase.media?.frameId ?? microCase.item.media?.frameId}
        committed={committed}
        onCommit={setCommitted}
        label="Decision"
      />
      {committed && row ? (
        <section className={styles.block} data-role="first-moves" data-trouble-row={row.id}>
          <h2 className="text-base font-semibold">{row.change}</h2>
          <p>Earliest sign: {row.earliestSign}.</p>
          <ol>
            {row.firstMoves.map((move) => (
              <li key={move}>{move}</li>
            ))}
          </ol>
        </section>
      ) : null}
      <div className={styles.actions}>
        <Link className={styles.button} href={dolphinSectionLinkTarget(microCase.sectionId)}>
          Back to the section: {DOLPHIN_SECTION_META[microCase.sectionId].title}
        </Link>
        {next ? (
          <Link
            className={styles.button}
            data-primary="true"
            href={dolphinPracticeCaseLinkTarget(next.id)}
          >
            Next case
          </Link>
        ) : (
          <Link className={styles.button} data-primary="true" href={DOLPHIN_PRACTICE_HREF}>
            All practice
          </Link>
        )}
      </div>
    </article>
  )
}

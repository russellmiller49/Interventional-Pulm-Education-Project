'use client'

import { useEffect } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { imagingMicroCaseById, imagingMicroCasesInPathwayOrder } from '../content/microCases'
import { imagingCaseLinkTarget, PERIPHERAL_IMAGING_PRACTICE_HREF } from '../content/routes'
import { recordImagingLocation } from '../engine/selfPacedProgress'
import { ImagingCaseDecision } from './ImagingCaseDecision'
import { SignalImage } from './stage/TeachingPanels'
import styles from './stage/imaging-stage.module.css'

/**
 * One practice case: the situation, one decision and the reasoning, at the learner's pace.
 *
 * The explanation opens with or without an answer, an answer can be checked as often as the learner
 * likes, the section that teaches the mechanism is linked from the start, and the next case is
 * always one link away. The only thing written is that the case was opened (PI-01): no decision,
 * correctness or use of the explanation is stored.
 */
export function ImagingCaseActivity({ caseId }: { readonly caseId: string }) {
  const microCase = imagingMicroCaseById.get(caseId)

  useEffect(() => {
    if (microCase) recordImagingLocation({ kind: 'practice-case', id: microCase.id })
  }, [microCase])

  if (!microCase) {
    return (
      <p role="status" data-unknown-case={caseId}>
        That case is not in this module. Every case is listed on the Practice page.
      </p>
    )
  }

  const order = imagingMicroCasesInPathwayOrder()
  const position = order.findIndex((entry) => entry.id === microCase.id)
  const previous = position > 0 ? order[position - 1] : null
  const next = position >= 0 && position < order.length - 1 ? order[position + 1] : null

  return (
    <article className="grid gap-5" data-practice-case={microCase.id}>
      <div className="grid gap-1">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Practice · case {position + 1} of {order.length}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{microCase.presentationTitle}</h1>
      </div>

      <section className={styles.teachingCard} data-case-situation>
        <p className={styles.kicker}>The situation</p>
        <p>{microCase.situation}</p>
      </section>

      {(caseId === 'signal-practice-1' ||
        caseId === 'signal-practice-2' ||
        caseId === 'field-practice-1') && (
        <section className={styles.teachingCard} data-case-image>
          <SignalImage
            factor="contrast"
            label="Conceptual illustration of the described appearance"
          />
          <p>
            Draft synthetic teaching illustration, not a device capture or a calibrated scatter
            model. Use the clinical context supplied with the image; appearance alone does not
            identify its cause.
          </p>
        </section>
      )}

      <ImagingCaseDecision
        item={microCase.item}
        choiceGroup={`practice-${microCase.id}`}
        conceptSectionId={microCase.sectionId}
      />

      <nav className="flex flex-wrap items-center gap-4 text-sm" aria-label="Practice cases">
        {previous ? (
          <Link
            className="inline-flex items-center gap-1 font-semibold text-primary"
            href={imagingCaseLinkTarget(previous.id)}
          >
            <ArrowLeft aria-hidden="true" /> {previous.presentationTitle}
          </Link>
        ) : null}
        <Link className="font-semibold text-primary" href={PERIPHERAL_IMAGING_PRACTICE_HREF}>
          All cases
        </Link>
        {next ? (
          <Link
            className="inline-flex items-center gap-1 font-semibold text-primary"
            href={imagingCaseLinkTarget(next.id)}
            data-next-case={next.id}
          >
            Next case: {next.presentationTitle} <ArrowRight aria-hidden="true" />
          </Link>
        ) : (
          <Link
            className="inline-flex items-center gap-1 font-semibold text-primary"
            href={PERIPHERAL_IMAGING_PRACTICE_HREF}
            data-back-to-list
          >
            Back to the case list <ArrowRight aria-hidden="true" />
          </Link>
        )}
      </nav>
    </article>
  )
}

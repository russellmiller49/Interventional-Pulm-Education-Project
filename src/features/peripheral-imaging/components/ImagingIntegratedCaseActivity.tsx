'use client'

import { useEffect } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { imagingCaseById, imagingCases } from '../content/cases'
import {
  integratedCaseLinkTarget,
  PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF,
} from '../content/routes'
import { recordImagingLocation } from '../engine/selfPacedProgress'
import { ImagingCaseDecision } from './ImagingCaseDecision'

/**
 * One integrated case, open at any time.
 *
 * These were the capstone's eight decisions, made once after every section and held to a standard.
 * Now each is a worked application: the situation, the choices, the explanation on request, a check
 * that can be repeated, and a link to the section it draws on. A case the item bank marks as a
 * safety decision says so. Nothing is written except that the case was opened (PI-01).
 */
export function ImagingIntegratedCaseActivity({ caseId }: { readonly caseId: string }) {
  const imagingCase = imagingCaseById.get(caseId)

  useEffect(() => {
    if (imagingCase) recordImagingLocation({ kind: 'integrated-case', id: imagingCase.id })
  }, [imagingCase])

  if (!imagingCase) {
    return (
      <p role="status" data-unknown-case={caseId}>
        That case is not in this module. Every integrated case is listed on the Integrated cases
        page.
      </p>
    )
  }

  const position = imagingCases.findIndex((entry) => entry.id === imagingCase.id)
  const previous = position > 0 ? imagingCases[position - 1] : null
  const next = position < imagingCases.length - 1 ? imagingCases[position + 1] : null

  return (
    <article
      className="grid gap-5"
      data-integrated-case={imagingCase.id}
      data-safety-decision={imagingCase.critical}
    >
      <div className="grid gap-1">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Integrated case {position + 1} of {imagingCases.length}
          {imagingCase.critical ? ' · safety decision' : ''}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{imagingCase.presentationTitle}</h1>
      </div>

      <ImagingCaseDecision
        item={imagingCase.item}
        choiceGroup={`integrated-${imagingCase.id}`}
        conceptSectionId={imagingCase.pairedSectionId}
      />

      <nav className="flex flex-wrap items-center gap-4 text-sm" aria-label="Integrated cases">
        {previous ? (
          <Link
            className="inline-flex items-center gap-1 font-semibold text-primary"
            href={integratedCaseLinkTarget(previous.id)}
          >
            <ArrowLeft aria-hidden="true" /> {previous.presentationTitle}
          </Link>
        ) : null}
        <Link
          className="font-semibold text-primary"
          href={PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF}
        >
          All integrated cases
        </Link>
        {next ? (
          <Link
            className="inline-flex items-center gap-1 font-semibold text-primary"
            href={integratedCaseLinkTarget(next.id)}
            data-next-case={next.id}
          >
            Next case: {next.presentationTitle} <ArrowRight aria-hidden="true" />
          </Link>
        ) : (
          <Link
            className="inline-flex items-center gap-1 font-semibold text-primary"
            href={PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF}
            data-back-to-list
          >
            Back to the case list <ArrowRight aria-hidden="true" />
          </Link>
        )}
      </nav>
    </article>
  )
}

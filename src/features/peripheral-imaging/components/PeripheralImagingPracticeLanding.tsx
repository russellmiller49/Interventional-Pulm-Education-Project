'use client'

import { ArrowRight, Check } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { imagingCases } from '../content/cases'
import {
  imagingMicroCasesInPathwayOrder,
  microCasesForSection,
  practiceItemId,
} from '../content/microCases'
import { imagingLesson, peripheralImagingSectionIds } from '../content/pathway'
import { imagingSectionLinkTarget } from '../content/pathwayResolver'
import { imagingCaseLinkTarget, PERIPHERAL_IMAGING_ASSESS_HREF } from '../content/routes'
import { ImagingContinueCta } from './hub/ImagingPathwayAccordion'
import { usePeripheralImagingRecord } from './usePeripheralImagingRecord'

/**
 * The Practice landing: every short case, in the order the course teaches its mechanisms.
 *
 * One door here too — the first case with no decision on it yet. A case already decided still
 * opens, because answering again is the point of this layer; the list says which ones have a
 * first decision on the record rather than marking anything complete.
 */
export function PeripheralImagingPracticeLanding() {
  const { record, hydrated } = usePeripheralImagingRecord()
  const cases = imagingMicroCasesInPathwayOrder()
  const decided = new Set(
    cases
      .filter((entry) => record.firstAttempts[practiceItemId(entry.id)])
      .map((entry) => entry.id),
  )
  const next = cases.find((entry) => !decided.has(entry.id)) ?? null
  const sections = peripheralImagingSectionIds.filter(
    (sectionId) => microCasesForSection(sectionId).length > 0,
  )

  if (cases.length === 0) {
    return (
      <div
        className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:px-8"
        data-practice-landing
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Practice</p>
        <h1 className="text-3xl font-bold tracking-tight">Short cases, one decision each</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Practice cases are being authored and reviewed. Until they land, each section carries its
          own retrieval item, and the {imagingCases.length} capstone decisions wait on the Assess
          page once every section has been worked through.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ImagingContinueCta />
        </div>
      </div>
    )
  }

  return (
    <div
      className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 lg:px-8"
      data-practice-landing
    >
      <div className="grid gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Practice</p>
        <h1 className="text-3xl font-bold tracking-tight">Short cases, one decision each</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          A situation from the room, one decision, and the reasoning behind it. Each case is paired
          to the section whose mechanism it uses. Answer a case as often as you like — only the
          first decision goes on your record, and it is kept as you made it.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {next ? (
            <Link
              className="inline-flex min-h-11 items-center gap-3 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
              href={imagingCaseLinkTarget(next.id)}
              data-practice-continue={hydrated ? 'resolved' : 'pending'}
              data-next-case={next.id}
            >
              <span>
                {decided.size === 0 ? 'Start' : 'Continue'} — {next.presentationTitle}
                <small className="block font-medium opacity-85">
                  Case {cases.indexOf(next) + 1} of {cases.length}
                </small>
              </span>
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            <Link
              className="inline-flex min-h-11 items-center gap-3 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
              href={PERIPHERAL_IMAGING_ASSESS_HREF}
              data-practice-continue="complete"
            >
              <span>Every case decided once — open the capstone</span>
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      <ol className="grid gap-6" data-practice-list>
        {sections.map((sectionId) => {
          const lesson = imagingLesson(sectionId)
          return (
            <li key={sectionId} className="grid gap-2" data-practice-section={sectionId}>
              <h2 className="text-sm font-bold">
                <Link className="text-primary" href={imagingSectionLinkTarget(sectionId)}>
                  {lesson.title}
                </Link>
              </h2>
              <ul className="grid gap-2">
                {microCasesForSection(sectionId).map((microCase) => {
                  const answered = decided.has(microCase.id)
                  return (
                    <li key={microCase.id}>
                      <Link
                        className="flex min-h-11 items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
                        href={imagingCaseLinkTarget(microCase.id)}
                        data-practice-case-link={microCase.id}
                        data-decided={answered}
                      >
                        <span className="font-semibold">{microCase.presentationTitle}</span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          {answered ? (
                            <>
                              <Check aria-hidden="true" className="size-4" /> first decision on your
                              record
                            </>
                          ) : (
                            <ArrowRight aria-hidden="true" className="size-4" />
                          )}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ol>

      <p className="text-sm text-muted-foreground">
        The {imagingCases.length} capstone decisions are a separate sitting on the{' '}
        <Link className="font-semibold text-primary" href={PERIPHERAL_IMAGING_ASSESS_HREF}>
          Assess page
        </Link>
        , made once, after every section has been worked through.
      </p>
    </div>
  )
}

'use client'

import { ArrowRight, Check } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { imagingCases } from '../content/cases'
import { imagingMicroCasesInPathwayOrder, microCasesForSection } from '../content/microCases'
import { imagingLesson, peripheralImagingSectionIds } from '../content/pathway'
import { imagingSectionLinkTarget } from '../content/pathwayResolver'
import { imagingCaseLinkTarget, PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF } from '../content/routes'
import { ImagingContinueCta } from './hub/ImagingPathwayAccordion'
import { useImagingProgress } from './useImagingProgress'

/**
 * The Practice landing: every short case, in the order the course teaches its mechanisms.
 *
 * One door here too — the first case not yet opened on this device. Every case is open, in any
 * order, as often as the learner likes; the list says which cases have been opened, never which
 * were answered or how (PI-01).
 */
export function PeripheralImagingPracticeLanding() {
  const { progress, hydrated } = useImagingProgress()
  const cases = imagingMicroCasesInPathwayOrder()
  const opened = new Set(progress.openedPracticeCaseIds)
  const openedCount = cases.filter((entry) => opened.has(entry.id)).length
  const next = cases.find((entry) => !opened.has(entry.id)) ?? null
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
          own interpretation check, and the {imagingCases.length} integrated cases are open on their
          own page.
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
          A procedural situation, one decision, and the reasoning behind it. Each case is paired to
          the section whose principle it uses. Check an answer, show the explanation first, try
          again or move on — answers are not saved.
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
                {openedCount === 0 ? 'Start' : 'Continue'} — {next.presentationTitle}
                <small className="block font-medium opacity-85">
                  Case {cases.indexOf(next) + 1} of {cases.length}
                </small>
              </span>
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            <Link
              className="inline-flex min-h-11 items-center gap-3 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
              href={PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF}
              data-practice-continue="complete"
            >
              <span>Every case opened — try the integrated cases</span>
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
                  const isOpened = opened.has(microCase.id)
                  return (
                    <li key={microCase.id}>
                      <Link
                        className="flex min-h-11 items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
                        href={imagingCaseLinkTarget(microCase.id)}
                        data-practice-case-link={microCase.id}
                        data-opened={isOpened}
                      >
                        <span className="font-semibold">{microCase.presentationTitle}</span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          {isOpened ? (
                            <>
                              <Check aria-hidden="true" className="size-4" /> opened
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
        The {imagingCases.length} integrated cases combine several sections and are open at any time
        on the{' '}
        <Link
          className="font-semibold text-primary"
          href={PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF}
        >
          Integrated cases page
        </Link>
        .
      </p>
    </div>
  )
}

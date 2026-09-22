'use client'

import { ArrowRight, Check } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { imagingCases } from '../content/cases'
import { imagingLesson } from '../content/pathway'
import { integratedCaseLinkTarget, PERIPHERAL_IMAGING_PRACTICE_HREF } from '../content/routes'
import { useImagingProgress } from './useImagingProgress'

/**
 * The integrated cases, on the address the Assess tab used.
 *
 * The capstone that lived here opened only after every section and held its eight decisions to a
 * standard. Every case is now open, in any order, before or after the sections it draws on (PI-01).
 * One door suggests the first case not yet opened; the list says which cases have been opened on
 * this device and never anything about answers.
 */
export function PeripheralImagingIntegratedCasesLanding({
  unknownCase,
}: {
  readonly unknownCase?: string
}) {
  const { progress, hydrated } = useImagingProgress()
  const opened = new Set(progress.openedIntegratedCaseIds)
  const openedCount = imagingCases.filter((imagingCase) => opened.has(imagingCase.id)).length
  const next = imagingCases.find((imagingCase) => !opened.has(imagingCase.id)) ?? null

  return (
    <div
      className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:px-8"
      data-integrated-cases-landing
    >
      {unknownCase ? (
        <p className="rounded-2xl border p-4 text-sm" role="status" data-unknown-case={unknownCase}>
          That case is not in this module. Every integrated case is listed below.
        </p>
      ) : null}
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Integrated cases</p>
      <h1 className="text-3xl font-bold tracking-tight">
        Integrated peripheral bronchoscopy cases
      </h1>
      <p className="max-w-2xl text-base leading-7 text-muted-foreground">
        {imagingCases.length} situations in the bronchoscopy suite that bring several sections
        together. Open them in any order, before or after the sections they draw on. Each case can
        show its explanation before you answer, lets you check an answer as often as you like, and
        links to the section that teaches its mechanism. Answers are not saved.
      </p>
      {/* Report IC4: the tag is a teaching emphasis, and says so. */}
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground" data-safety-tag-note>
        <strong>Safety decision</strong> marks a case in which an alternative could harm a patient;
        its feedback names an unsafe choice at once. It is a teaching emphasis only: no case carries
        more weight than another, nothing about your answers is recorded, and no case is restricted.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {next ? (
          <Link
            className="inline-flex min-h-11 items-center gap-3 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
            href={integratedCaseLinkTarget(next.id)}
            data-integrated-continue={hydrated ? 'resolved' : 'pending'}
            data-next-case={next.id}
          >
            <span>
              {openedCount === 0 ? 'Start' : 'Continue'} — {next.presentationTitle}
              <small className="block font-medium opacity-85">
                Case {imagingCases.indexOf(next) + 1} of {imagingCases.length}
              </small>
            </span>
            <ArrowRight aria-hidden="true" />
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground" data-integrated-continue="complete">
            Every case has been opened on this device. Choose any case to work through it again.
          </p>
        )}
      </div>

      <ol className="grid gap-3" data-integrated-case-list>
        {imagingCases.map((imagingCase) => {
          const isOpened = opened.has(imagingCase.id)
          return (
            <li key={imagingCase.id}>
              <Link
                className="flex min-h-11 flex-col gap-1 rounded-xl border bg-card px-4 py-3 text-sm"
                href={integratedCaseLinkTarget(imagingCase.id)}
                data-integrated-case-link={imagingCase.id}
                data-opened={isOpened}
              >
                <span className="font-semibold">{imagingCase.presentationTitle}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {imagingCase.critical ? <span>Safety decision ·</span> : null}
                  <span>Draws on {imagingLesson(imagingCase.pairedSectionId).title}</span>
                  {isOpened ? (
                    <span className="inline-flex items-center gap-1">
                      · <Check aria-hidden="true" className="size-4" /> opened
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>

      <p className="text-sm text-muted-foreground">
        The{' '}
        <Link className="font-semibold text-primary" href={PERIPHERAL_IMAGING_PRACTICE_HREF}>
          practice cases
        </Link>{' '}
        take one mechanism at a time.
      </p>
    </div>
  )
}

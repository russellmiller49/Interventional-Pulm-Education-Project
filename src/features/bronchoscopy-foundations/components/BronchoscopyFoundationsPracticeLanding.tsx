'use client'

import { ArrowRight } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { bronchMicroCasesInPathwayOrder, microCasesForSection } from '../content/microCases'
import { BRONCH_SECTION_IDS, bronchSection } from '../content/pathway'
import { bronchSectionLinkTarget } from '../content/pathwayResolver'
import { BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF, bronchCaseLinkTarget } from '../content/routes'
import { capstoneStageItems } from '../content/stageItems'
import { BronchContinueCta } from './hub/BronchPathwayAccordion'

/**
 * The Practice landing: every short case, in the order the course teaches its ideas.
 *
 * Self-paced contract (BF-01): every case opens at any time, in any order, as often as useful. The
 * list marks nothing as decided or complete, because the course keeps no answers.
 */
export function BronchoscopyFoundationsPracticeLanding() {
  const cases = bronchMicroCasesInPathwayOrder()
  const first = cases[0] ?? null
  const sections = BRONCH_SECTION_IDS.filter(
    (sectionId) => microCasesForSection(sectionId).length > 0,
  )
  const integratedCount = capstoneStageItems.length

  if (!first) {
    return (
      <div
        className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:px-8"
        data-practice-landing
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Practice</p>
        <h1 className="text-3xl font-bold tracking-tight">Short cases, one decision each</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Practice cases are being authored and reviewed. Until they land, each section carries its
          own optional questions, and the {integratedCount} integrated cases are open on the
          Integrated cases page.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <BronchContinueCta />
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
          the section whose idea it uses. Answer a case, open its explanation first, try again, or
          move on; nothing is scored or saved.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex min-h-11 items-center gap-3 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
            href={bronchCaseLinkTarget(first.id)}
            data-practice-continue="first"
            data-next-case={first.id}
          >
            <span>
              Start with the first case — {first.presentationTitle}
              <small className="block font-medium opacity-85">Case 1 of {cases.length}</small>
            </span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>

      <ol className="grid gap-6" data-practice-list>
        {sections.map((sectionId) => {
          const section = bronchSection(sectionId)
          return (
            <li key={sectionId} className="grid gap-2" data-practice-section={sectionId}>
              <h2 className="text-sm font-bold">
                <Link className="text-primary" href={bronchSectionLinkTarget(sectionId)}>
                  {section.title}
                </Link>
              </h2>
              <ul className="grid gap-2">
                {microCasesForSection(sectionId).map((microCase) => (
                  <li key={microCase.id}>
                    <Link
                      className="flex min-h-11 items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
                      href={bronchCaseLinkTarget(microCase.id)}
                      data-practice-case-link={microCase.id}
                    >
                      <span className="font-semibold">{microCase.presentationTitle}</span>
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ol>

      <p className="text-sm text-muted-foreground">
        The {integratedCount}{' '}
        <Link className="font-semibold text-primary" href={BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF}>
          integrated cases
        </Link>{' '}
        bring several sections together in one situation.
      </p>
    </div>
  )
}

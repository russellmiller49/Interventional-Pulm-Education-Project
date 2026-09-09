'use client'

import { Link } from '@/i18n/navigation'

import { imagingCases } from '../content/cases'
import { PERIPHERAL_IMAGING_ASSESS_HREF } from '../content/routes'
import { ImagingContinueCta } from './hub/ImagingPathwayAccordion'

/**
 * The Practice landing. Short cases paired to each section's mechanism are a later round; until
 * they land this page says so plainly, sends the learner back through the one door, and names
 * the capstone as the place the eight case decisions live.
 */
export function PeripheralImagingPracticeLanding() {
  return (
    <div
      className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-10 sm:px-6 lg:px-8"
      data-practice-landing
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Practice</p>
      <h1 className="text-3xl font-bold tracking-tight">Short cases, one decision each</h1>
      <p className="max-w-2xl text-base leading-7 text-muted-foreground">
        Practice cases — two-minute situations paired to each section by the mechanism they use —
        are being authored and reviewed. Until they land, the sections carry their own retrieval
        item, and the {imagingCases.length} capstone decisions wait on the Assess page once every
        section has been worked through.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <ImagingContinueCta />
        <Link
          href={PERIPHERAL_IMAGING_ASSESS_HREF}
          className="inline-flex min-h-11 items-center rounded-xl border px-5 py-3 text-sm font-semibold"
        >
          The capstone
        </Link>
      </div>
    </div>
  )
}

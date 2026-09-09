'use client'

import { ImagingCapstone } from './ImagingCapstone'

/** The Assess landing: the capstone, gated on Learn completion. */
export function PeripheralImagingAssessLanding() {
  return (
    <div
      className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-10 sm:px-6 lg:px-8"
      data-assess-landing
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Assess</p>
      <h1 className="text-3xl font-bold tracking-tight">Decisions in the bronch suite</h1>
      <ImagingCapstone />
    </div>
  )
}

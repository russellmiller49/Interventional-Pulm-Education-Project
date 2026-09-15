'use client'

import { capstoneStageItems } from '../content/stageItems'
import { BronchIntegratedCases } from './BronchIntegratedCases'

/**
 * The integrated cases, at the address the capstone used (`/assess`). Self-paced contract (BF-01):
 * open without working through the sections, nothing scored, nothing saved.
 */
export function BronchoscopyFoundationsAssessLanding() {
  return (
    <div
      className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:px-8"
      data-assess-landing
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Integrated cases</p>
      <h1 className="text-3xl font-bold tracking-tight">Cases that bring the sections together</h1>
      <p className="max-w-2xl text-base leading-7 text-muted-foreground">
        Each of these {capstoneStageItems.length} situations draws on several sections. Choose an
        answer and check it, open the explanation first, try again, or move to another case. Each
        case links to the section it draws on. Nothing is scored and no answer is saved.
      </p>
      <BronchIntegratedCases />
    </div>
  )
}

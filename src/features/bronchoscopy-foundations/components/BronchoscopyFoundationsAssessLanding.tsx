'use client'

import { BronchCapstone } from './BronchCapstone'

/** The Assess landing: the capstone, gated on Learn completion. */
export function BronchoscopyFoundationsAssessLanding() {
  return (
    <div
      className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:px-8"
      data-assess-landing
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Assess</p>
      <h1 className="text-3xl font-bold tracking-tight">Eight decisions, made once</h1>
      <BronchCapstone />
    </div>
  )
}

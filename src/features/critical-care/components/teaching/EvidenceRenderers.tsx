import type { ReactNode } from 'react'

import {
  criticalCareLiveValueTypeLabels,
  criticalCareReferenceKindLabels,
  resolveInterpretation,
  type CriticalCareDerivedValueGuide,
  type CriticalCareValueReference,
} from '../../content/derivedValueGuides'
import type { CriticalCareMeasurementClarification } from '../../content/measurementClarifications'
import type { CriticalCareSourceConflict } from '../../content/sourceConflicts'

/**
 * The three ways this resource shows a number's provenance.
 *
 * They are deliberately different components because they make different claims. A derived value
 * carries an interpretation and the kind of reference behind it. A clarification says several
 * numbers measure different things. A held disagreement says sources genuinely contradict each
 * other and the contradiction is being kept rather than resolved.
 *
 * Every badge here has a text equivalent and nothing depends on colour alone — the reference kind
 * is always spelled out in words, because the whole point is that a learner can tell a cohort
 * observation from a device specification.
 */

function KindBadge({ kind }: { readonly kind: CriticalCareValueReference['kind'] }) {
  const label = criticalCareReferenceKindLabels[kind]
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
      data-reference-kind={kind}
    >
      {label}
    </span>
  )
}

function ReferenceBlock({ reference }: { readonly reference: CriticalCareValueReference }) {
  return (
    <li className="rounded-xl border bg-background p-3" data-reference-id={reference.id}>
      <KindBadge kind={reference.kind} />
      <p className="mt-2 text-sm leading-6">{reference.statement}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        <span className="font-semibold">Applies when: </span>
        {reference.appliesWhen}
      </p>
      {reference.caveat ? (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{reference.caveat}</p>
      ) : null}
      <p className="mt-1 text-xs leading-5 text-muted-foreground" data-evidence-ids>
        <span className="font-semibold">Sources: </span>
        {reference.evidenceIds.join(', ')}
      </p>
    </li>
  )
}

export function DerivedValueReadout({
  guide,
  value,
  headingLevel = 3,
  children,
}: {
  readonly guide: CriticalCareDerivedValueGuide
  readonly value: number | null
  /** Chosen by the caller so the surrounding document keeps a logical heading order. */
  readonly headingLevel?: 2 | 3 | 4 | 5
  readonly children?: ReactNode
}) {
  const Heading = `h${headingLevel}` as const
  const resolved = value === null ? null : resolveInterpretation(guide, value)
  const valueText =
    value === null ? 'not available' : `${value}${guide.unit ? ` ${guide.unit}` : ''}`

  return (
    <section
      className="rounded-2xl border p-4"
      data-derived-value={guide.id}
      aria-labelledby={`${guide.id}-heading`}
    >
      <Heading id={`${guide.id}-heading`} className="text-base font-semibold">
        {guide.label}
      </Heading>

      <p className="mt-1 text-2xl font-semibold" data-live-value>
        <span aria-hidden="true">{valueText}</span>
        <span className="sr-only">
          {guide.label} {valueText}, a {criticalCareLiveValueTypeLabels[guide.liveValueType]} value.
        </span>
      </p>
      <p className="text-xs uppercase tracking-wide text-muted-foreground" data-live-value-type>
        {criticalCareLiveValueTypeLabels[guide.liveValueType]}
        {guide.formula ? ` · ${guide.formula}` : ''}
      </p>

      <p className="mt-3 text-sm leading-6">{guide.interpretation}</p>

      {resolved ? (
        <div
          className="mt-3 rounded-xl border bg-muted/40 p-3"
          data-interpretation-rule={resolved.rule.id}
        >
          <p className="text-sm leading-6">{resolved.rule.statement}</p>
          <ul className="mt-2 grid gap-2">
            {resolved.references.map((reference) => (
              <ReferenceBlock key={reference.id} reference={reference} />
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 text-xs leading-5 text-muted-foreground">{guide.caveats}</p>
      <p className="mt-2 text-xs leading-5" data-do-not-infer>
        <span className="font-semibold">Do not infer: </span>
        {guide.doNotInfer}
      </p>
      {children}
    </section>
  )
}

export function MeasurementClarification({
  clarification,
  headingLevel = 3,
}: {
  readonly clarification: CriticalCareMeasurementClarification
  readonly headingLevel?: 2 | 3 | 4 | 5
}) {
  const Heading = `h${headingLevel}` as const
  return (
    <section
      className="rounded-2xl border p-4"
      data-measurement-clarification={clarification.id}
      aria-labelledby={`${clarification.id}-heading`}
    >
      <Heading id={`${clarification.id}-heading`} className="text-base font-semibold">
        {clarification.title}
      </Heading>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{clarification.context}</p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            {clarification.title}: each value with the quantity it measures and the condition it was
            reported under.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="pb-1 pr-3 font-semibold">
                Value
              </th>
              <th scope="col" className="pb-1 pr-3 font-semibold">
                Measures
              </th>
              <th scope="col" className="pb-1 pr-3 font-semibold">
                Condition
              </th>
              <th scope="col" className="pb-1 font-semibold">
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            {clarification.quantities.map((quantity) => (
              <tr key={`${quantity.valueText}-${quantity.measurand}`} data-clarified-quantity>
                <th scope="row" className="py-1 pr-3 font-semibold">
                  {quantity.valueText}
                </th>
                <td className="py-1 pr-3" data-measurand>
                  {quantity.measurand}
                </td>
                <td className="py-1 pr-3 text-muted-foreground">{quantity.condition ?? '—'}</td>
                <td className="py-1 text-xs text-muted-foreground">
                  {quantity.source}, {quantity.locator}
                  <span className="sr-only"> Sources: {quantity.evidenceIds.join(', ')}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm leading-6" data-teaching-point>
        {clarification.teachingPoint}
      </p>
    </section>
  )
}

export function HeldDisagreement({
  conflict,
  headingLevel = 3,
}: {
  readonly conflict: CriticalCareSourceConflict
  readonly headingLevel?: 2 | 3 | 4 | 5
}) {
  const Heading = `h${headingLevel}` as const
  return (
    <section
      className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5"
      data-held-disagreement={conflict.id}
      aria-labelledby={`${conflict.id}-heading`}
    >
      <Heading id={`${conflict.id}-heading`} className="text-lg font-semibold">
        {conflict.title}
      </Heading>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{conflict.context}</p>

      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {conflict.positions.map((position) => (
          <li
            key={position.claim}
            className="rounded-xl border bg-background p-4"
            data-conflict-position
          >
            <p className="font-semibold">{position.claim}</p>
            <p className="mt-2 text-sm">{position.source}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{position.locator}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground" data-evidence-ids>
              Sources: {position.evidenceIds.join(', ')}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm leading-6">
        <strong>How this curriculum handles it:</strong> {conflict.handling}
      </p>
    </section>
  )
}

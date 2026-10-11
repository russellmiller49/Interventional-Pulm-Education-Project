import { configuredLocalPolicies } from '../content/localPolicies'
import { numberSourceNames, numbersNeedLocalCheck, type NumberId } from '../content/numbers'

/**
 * The institution's own policy, on the card that depends on it. Shown only for a slot the
 * institution has configured; with nothing configured the card says nothing extra.
 */
export function ConfiguredPolicies({
  ids,
  className,
}: {
  readonly ids: readonly string[] | undefined
  readonly className?: string
}) {
  const configured = configuredLocalPolicies(ids ?? [])
  if (configured.length === 0) return null
  return (
    <ul className={className} data-local-policies>
      {configured.map((policy) => (
        <li key={policy.id} data-local-policy={policy.id}>
          <strong>Your institution, {policy.title.toLowerCase()}:</strong> {policy.value}
        </li>
      ))}
    </ul>
  )
}

/**
 * Where a card's numbers come from, in one line, and the one reminder to check the local protocol.
 * The values themselves are in the card's sentences; the grade of each is in the sources panel.
 */
export function NumberSourceNote({
  ids,
  className,
}: {
  readonly ids: readonly NumberId[] | undefined
  readonly className?: string
}) {
  if (!ids || ids.length === 0) return null
  const names = numberSourceNames(ids)
  const localCheck = numbersNeedLocalCheck(ids)
  if (names.length === 0 && !localCheck) return null
  return (
    <p className={className} data-number-sources={ids.join(' ')}>
      {names.length > 0
        ? `${names.length === 1 ? 'Source' : 'Sources'}: ${names.join('; ')}.`
        : null}
      {localCheck ? ' Check your local protocol.' : null}
    </p>
  )
}

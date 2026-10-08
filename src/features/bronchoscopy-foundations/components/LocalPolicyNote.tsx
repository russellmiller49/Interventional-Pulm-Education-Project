import {
  LOCAL_POLICY_BY_ID,
  LOCAL_POLICY_NOT_SUPPLIED,
  type LocalPolicyId,
} from '../content/localPolicies'
import { ReferenceLink } from './ReferenceLink'

/**
 * How a dependence on local policy is said (fellow walkthrough A14).
 *
 * The same "Not configured" sentence used to follow every block, item and case that named a policy
 * — up to several times on one screen. The dependence itself is the useful part and stays where it
 * applies: `short` names the policies on the block they qualify. The statement that none has been
 * supplied is said once for the screen (`full`), with a link to the Reference list of what each
 * policy covers. Nothing here supplies a value: every policy is still null, and no wording implies
 * that an institution has approved anything.
 */
export function localPolicyTitles(ids: readonly LocalPolicyId[]): string {
  return ids.map((id) => LOCAL_POLICY_BY_ID.get(id)?.title ?? id).join(', ')
}

/** Opens in a new tab: leaving a lesson page would start its section again. */
export function LocalPolicyReferenceLink() {
  return <ReferenceLink anchor="local-policies">Local policies in the Reference</ReferenceLink>
}

export function LocalPolicyNote({
  ids,
  variant = 'full',
  className,
  marker,
}: {
  readonly ids: readonly LocalPolicyId[]
  readonly variant?: 'full' | 'short'
  readonly className?: string
  /** The data attribute the surface is known by in tests and styles. */
  readonly marker?: 'block' | 'item' | 'part'
}) {
  if (ids.length === 0) return null
  const markers = {
    'data-block-policies': marker === 'block' ? '' : undefined,
    'data-item-policies': marker === 'item' ? '' : undefined,
    'data-part-policies': marker === 'part' ? '' : undefined,
  }
  return (
    <p
      className={className}
      data-local-policy-note={variant}
      data-local-policy-ids={ids.join(' ')}
      {...markers}
    >
      Local policy applies: {localPolicyTitles(ids)}.
      {variant === 'full' ? (
        <>
          {' '}
          {LOCAL_POLICY_NOT_SUPPLIED} <LocalPolicyReferenceLink />
        </>
      ) : (
        ' See the local-policy note at the end of this part.'
      )}
    </p>
  )
}

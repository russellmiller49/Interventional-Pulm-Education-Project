import type { ReactNode } from 'react'

import { Link } from '@/i18n/navigation'

import { BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF } from '../content/routes'

/** The Reference page's sections a lesson can point at. */
export type ReferenceAnchor =
  | 'airway-names'
  | 'five-controls'
  | 'reading-the-view'
  | 'local-policies'

/**
 * A link from a lesson to a section of the Reference. It opens in a new tab: leaving a lesson page
 * would start its section again, and the link's own words say that a tab opens.
 */
export function ReferenceLink({
  anchor,
  children,
}: {
  readonly anchor: ReferenceAnchor
  readonly children: ReactNode
}) {
  return (
    <Link
      href={`${BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF}#${anchor}`}
      target="_blank"
      rel="noreferrer"
      data-reference-link={anchor}
    >
      {children} (opens in a new tab)
    </Link>
  )
}

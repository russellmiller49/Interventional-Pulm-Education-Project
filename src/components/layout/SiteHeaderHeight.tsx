'use client'

import { useEffect } from 'react'

/**
 * Publishes the site header's real height as `--site-header-height`.
 *
 * The stylesheet's value (`globals.css`) is the header's one-row height, 4rem or 5rem plus its
 * border. The header grows whenever its row wraps — a signed-in desktop at 1660 px wraps to two
 * rows (≈105 px), enlarged text to three or four (297–377 px at 200 %) — and every activity shell
 * sized to `100dvh - var(--site-header-height)` then ran past the window. In a locked workspace
 * (ECMO, branch tracing) that put the bottom of the task out of reach. The stylesheet value stays
 * as the first paint; from then on the variable is the header's measured border-box height, kept
 * current as the header reflows.
 */
export function SiteHeaderHeight({ headerId }: { readonly headerId: string }) {
  useEffect(() => {
    const header = document.getElementById(headerId)
    if (!header || typeof ResizeObserver === 'undefined') return undefined
    const root = document.documentElement
    // Rounded up, so a fractional header never leaves a shell a sub-pixel taller than its space.
    const publish = () =>
      root.style.setProperty(
        '--site-header-height',
        `${Math.ceil(header.getBoundingClientRect().height)}px`,
      )
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(header)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--site-header-height')
    }
  }, [headerId])
  return null
}

'use client'

import type { ReactNode, SVGProps } from 'react'

import type { CircuitMapRect } from './circuitMapGeometry'
import { useViewBoxTween } from './useViewBoxTween'

/**
 * The map's root element, owning the pan and nothing else.
 *
 * The pan updates state roughly thirty times in half a second. If that state lived in the
 * component that draws the map, every frame would re-render the whole drawing — and the bedside
 * scene in the tab beside it, canvas and all. Here the drawing arrives as `children`, elements the
 * parent created once; a re-render of this component reuses them untouched, so a pan costs one
 * attribute per frame and nothing else.
 */
export function TweenedSvg({
  frameRect,
  children,
  ...rest
}: Omit<SVGProps<SVGSVGElement>, 'viewBox'> & {
  /** The window to show; `target` would collide with the SVG attribute of that name. */
  readonly frameRect: CircuitMapRect
  readonly children: ReactNode
}) {
  const viewBox = useViewBoxTween(frameRect)
  return (
    <svg viewBox={viewBox} {...rest}>
      {children}
    </svg>
  )
}

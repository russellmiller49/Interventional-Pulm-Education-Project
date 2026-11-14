'use client'

import { useLayoutEffect, useRef, useState } from 'react'

/**
 * The height a bench needs to reach the bottom of the window in the fixed workspace.
 *
 * The shared lesson shell puts its body in an `auto` row when it has no context strip, so the
 * body is only as tall as what is in it. A bench whose task column is short (a closing card, the
 * map review) would stop part-way down the window. This measures the space from the bench's top
 * to the bottom of the window and hands it back as a minimum height; below the fixed workspace
 * (narrower than 1024 or shorter than 700) the page flows and it returns undefined.
 */
export function useFillViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [minHeight, setMinHeight] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const query = window.matchMedia('(min-width: 1024px) and (min-height: 700px)')
    const update = () => {
      if (!query.matches) return setMinHeight(undefined)
      const top = element.getBoundingClientRect().top + window.scrollY
      setMinHeight(Math.max(0, Math.floor(window.innerHeight - top)))
    }
    update()
    window.addEventListener('resize', update)
    query.addEventListener('change', update)
    // The shell's header can wrap to a second line; the bench then starts lower.
    const header = element.closest('[data-lesson-shell]')?.firstElementChild
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    if (header && observer) observer.observe(header)
    // The site menu is hidden while a bench is open; if it comes or goes, the bench starts
    // somewhere else.
    const siteHeader = document.getElementById('site-header')
    if (siteHeader && observer) observer.observe(siteHeader)
    return () => {
      window.removeEventListener('resize', update)
      query.removeEventListener('change', update)
      observer?.disconnect()
    }
  }, [])
  return [ref, minHeight] as const
}

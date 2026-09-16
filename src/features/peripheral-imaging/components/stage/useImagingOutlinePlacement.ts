'use client'

import { useEffect, type RefObject } from 'react'

import { bottomClearance, topClearance, zoomFactor } from './pinnedChrome'

/**
 * Keep the Course outline inside the part of the viewport the learner can actually see (G02-PI-02).
 *
 * The outline is a panel anchored to its trigger — `top: 100%; right: 0`, `width: min(80vw, 30rem)`
 * — which is right only while that trigger sits at the inline end of a roomy header row. Enlarged
 * text re-wraps the header tools towards the inline start, and the panel then grows leftwards off
 * the viewport: measured at 900 x 1000 with root text at 32 px it opened 412.9 css px past the
 * inline-start edge, with every section link's centre outside the viewport. The same panel runs
 * past the bottom of the viewport on a phone, because `top: 100%` plus `max-block-size: 65dvh`
 * takes no account of how far down the trigger already is.
 *
 * Both axes are repaired declaratively in `imaging-flow.module.css`; this only measures.
 *
 * - The block axis is capped in both presentations, against the bottom of the usable band rather
 *   than against the viewport, so the pinned Activity-navigation footer never covers the panel.
 * - The inline axis cannot be capped in place: an anchored panel grows from the trigger's
 *   inline-end edge, so capping its width only makes it narrower, never moves it back on screen.
 *   Where the anchored panel would leave the viewport, the panel is laid out against the usable
 *   band instead — `position: fixed`, inset from both edges — and scrolls its own contents.
 *
 * Why this is measured rather than written as a media query: the predicate compares the trigger's
 * rendered position against the panel's own width, and the trigger's position depends on how the
 * header tools have wrapped, which in turn depends on `html { font-size }`. Media-query `em`
 * resolves against the browser's default font size, not `html { font-size }`, so it cannot see the
 * enlargement that causes this at all — the same finding as PI-FOCUS-01.
 *
 * Nothing here moves focus, scrolls, or positions a node from script: it publishes measured lengths
 * as custom properties and marks which presentation applies.
 */

/** Where the contained panel starts, measured down the viewport. */
const BLOCK_START_PROPERTY = '--imaging-outline-block-start'
/** How tall the contained panel may grow before it scrolls its own contents. */
const MAX_BLOCK_PROPERTY = '--imaging-outline-max-block'
/** How tall the anchored panel may grow, measured from the trigger down to the usable band's end. */
const ANCHORED_MAX_BLOCK_PROPERTY = '--imaging-outline-anchored-max-block'

const CONTAINED_ATTRIBUTE = 'data-outline-contained'

/**
 * The least room below the trigger, in `rem`, that is worth opening a panel into: about one
 * section group. Where the band leaves less than this — a phone at 200% text scrolls the trigger
 * out of the viewport entirely — the panel takes the whole usable band instead of hanging off the
 * trigger. Expressed in `rem` so it grows with the text it has to show.
 */
const MIN_PANEL_BLOCK_REM = 8

/**
 * The rendered width of the anchored panel, in the same pixels `getBoundingClientRect` reports.
 * This mirrors `width: min(80vw, 30rem)` on `.outline nav` in `imaging-flow.module.css`; the two
 * are held together by `outline-placement.test.tsx`. Both `vw` and `rem` are CSS lengths, so both
 * are scaled by `html { zoom }` on the way to the screen.
 */
function anchoredInlineSize(viewportWidth: number, remPx: number, zoom: number): number {
  return zoom * Math.min(0.8 * viewportWidth, 30 * remPx)
}

/** `html { font-size }` in css px, which is what `rem` resolves against before zoom is applied. */
function rootFontSize(root: HTMLElement): number {
  const size = Number.parseFloat(getComputedStyle(root).fontSize)
  return Number.isFinite(size) && size > 0 ? size : 16
}

export function useImagingOutlinePlacement(
  shell: RefObject<HTMLElement | null>,
  header: RefObject<HTMLElement | null>,
  footer: RefObject<HTMLElement | null>,
  outline: RefObject<HTMLDetailsElement | null>,
  trigger: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const shellNode = shell.current
    const headerNode = header.current
    const footerNode = footer.current
    const outlineNode = outline.current
    const triggerNode = trigger.current
    if (!shellNode || !triggerNode) return

    const root = document.documentElement
    const update = () => {
      const zoom = zoomFactor(root)
      const remPx = rootFontSize(root)
      // The gutter the contained panel is inset by, `inset-inline: 1rem`, as rendered.
      const gutter = remPx * zoom
      const usableTop = topClearance(headerNode, headerNode ?? footerNode)
      const usableBottom = Math.max(usableTop, window.innerHeight - bottomClearance(footerNode))
      const triggerRect = triggerNode.getBoundingClientRect()

      const minBlock = MIN_PANEL_BLOCK_REM * gutter
      // The room the anchored panel has: to the inline start of the trigger's inline-end edge,
      // where it runs off the viewport, and below the trigger, where the footer stops it.
      const anchoredStart = triggerRect.right - anchoredInlineSize(window.innerWidth, remPx, zoom)
      const anchoredBlock = usableBottom - triggerRect.bottom
      shellNode.setAttribute(
        CONTAINED_ATTRIBUTE,
        String(anchoredStart < gutter || anchoredBlock < minBlock),
      )

      // Open below the trigger, so the panel never covers the control that closes it, and never
      // above the band the pinned chrome leaves. Where the trigger has itself been pushed out of
      // that band there is nothing to sit below, so the panel takes the whole band.
      const blockStart =
        anchoredBlock >= minBlock ? Math.max(usableTop, triggerRect.bottom) : usableTop
      shellNode.style.setProperty(BLOCK_START_PROPERTY, `${blockStart / zoom}px`)
      shellNode.style.setProperty(
        MAX_BLOCK_PROPERTY,
        `${Math.max(0, usableBottom - blockStart) / zoom}px`,
      )
      shellNode.style.setProperty(
        ANCHORED_MAX_BLOCK_PROPERTY,
        `${Math.max(0, usableBottom - triggerRect.bottom) / zoom}px`,
      )
    }

    // The header tools re-wrap when the window, the text size or the step's own status line
    // changes, which moves the trigger and so changes which presentation is right.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    if (headerNode) observer?.observe(headerNode)
    if (footerNode) observer?.observe(footerNode)
    observer?.observe(document.body)
    update()
    window.addEventListener('resize', update)
    // Opening a disclosure whose panel is out of flow changes no box the observer watches, and the
    // page may have scrolled under unpinned chrome since the last reflow, so the trigger is
    // measured again as it is activated and once more after the panel has opened.
    triggerNode.addEventListener('pointerdown', update)
    triggerNode.addEventListener('keydown', update)
    outlineNode?.addEventListener('toggle', update)

    // On a phone at 200% text the whole usable band is barely enough for the outline, so the panel
    // can end up over the part of the page the trigger would scroll into. Closing it whenever the
    // learner leaves it keeps the trigger reachable: Escape and Shift+Tab both put focus back on a
    // trigger that is then visible again, and a click outside dismisses it the way a menu does.
    // None of this changes where the outline leads or what it lists.
    const close = () => {
      if (outlineNode?.open) outlineNode.open = false
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !outlineNode?.open) return
      close()
      triggerNode.focus()
    }
    const onPointerDown = (event: Event) => {
      if (!outlineNode?.open) return
      if (event.target instanceof Node && outlineNode.contains(event.target)) return
      close()
    }
    const onFocusOut = (event: FocusEvent) => {
      // A null relatedTarget is focus leaving the document — the tab strip, the address bar — and
      // the outline should still be open when the learner comes back.
      const next = event.relatedTarget
      if (!next || !(next instanceof Node)) return
      // Focus arriving back on the trigger — Shift+Tab out of the first section — closes it too,
      // so the trigger is visible again wherever the panel has had to cover it.
      if (next !== triggerNode && outlineNode?.contains(next)) return
      close()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    outlineNode?.addEventListener('focusout', onFocusOut)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
      triggerNode.removeEventListener('pointerdown', update)
      triggerNode.removeEventListener('keydown', update)
      outlineNode?.removeEventListener('toggle', update)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      outlineNode?.removeEventListener('focusout', onFocusOut)
      shellNode.style.removeProperty(BLOCK_START_PROPERTY)
      shellNode.style.removeProperty(MAX_BLOCK_PROPERTY)
      shellNode.style.removeProperty(ANCHORED_MAX_BLOCK_PROPERTY)
      shellNode.removeAttribute(CONTAINED_ATTRIBUTE)
    }
  }, [shell, header, footer, outline, trigger])
}

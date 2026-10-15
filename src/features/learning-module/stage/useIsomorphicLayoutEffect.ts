import { useEffect, useLayoutEffect } from 'react'

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server.
 *
 * The foundation workspace measures the DOM before the first paint — the console's scale and the
 * workspace's bounded height both come from measurements, and running them after paint would show
 * an unscaled console and an unbounded workspace for a frame. `useLayoutEffect` is the right hook
 * for that, but these components are prerendered, and React warns that a layout effect does nothing
 * on the server. This switches to `useEffect` where there is no layout to read.
 */
export const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

'use client'

import { useEffect } from 'react'

import { ScopeFallback } from '../components/scope/ScopeFallback'
import type { ScopePaneProps } from '../components/scope/types'

/**
 * The DOM-only simulator pane the flow tests mount in place of `ScopePane`.
 *
 * `ScopeFallback` already honours every prop and data attribute in the contract in native HTML
 * (it sets `data-scope-state="fallback"`), so the double passes its props through unchanged. It
 * exists so a flow test never imports `ScopePane` — which imports `ScopeScenePane`, which will
 * pull `next/dynamic` and three.js once Codex's scene lands. Mount it with
 * `jest.mock('../components/scope/ScopePane', () => require('../test-support/ScopeTestDouble').scopePaneDouble)`.
 *
 * The double also publishes the props it was last rendered with, so a flow test can drive the
 * scope the way the pilot does — through `onCommand`, the same seam the dock's controls use — and
 * read the state the host handed the pane.
 */
let latest: ScopePaneProps | null = null

export function latestScopePaneProps(): ScopePaneProps | null {
  return latest
}

export function ScopeTestDouble(props: ScopePaneProps) {
  useEffect(() => {
    latest = props
  })
  return <ScopeFallback {...props} />
}

export const scopePaneDouble = { ScopePane: ScopeTestDouble }

/**
 * The two other modules the static foundation-workspace fixture cannot bundle as they are.
 *
 * `HandoffContent` (`@/i18n/handoff`) walks the tree substituting localized copy through
 * `useTranslations`, which needs a next-intl provider. For `en` — the only reviewed locale, and the
 * one the layout is reviewed at — it is an identity transform, so the fixture renders its children
 * straight through instead of standing up an intl provider that would change nothing.
 *
 * `EcmoCircuit3D` pulls in three.js, `@react-three/fiber`, `@react-three/drei` and five GLB
 * preloads. In the real activity it sits behind `SimulationLaunchGate` and is not mounted until the
 * learner presses Launch, so it contributes nothing to the layout under review, while its WebGL
 * context makes offline screenshots unreliable. The stub keeps the gate's contract without the
 * renderer.
 *
 * Fixture-only. Nothing in `src/` imports this file.
 */
import type { ReactNode } from 'react'

export function HandoffContent({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function EcmoCircuit3D() {
  return (
    <div
      data-preview-circuit-3d-stub=""
      style={{
        display: 'grid',
        minHeight: '18rem',
        padding: '1rem',
        border: '1px dashed rgba(163, 206, 209, 0.4)',
        borderRadius: '0.75rem',
        color: '#a8c3c6',
        background: '#0b1f24',
        placeItems: 'center',
        fontSize: '0.8125rem',
        textAlign: 'center',
      }}
    >
      Bedside 3D circuit — stubbed in this offline fixture. In the activity this is the real
      <code> EcmoCircuit3D</code>, mounted only after the launch gate is accepted.
    </div>
  )
}

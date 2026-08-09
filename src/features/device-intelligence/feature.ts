/**
 * Phase D1 feature gate for the device-intelligence routes.
 *
 * Deliberately its own flag rather than a reuse of `NEXT_PUBLIC_ENABLE_PREFERENCE_CARDS`:
 * the two areas ship and launch independently (decision D-04 preserves the existing
 * preference-card routes untouched), so turning one on in production must not turn on the
 * other. Same shape as `preferenceCardsEnabled()`: always on outside production, explicit
 * env flag in production. No live deployment variable is set by Phase D1.
 */
export function deviceIntelligenceEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_ENABLE_DEVICE_INTELLIGENCE === 'true'
  )
}

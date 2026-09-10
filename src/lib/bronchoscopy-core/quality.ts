/** Bounded quality settings shared by the three browser runtimes. */
export type RenderingQuality = 'high' | 'balanced' | 'low'
export const RENDERING_QUALITY = {
  high: { maxDpr: 1.75, acousticBeams: 160, acousticSamples: 256 },
  balanced: { maxDpr: 1.25, acousticBeams: 128, acousticSamples: 224 },
  low: { maxDpr: 1, acousticBeams: 96, acousticSamples: 192 },
} as const
export function opticalPixelRatio(
  width: number,
  devicePixelRatio = 1,
  quality: RenderingQuality = 'high',
) {
  return Math.min(devicePixelRatio, width < 560 ? 1.25 : RENDERING_QUALITY[quality].maxDpr)
}
/** Hysteresis avoids oscillating resolution during brief loading stalls. */
export class AdaptiveQuality {
  level: RenderingQuality = 'high'
  private samples = 0
  private average = 16.7
  private previous: number | null = null
  frame(now: number): RenderingQuality | null {
    const elapsed = this.previous === null ? 0 : now - this.previous
    this.previous = now
    if (elapsed <= 0 || elapsed > 150) return null
    this.average = this.average * 0.95 + elapsed * 0.05
    if (++this.samples < 90) return null
    this.samples = 0
    const next =
      this.average > 28
        ? 'low'
        : this.average > 20
          ? 'balanced'
          : this.average < 17.8
            ? 'high'
            : this.level
    if (next === this.level) return null
    this.level = next
    return next
  }
}

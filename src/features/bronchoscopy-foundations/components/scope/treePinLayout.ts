import { AIRWAY_LABELS, type AirwayMapGeometry } from './types'

export const MAP_WIDTH = 360
export const MAP_HEIGHT = 420

/** Keep the anatomical projection, then place labels in nearby free slots with leader lines. */
export function treePinLayout(map: AirwayMapGeometry) {
  const [x, y, width, height] = map.viewBox
  const scale = Math.min(290 / width, 350 / height)
  const offsetX = (MAP_WIDTH - width * scale) / 2 - x * scale
  const offsetY = (MAP_HEIGHT - height * scale) / 2 - y * scale
  const occupied: { x: number; y: number }[] = []
  const pins = AIRWAY_LABELS.flatMap((label) => {
    const point = map.pins[label]
    if (!point) return []
    const anchor = [point[0] * scale + offsetX, point[1] * scale + offsetY] as const
    const slots = Array.from({ length: 102 }, (_, i) => ({
      x: 30 + (i % 6) * 60,
      y: 18 + Math.floor(i / 6) * 24,
    }))
      .filter(
        (slot) => !occupied.some((p) => Math.abs(p.x - slot.x) < 57 && Math.abs(p.y - slot.y) < 23),
      )
      .sort(
        (a, b) =>
          (a.x - anchor[0]) ** 2 +
          (a.y - anchor[1]) ** 2 -
          (b.x - anchor[0]) ** 2 -
          (b.y - anchor[1]) ** 2,
      )
    const position = slots[0]
    occupied.push(position)
    return [{ label, anchor, x: position.x, y: position.y }]
  })
  return { pins, transform: `translate(${offsetX} ${offsetY}) scale(${scale})` }
}

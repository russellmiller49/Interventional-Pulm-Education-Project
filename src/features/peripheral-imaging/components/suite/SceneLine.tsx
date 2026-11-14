'use client'
import type { ComponentProps } from 'react'
import { Line as DreiLine } from '@react-three/drei'
import { DoubleSide } from 'three'

/**
 * The scene's lines.
 *
 * The scene is drawn inside a reflected group (`SCENE_REFLECTION`), which reverses the winding of
 * every triangle. A mesh's material accounts for that; a screen-space line's quads do not, and are
 * culled as back faces. Every line in the suite is therefore drawn two-sided, through this one
 * component, so a new line cannot quietly go missing.
 */
export function Line(props: ComponentProps<typeof DreiLine>) {
  return <DreiLine side={DoubleSide} {...props} />
}

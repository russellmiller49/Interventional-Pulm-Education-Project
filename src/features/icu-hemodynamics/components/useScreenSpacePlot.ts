import { useEffect, useRef, useState } from 'react'

/** Match SVG coordinates to rendered pixels so labels keep their root-text size. */
export function useScreenSpacePlot(initialWidth: number) {
  const ref = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(initialWidth)
  useEffect(() => {
    const svg = ref.current
    if (!svg || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width)
    })
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

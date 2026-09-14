import { useEffect, useId, useRef, type RefObject } from 'react'
import type { AcousticLabel } from '@bronchoscopy-core/acoustic'
import { imageLabelAt, imagePixelAt, type LabelImage } from './imageDiscoveryPixels'

interface Props {
  canvas: RefObject<HTMLCanvasElement | null>
  image: LabelImage | null
  labels: AcousticLabel[]
  enabled: boolean
}
const directions: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

export function ImageDiscovery(props: Props) {
  // Unmount the entire label surface at the lesson's conceal boundary, including accessible text.
  return props.enabled && props.image ? (
    <ActiveImageDiscovery {...props} image={props.image} />
  ) : null
}

function ActiveImageDiscovery({ canvas, image, labels }: Props & { image: LabelImage }) {
  const id = useId()
  const tooltip = useRef<HTMLDivElement>(null)
  const marker = useRef<HTMLSpanElement>(null)
  const point = useRef<{ x: number; y: number; source: 'mouse' | 'touch' | 'keyboard' } | null>(
    null,
  )
  useEffect(() => {
    const element = canvas.current,
      tip = tooltip.current,
      dot = marker.current
    if (!element || !tip || !dot || !element.parentElement) return
    const host = element.parentElement
    const priorTabIndex = element.getAttribute('tabindex')
    const priorDescription = element.getAttribute('aria-describedby')
    element.tabIndex = 0
    element.setAttribute(
      'aria-describedby',
      [priorDescription, id + '-hint', id].filter(Boolean).join(' '),
    )
    const hide = () => {
      tip.hidden = true
      tip.textContent = ''
      dot.hidden = true
    }
    const clear = () => {
      point.current = null
      hide()
    }
    const show = () => {
      const p = point.current
      if (!p) {
        hide()
        return
      }
      const label = imageLabelAt(image, labels, p.x, p.y)
      if (!label && p.source === 'mouse') {
        hide()
        return
      }
      const text = label ?? 'No labeled structure at this point'
      if (tip.textContent !== text) tip.textContent = text
      tip.hidden = false
      const rect = element.getBoundingClientRect(),
        parent = host.getBoundingClientRect()
      const scale = Math.min(rect.width / image.width, rect.height / image.height)
      const x =
        rect.left - parent.left + (rect.width - image.width * scale) / 2 + (p.x + 0.5) * scale
      const y =
        rect.top - parent.top + (rect.height - image.height * scale) / 2 + (p.y + 0.5) * scale
      tip.style.left = `${Math.max(6, Math.min(x + 12, host.clientWidth - tip.offsetWidth - 6))}px`
      tip.style.top = `${Math.max(6, Math.min(y + 16, host.clientHeight - tip.offsetHeight - 6))}px`
      dot.hidden = p.source === 'mouse'
      dot.style.left = `${x}px`
      dot.style.top = `${y}px`
    }
    const locate = (event: PointerEvent, source: 'mouse' | 'touch') => {
      const pixel = imagePixelAt(
        event.clientX,
        event.clientY,
        element.getBoundingClientRect(),
        image,
      )
      point.current = pixel ? { ...pixel, source } : null
      show()
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      if (event.buttons) {
        clear()
        return
      }
      locate(event, 'mouse')
    }
    const tap = (event: PointerEvent) =>
      locate(event, event.pointerType === 'touch' ? 'touch' : 'mouse')
    const leave = () => {
      if (point.current?.source === 'mouse') clear()
    }
    const focus = () => {
      point.current = {
        x: Math.floor(image.width / 2),
        y: Math.floor(image.height / 2),
        source: 'keyboard',
      }
      show()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clear()
        return
      }
      const delta = directions[event.key]
      if (!delta) return
      event.preventDefault()
      const current = point.current ?? {
        x: Math.floor(image.width / 2),
        y: Math.floor(image.height / 2),
      }
      const step = event.shiftKey ? 10 : 1
      point.current = {
        x: Math.max(0, Math.min(image.width - 1, current.x + delta[0] * step)),
        y: Math.max(0, Math.min(image.height - 1, current.y + delta[1] * step)),
        source: 'keyboard',
      }
      show()
    }
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerup', tap)
    element.addEventListener('pointerleave', leave)
    element.addEventListener('pointercancel', clear)
    element.addEventListener('focus', focus)
    element.addEventListener('blur', clear)
    element.addEventListener('keydown', key)
    const resize = new ResizeObserver(show)
    resize.observe(element)
    show()
    return () => {
      resize.disconnect()
      hide()
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerup', tap)
      element.removeEventListener('pointerleave', leave)
      element.removeEventListener('pointercancel', clear)
      element.removeEventListener('focus', focus)
      element.removeEventListener('blur', clear)
      element.removeEventListener('keydown', key)
      if (priorTabIndex === null) element.removeAttribute('tabindex')
      else element.setAttribute('tabindex', priorTabIndex)
      if (priorDescription === null) element.removeAttribute('aria-describedby')
      else element.setAttribute('aria-describedby', priorDescription)
    }
  }, [canvas, image, labels, id])
  return (
    <>
      <div
        ref={tooltip}
        id={id}
        className="linked-model-tooltip linked-image-tooltip"
        role="tooltip"
        aria-live="polite"
        hidden
      />
      <span ref={marker} className="linked-image-point" aria-hidden="true" hidden />
      <span id={id + '-hint'} className="linked-image-hint">
        Use arrow keys to inspect the image; hold Shift for larger steps. Escape clears the label.
      </span>
    </>
  )
}

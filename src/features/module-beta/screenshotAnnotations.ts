export type Point = { x: number; y: number }
export type ScreenshotTool = 'box' | 'arrow' | 'draw' | 'text'
export type ScreenshotAnnotation =
  | { tool: 'box'; start: Point; end: Point }
  | { tool: 'arrow'; start: Point; end: Point }
  | { tool: 'draw'; points: Point[] }
  | { tool: 'text'; point: Point; text: string }

export function drawAnnotation(ctx: CanvasRenderingContext2D, annotation: ScreenshotAnnotation) {
  ctx.save()
  const width = Math.max(3, ctx.canvas.width / 400)
  ctx.lineWidth = width
  ctx.strokeStyle = '#ef4444'
  ctx.fillStyle = '#ef4444'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (annotation.tool === 'box') {
    const x = Math.min(annotation.start.x, annotation.end.x)
    const y = Math.min(annotation.start.y, annotation.end.y)
    const w = Math.abs(annotation.end.x - annotation.start.x)
    const h = Math.abs(annotation.end.y - annotation.start.y)
    ctx.fillStyle = 'rgba(250, 204, 21, 0.2)'
    ctx.fillRect(x, y, w, h)
    ctx.strokeRect(x, y, w, h)
  } else if (annotation.tool === 'arrow') {
    const { start, end } = annotation
    const angle = Math.atan2(end.y - start.y, end.x - start.x)
    const head = width * 5
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.moveTo(
      end.x - head * Math.cos(angle - Math.PI / 6),
      end.y - head * Math.sin(angle - Math.PI / 6),
    )
    ctx.lineTo(end.x, end.y)
    ctx.lineTo(
      end.x - head * Math.cos(angle + Math.PI / 6),
      end.y - head * Math.sin(angle + Math.PI / 6),
    )
    ctx.stroke()
  } else if (annotation.tool === 'draw') {
    ctx.beginPath()
    annotation.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    })
    ctx.stroke()
  } else {
    const fontSize = Math.max(18, ctx.canvas.width / 55)
    const padding = fontSize / 3
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textBaseline = 'top'
    const maxWidth = Math.max(1, ctx.canvas.width - padding * 2)
    // Wrap notes by character so even a long unbroken word stays in the image.
    const lines: string[] = []
    let line = ''
    for (const character of annotation.text) {
      if (ctx.measureText(line + character).width > Math.min(maxWidth, ctx.canvas.width * 0.65)) {
        lines.push(line)
        line = ''
      }
      line += character
    }
    if (line) lines.push(line)
    const w =
      Math.min(maxWidth, Math.max(...lines.map((value) => ctx.measureText(value).width))) +
      padding * 2
    const h = lines.length * fontSize * 1.25 + padding * 2
    const x = Math.max(0, Math.min(annotation.point.x, ctx.canvas.width - w))
    const y = Math.max(0, Math.min(annotation.point.y, ctx.canvas.height - h))
    ctx.fillStyle = '#b91c1c'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#ffffff'
    lines.forEach((value, index) =>
      ctx.fillText(value, x + padding, y + padding + index * fontSize * 1.25),
    )
  }
  ctx.restore()
}

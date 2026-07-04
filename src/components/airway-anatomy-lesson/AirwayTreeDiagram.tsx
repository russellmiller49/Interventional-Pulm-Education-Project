'use client'

import { useMemo, useState } from 'react'

import {
  CHILD_IDS,
  computeDiagramLayout,
  getAncestry,
  lobeColor,
} from '@/lib/airway-anatomy-lesson/airway-graph'
import { cn } from '@/lib/cn'

interface AirwayTreeDiagramProps {
  selectedId: string | null
  onSelect: (id: string) => void
  /** Node ids to render as an emphasized path (e.g. the survey trail). */
  trailIds?: Set<string>
  className?: string
}

const WIDTH = 900
const HEIGHT = 660
const PAD_LEFT = 54
const PAD_RIGHT = 96
const PAD_TOP = 26
const PAD_BOTTOM = 26

/**
 * Interactive, color-coded dendrogram of the tracheobronchial tree. Internal
 * nodes sit at their true generation depth; leaves are aligned into a right-hand
 * column so segment labels read cleanly. Deterministic layout from
 * computeDiagramLayout — no measurement, safe to server-render into a client
 * tree.
 */
export function AirwayTreeDiagram({
  selectedId,
  onSelect,
  trailIds,
  className,
}: AirwayTreeDiagramProps) {
  const layout = useMemo(() => computeDiagramLayout(), [])
  const [hoverId, setHoverId] = useState<string | null>(null)

  const selectedAncestry = useMemo(
    () => new Set(selectedId ? getAncestry(selectedId).map((n) => n.id) : []),
    [selectedId],
  )

  const isLeaf = (id: string) => (CHILD_IDS[id] ?? []).length === 0

  // Map normalized layout coords → pixel coords, aligning leaves to the right.
  const px = (id: string, x: number) =>
    isLeaf(id) ? WIDTH - PAD_RIGHT : PAD_LEFT + x * (WIDTH - PAD_LEFT - PAD_RIGHT)
  const py = (y: number) => PAD_TOP + y * (HEIGHT - PAD_TOP - PAD_BOTTOM)

  const posById = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {}
    for (const item of layout.nodes) {
      map[item.node.id] = { x: px(item.node.id, item.x), y: py(item.y) }
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout])

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full min-w-[680px]"
        role="group"
        aria-label="Tracheobronchial tree diagram"
      >
        {/* Edges */}
        {layout.links.map((link) => {
          const from = posById[link.fromId]
          const to = posById[link.toId]
          if (!from || !to) return null
          const child = layout.nodes.find((n) => n.node.id === link.toId)?.node
          const midX = (from.x + to.x) / 2
          const onTrail = selectedAncestry.has(link.toId) || (trailIds?.has(link.toId) ?? false)
          return (
            <path
              key={`${link.fromId}-${link.toId}`}
              d={`M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`}
              fill="none"
              stroke={child ? lobeColor(child.lobe) : '#64748b'}
              strokeWidth={onTrail ? 3.4 : 2}
              strokeOpacity={onTrail ? 0.95 : 0.5}
            />
          )
        })}

        {/* Nodes */}
        {layout.nodes.map(({ node }) => {
          const pos = posById[node.id]
          if (!pos) return null
          const leaf = isLeaf(node.id)
          const selected = selectedId === node.id
          const hovered = hoverId === node.id
          const color = lobeColor(node.lobe)
          const r = selected ? 8 : leaf ? 5.5 : 6.5
          return (
            <g
              key={node.id}
              transform={`translate(${pos.x} ${pos.y})`}
              onClick={() => onSelect(node.id)}
              onMouseEnter={() => setHoverId(node.id)}
              onMouseLeave={() => setHoverId((cur) => (cur === node.id ? null : cur))}
              style={{ cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              aria-label={node.fullName}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(node.id)
                }
              }}
            >
              {selected && (
                <circle
                  r={r + 4}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeOpacity="0.9"
                />
              )}
              <circle
                r={r}
                fill={color}
                stroke={selected || hovered ? '#0f172a' : '#0b1120'}
                strokeWidth={selected || hovered ? 2 : 1}
              />
              <text
                x={leaf ? r + 6 : 0}
                y={leaf ? 4 : -r - 5}
                textAnchor={leaf ? 'start' : 'middle'}
                className={cn(
                  'select-none',
                  leaf ? 'text-[12px]' : 'text-[11px]',
                  selected
                    ? 'fill-foreground font-bold'
                    : hovered
                      ? 'fill-foreground font-semibold'
                      : 'fill-muted-foreground font-medium',
                )}
              >
                {node.shortLabel}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

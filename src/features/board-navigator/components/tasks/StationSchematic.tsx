'use client'

import { cn } from '@/lib/cn'

/**
 * A schematic of the mediastinal and hilar stations, drawn on the airway and the vessel borders
 * the IASLC map uses. It is a diagram, not an anatomical rendering: the landmarks are placed so
 * the boundary rules can be read off the picture. Regions carry neutral letters until the learner
 * commits; the station labels appear afterwards.
 *
 * Radiological convention: the patient's right is on the viewer's left.
 */
export interface SchematicRegion {
  readonly id: string
  readonly letter: string
  /** Where the region is, in words a screen reader can use without naming the station. */
  readonly position: string
  readonly shape:
    | {
        readonly kind: 'ellipse'
        readonly cx: number
        readonly cy: number
        readonly rx: number
        readonly ry: number
      }
    | {
        readonly kind: 'rect'
        readonly x: number
        readonly y: number
        readonly w: number
        readonly h: number
      }
}

export const STATION_REGIONS: readonly SchematicRegion[] = [
  {
    id: '2R',
    letter: 'A',
    position: 'right of the trachea, above the brachiocephalic vein',
    shape: { kind: 'ellipse', cx: 150, cy: 62, rx: 16, ry: 14 },
  },
  {
    id: '2L',
    letter: 'B',
    position: 'left of the trachea, above the aortic arch',
    shape: { kind: 'ellipse', cx: 252, cy: 66, rx: 16, ry: 14 },
  },
  {
    id: '4R',
    letter: 'C',
    position:
      'right of and in front of the trachea, between the brachiocephalic vein and the azygos vein',
    shape: { kind: 'rect', x: 134, y: 104, w: 84, h: 42 },
  },
  {
    id: '4L',
    letter: 'D',
    position: 'left of the trachea, between the aortic arch and the left pulmonary artery',
    shape: { kind: 'ellipse', cx: 254, cy: 158, rx: 18, ry: 22 },
  },
  {
    id: '10R',
    letter: 'E',
    position:
      'beside the right main bronchus, below the azygos vein, before the upper lobe takeoff',
    shape: { kind: 'ellipse', cx: 146, cy: 192, rx: 15, ry: 14 },
  },
  {
    id: '7',
    letter: 'F',
    position: 'below the carina, between the two main bronchi',
    shape: { kind: 'ellipse', cx: 200, cy: 246, rx: 20, ry: 20 },
  },
  {
    id: '10L',
    letter: 'G',
    position: 'beside the left main bronchus, below the left pulmonary artery',
    shape: { kind: 'ellipse', cx: 270, cy: 228, rx: 14, ry: 13 },
  },
  {
    id: '11R',
    letter: 'H',
    position: 'between the right upper lobe bronchus and the bronchus intermedius',
    shape: { kind: 'ellipse', cx: 104, cy: 272, rx: 13, ry: 13 },
  },
  {
    id: '11L',
    letter: 'I',
    position: 'between the left upper and lower lobe bronchi',
    shape: { kind: 'ellipse', cx: 322, cy: 300, rx: 13, ry: 13 },
  },
]

export function StationSchematic({
  selectedId,
  revealed,
  answerId,
  onSelect,
  disabled,
}: {
  readonly selectedId: string | null
  readonly revealed: boolean
  readonly answerId: string
  readonly onSelect: (regionId: string) => void
  readonly disabled: boolean
}) {
  return (
    <svg
      viewBox="0 0 400 360"
      role="group"
      aria-label="Schematic of the trachea, main bronchi and lymph node station regions. Choose a region from the list that follows."
      className="w-full max-w-md rounded-2xl border bg-background text-foreground"
    >
      <title>Station schematic, not to scale</title>
      {/* Landmarks */}
      <rect
        x="180"
        y="20"
        width="40"
        height="182"
        rx="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path d="M180 202 L112 262 L96 288" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M130 246 L92 232" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M118 256 L112 330" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M220 202 L300 278 L310 330" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M288 266 L330 250" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M180 202 L220 202" fill="none" stroke="currentColor" strokeWidth="2.5" />
      {/* Vessel borders */}
      <path d="M120 96 L180 96" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
      <path
        d="M220 100 Q260 92 300 104"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <path
        d="M118 150 Q150 142 180 150"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <path d="M220 206 L300 206" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
      {/* Landmark labels */}
      <text x="200" y="14" textAnchor="middle" fontSize="11" fill="currentColor">
        Trachea
      </text>
      <text x="40" y="60" fontSize="12" fontWeight="700" fill="currentColor">
        R
      </text>
      <text x="350" y="60" fontSize="12" fontWeight="700" fill="currentColor">
        L
      </text>
      <text x="24" y="92" fontSize="9" fill="currentColor">
        brachiocephalic v.
      </text>
      <text x="304" y="100" fontSize="9" fill="currentColor">
        aortic arch
      </text>
      <text x="56" y="146" fontSize="9" fill="currentColor">
        azygos v., lower border
      </text>
      <text x="304" y="202" fontSize="9" fill="currentColor">
        left PA, upper rim
      </text>
      <text x="200" y="214" textAnchor="middle" fontSize="9" fill="currentColor">
        carina
      </text>
      <text x="100" y="345" fontSize="9" fill="currentColor">
        bronchus intermedius
      </text>
      <text x="238" y="345" fontSize="9" fill="currentColor">
        left lower lobe bronchus
      </text>
      {/* Regions */}
      {STATION_REGIONS.map((region) => {
        const selected = selectedId === region.id
        const isAnswer = revealed && region.id === answerId
        const isWrongPick = revealed && selected && region.id !== answerId
        const common = {
          className: cn(
            'transition',
            disabled ? 'cursor-default' : 'cursor-pointer',
            isAnswer
              ? 'fill-emerald-500/40 stroke-emerald-600'
              : isWrongPick
                ? 'fill-amber-500/40 stroke-amber-600'
                : selected
                  ? 'fill-primary/40 stroke-primary'
                  : 'fill-muted-foreground/15 stroke-muted-foreground/60 hover:fill-primary/20',
          ),
          strokeWidth: 1.5,
          onClick: disabled ? undefined : () => onSelect(region.id),
          'aria-hidden': true,
        }
        const label = (
          <text
            x={
              region.shape.kind === 'ellipse'
                ? region.shape.cx
                : region.shape.x + region.shape.w / 2
            }
            y={
              (region.shape.kind === 'ellipse'
                ? region.shape.cy
                : region.shape.y + region.shape.h / 2) + 4
            }
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill="currentColor"
            pointerEvents="none"
            aria-hidden="true"
          >
            {revealed ? region.id : region.letter}
          </text>
        )
        return (
          <g key={region.id} data-region={region.id}>
            {region.shape.kind === 'ellipse' ? (
              <ellipse
                cx={region.shape.cx}
                cy={region.shape.cy}
                rx={region.shape.rx}
                ry={region.shape.ry}
                {...common}
              />
            ) : (
              <rect
                x={region.shape.x}
                y={region.shape.y}
                width={region.shape.w}
                height={region.shape.h}
                rx="10"
                {...common}
              />
            )}
            {label}
          </g>
        )
      })}
    </svg>
  )
}

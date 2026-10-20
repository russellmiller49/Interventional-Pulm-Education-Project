'use client'
import { Line } from '@react-three/drei'
import {
  rayCrossingLabel,
  type PathKind,
  type PathSegment,
  type RayCrossing,
} from '../../../lib/rayStructures'
import styles from '../suite-scene.module.css'

/** One colour and one name per kind of anatomy the path crosses. */
export const PATH_KINDS: Readonly<Record<PathKind, { label: string; color: string }>> = {
  lung: { label: 'Lung', color: '#61bdbe' },
  chestWall: { label: 'Chest wall', color: '#9a8fa3' },
  mediastinum: { label: 'Heart and mediastinum', color: '#d9737f' },
  diaphragm: { label: 'Diaphragm and upper abdomen', color: '#b9825a' },
  spine: { label: 'Spine', color: '#c8b27a' },
  rib: { label: 'Rib', color: '#f1e6c4' },
  nodule: { label: 'Nodule', color: '#e8b86c' },
}
const KIND_ORDER: readonly PathKind[] = [
  'nodule',
  'mediastinum',
  'diaphragm',
  'spine',
  'rib',
  'lung',
  'chestWall',
]

export function RayTrace({ segments }: { segments: readonly PathSegment[] | null }) {
  return (
    <>
      {segments?.map((segment, i) => (
        <Line
          key={i}
          points={[segment.start, segment.end]}
          color={PATH_KINDS[segment.kind].color}
          lineWidth={5}
        />
      ))}
    </>
  )
}

export function SignalReadout({
  segments,
  crossing,
  failed = false,
}: {
  segments: readonly PathSegment[] | null
  crossing: RayCrossing
  failed?: boolean
}) {
  const total = segments?.reduce((sum, segment) => sum + segment.lengthMm, 0) ?? 0
  const present = KIND_ORDER.filter((kind) => segments?.some((segment) => segment.kind === kind))
  return (
    <div
      className={styles.signalProfile}
      data-ray-profile-state={failed ? 'failed' : segments ? 'ready' : 'loading'}
    >
      <p className={styles.caption}>What lies over the nodule</p>
      <p data-ray-meaning>
        The X-ray path from the tube through the centre of the nodule to the detector, coloured by
        what it crosses. Everything on this path is superimposed on the nodule in the image. Rotate
        or angle the C-arm and watch the heart, a rib or the diaphragm move off the path.
      </p>
      <p data-ray-crossing>
        <strong>Over the nodule:</strong> {rayCrossingLabel(crossing)}
      </p>
      {segments && total > 0 ? (
        <>
          <svg
            role="img"
            aria-label="The X-ray path from tube to detector, coloured by the anatomy it crosses"
            viewBox="0 0 600 24"
            style={{ display: 'block', width: '100%', height: 24, margin: '10px 0' }}
          >
            {segments.map((segment, i) => {
              const before = segments.slice(0, i).reduce((sum, s) => sum + s.lengthMm, 0)
              return (
                <rect
                  key={i}
                  x={(before / total) * 600}
                  y={0}
                  width={(segment.lengthMm / total) * 600 + 0.1}
                  height={24}
                  fill={PATH_KINDS[segment.kind].color}
                />
              )
            })}
          </svg>
          <ul className={styles.tissues}>
            {present.map((kind) => (
              <li key={kind} data-ray-structure={kind}>
                <span style={{ background: PATH_KINDS[kind].color }} />
                {PATH_KINDS[kind].label}
              </li>
            ))}
          </ul>
          <p>The tube is at the left end of the strip and the detector at the right.</p>
        </>
      ) : (
        <p>
          {failed
            ? 'The labelled path is unavailable. Use the image and the readout.'
            : 'Labelling the path…'}
        </p>
      )}
    </div>
  )
}

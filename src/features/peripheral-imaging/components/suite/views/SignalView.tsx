'use client'
import { Line } from '@react-three/drei'
import { RAY_TISSUES, type RayProfile, type RayTissue } from '../../../lib/rayProfile'
import styles from '../suite-scene.module.css'

export function RayTrace({ profile }: { profile: RayProfile | null }) {
  return (
    <>
      {profile?.segments.map((segment, i) => (
        <Line
          key={i}
          points={[segment.start, segment.end]}
          color={RAY_TISSUES[segment.tissue].color}
          lineWidth={5}
        />
      ))}
    </>
  )
}
export function SignalReadout({
  profile,
  failed = false,
}: {
  profile: RayProfile | null
  failed?: boolean
}) {
  return (
    <div
      className={styles.signalProfile}
      data-ray-profile-state={failed ? 'failed' : profile ? 'ready' : 'loading'}
    >
      <p className={styles.caption}>What lies along the target ray</p>
      {profile ? (
        <>
          <svg
            role="img"
            aria-label="CT density bands in source-to-detector order; each band length is proportional to the traversed distance"
            viewBox="0 0 600 24"
            style={{ display: 'block', width: '100%', height: 24, margin: '10px 0' }}
          >
            {profile.segments.map((segment, i) => {
              const before = profile.segments.slice(0, i).reduce((sum, s) => sum + s.lengthMm, 0)
              return (
                <rect
                  key={i}
                  x={(before / profile.pathMm) * 600}
                  y={0}
                  width={(segment.lengthMm / profile.pathMm) * 600 + 0.1}
                  height={24}
                  fill={RAY_TISSUES[segment.tissue].color}
                />
              )
            })}
          </svg>
          <dl className={styles.tissues}>
            {(Object.keys(RAY_TISSUES) as RayTissue[]).map((tissue) => (
              <div key={tissue}>
                <dt>
                  <span style={{ background: RAY_TISSUES[tissue].color }} />
                  {RAY_TISSUES[tissue].label}
                </dt>
                <dd data-ray-tissue={tissue}>{profile.tissueMm[tissue].toFixed(1)} mm</dd>
              </div>
            ))}
          </dl>
          <p>
            Rotate the beam and compare the CT context it crosses. The line and strip show the same
            ray in source-to-detector order.
          </p>
        </>
      ) : (
        <p>
          {failed
            ? 'The CT density profile is unavailable. Use the projection and controls.'
            : 'Preparing the CT density profile…'}
        </p>
      )}
    </div>
  )
}

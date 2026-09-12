import {
  DISPLAY_TRANSFORM,
  ORIENTATION_LABELS,
  TARGET_CT_BASE,
  nativeImageUrl,
  targetForTrace,
  traceById,
} from '../geometry/native-ct'
import styles from './branch-tracing.module.css'

/** The actual CT and composited target pixels, displayed in the regional tracing convention. */
export function TargetCtPreview({ traceId = 'middle-lobe-caudal' }: { traceId?: string }) {
  const trace = traceById(traceId),
    target = targetForTrace(trace)
  const frame = target.patch.frames.find((f) => f.slice === target.slice)!
  const labels = ORIENTATION_LABELS[trace.preset]
  return (
    <figure className={styles.ctHero}>
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={`Simulated nodule in the ${target.segment.name.toLowerCase()} on real CT, in the book tracing view`}
      >
        <g
          transform={`translate(50 50) ${DISPLAY_TRANSFORM[trace.preset]} scale(${100 / 190}) translate(${-target.pixel[0]} ${-target.pixel[1]})`}
        >
          <image href={nativeImageUrl(target.slice)} x={-0.5} y={-0.5} width="512" height="512" />
          <image
            href={`${TARGET_CT_BASE}/${frame.path}`}
            x={target.patch.originPixel[0] - 0.5}
            y={target.patch.originPixel[1] - 0.5}
            width={target.patch.size[0]}
            height={target.patch.size[1]}
          />
        </g>
        <circle
          cx="50"
          cy="50"
          r="8"
          fill="none"
          stroke="#e6b0ef"
          strokeWidth=".4"
          strokeDasharray="1 1"
        />
        <text x="50" y="64" textAnchor="middle">
          Target nodule
        </text>
        <text x="50" y="6" textAnchor="middle">
          {labels.top}
        </text>
        <text x="50" y="97" textAnchor="middle">
          {labels.bottom}
        </text>
        <text x="3" y="51">
          {labels.left}
        </text>
        <text x="96" y="51">
          {labels.right}
        </text>
      </svg>
      <figcaption>
        <strong>
          {target.segment.code} · {target.segment.name}
        </strong>
        <span>Simulated nodule · real CT · 0.5 mm slices</span>
      </figcaption>
    </figure>
  )
}

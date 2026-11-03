/**
 * The page the frame script screenshots: the dolphin case alone, at one frame's pose, with every
 * label, the location pill and all chrome off. Bundled by `render-frames.mts`; never part of the
 * app. `?frame=<id>` picks the frame from the frame bank.
 */
import { NextIntlClientProvider } from 'next-intl'
import { createRoot } from 'react-dom/client'

import {
  AirwayAnatomyModule,
  DOLPHIN_AIRWAY_CASE,
} from '@/components/airway-anatomy/AirwayAnatomyModule'
import { dolphinFrameById } from '@/features/dolphin-bronchoscopy/content/frameBank'
import { DOLPHIN_SCOPE_STARTS } from '@/features/dolphin-bronchoscopy/content/scopeStarts'

import messages from '../../messages/en.json'

declare global {
  interface Window {
    __frameReady?: boolean
    __frameLocation?: string
  }
}

const query = new URLSearchParams(window.location.search)
const id = query.get('frame') ?? ''
const probe = query.get('edge')
const frame = probe
  ? {
      id: `probe-${probe}`,
      rights: {
        kind: 'simulator-render' as const,
        pose: {
          edgeId: Number(probe),
          distanceMm: Number(query.get('mm') ?? 0),
          yawDeg: Number(query.get('yaw') ?? 0),
          pitchDeg: Number(query.get('pitch') ?? 0),
        },
      },
    }
  : dolphinFrameById.get(id)
const root = createRoot(document.getElementById('root')!)

if (!frame || frame.rights.kind !== 'simulator-render') {
  root.render(<p id="missing">No simulator frame named {id}</p>)
} else {
  const pose = frame.rights.pose
  const start =
    'start' in pose
      ? {
          edgeId: DOLPHIN_SCOPE_STARTS[pose.start].edgeId,
          distanceMm: DOLPHIN_SCOPE_STARTS[pose.start].distanceMm,
          yawDeg: DOLPHIN_SCOPE_STARTS[pose.start].yawDeg,
          pitchDeg: DOLPHIN_SCOPE_STARTS[pose.start].pitchDeg,
        }
      : pose
  root.render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <div style={{ width: 986 }}>
        <AirwayAnatomyModule
          source={DOLPHIN_AIRWAY_CASE}
          embed={{
            start: { ...start, key: frame.id },
            branchLabels: 'hidden',
            showLocation: false,
            chrome: { header: false, modeStrip: false, ct: false, tree: false },
            onLocationChange: (location) => {
              window.__frameLocation = location.abbr
            },
            onPoseChange: () => {
              window.__frameReady = true
            },
          }}
        />
      </div>
    </NextIntlClientProvider>,
  )
}

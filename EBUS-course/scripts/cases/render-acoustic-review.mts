import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import sharp from 'sharp'
import { computeSimulatorPose } from '../../apps/web/src/features/simulator/pose'
import { acousticPoseFromScope } from '../../apps/web/src/features/simulator/acousticAdapter'
import { DEFAULT_ACOUSTIC_CONTROLS, renderAcousticFrame, type AcousticVolume } from '../../../src/lib/bronchoscopy-core/acoustic'
import type { SimulatorCaseManifest, SimulatorCenterlineAsset } from '../../apps/web/src/features/simulator/types'

const root=path.resolve(process.env.EBUS_REVIEW_CASE_DIR??'EBUS-course/apps/web/public/simulator/case-001')
const output=path.resolve(process.env.EBUS_REVIEW_OUTPUT??'artifacts/ebus-acoustic-review')
fs.mkdirSync(output,{recursive:true})
const json=(name:string)=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'))
const manifest=json('case_manifest.simplified.web.json') as SimulatorCaseManifest
const centerlines=json(manifest.assets.centerlines) as SimulatorCenterlineAsset
const ref=manifest.assets.acoustic_volume!
const volume:AcousticVolume={metadata:json(ref.metadata),data:new Uint8Array(gunzipSync(fs.readFileSync(path.join(root,ref.data))))}
const results=[]
for(const preset of manifest.presets) {
  const line=centerlines.polylines.find(l=>l.line_index===preset.line_index)!
  const pose=computeSimulatorPose(line,preset.centerline_s_mm,manifest.render_defaults.roll_deg,preset)
  const controls={...DEFAULT_ACOUSTIC_CONTROLS,depthMm:manifest.render_defaults.max_depth_mm,sectorAngleDeg:manifest.render_defaults.sector_angle_deg}
  const start=performance.now(),frame=renderAcousticFrame(volume,acousticPoseFromScope(pose),controls),renderMs=performance.now()-start
  const filename=preset.preset_key.replace(/[^a-zA-Z0-9]+/g,'_')+'.png'
  await sharp(Buffer.from(frame.rgba),{raw:{width:frame.width,height:frame.height,channels:4}}).png().toFile(path.join(output,filename))
  const visible=frame.structures.map(s=>({...s,key:volume.metadata.labels[s.id].key}))
  results.push({preset:preset.preset_key,renderMs,targetVisible:visible.some(s=>s.key===preset.station_key),visible,pose:frame.pose,image:filename})
}
fs.writeFileSync(path.join(output,'station-review.json'),JSON.stringify({sourceGeometrySha256:volume.metadata.sourceGeometrySha256,assetVersion:volume.metadata.assetVersion,results},null,2)+'\n')
console.log(JSON.stringify(results.map(r=>({preset:r.preset,targetVisible:r.targetVisible,renderMs:Math.round(r.renderMs)})),null,2))

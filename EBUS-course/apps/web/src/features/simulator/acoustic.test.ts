import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACOUSTIC_CONTROLS, renderAcousticFrame, validateAcousticVolume, type AcousticVolume } from '@bronchoscopy-core/acoustic';
import { BF_UC180F_NOMINAL, ebusWebToPatient, patientToEbusWeb, scopeOrigins } from '@bronchoscopy-core/devices';
import { decodeGzip } from '@bronchoscopy-core/compression';
import { acousticPoseFromScope, physicsSnapshotMatchesPose } from './acousticAdapter';
import { computeSimulatorPose, sectorPlaneNormal } from './pose';
import { buildChannelRaycastMesh, contactQualityForPose, isInsideChannel, constrainedPathAdvance } from './channelExtent';
import * as THREE from 'three';
import type { SimulatorCaseManifest, SimulatorCenterlineAsset, SimulatorMeshAsset, SimulatorPhysicsSnapshot } from './types';

const root=resolve(process.cwd(),'public/simulator/case-001');
const json=<T,>(name:string):T=>JSON.parse(readFileSync(resolve(root,name),'utf8'));
const manifest=json<SimulatorCaseManifest>('case_manifest.simplified.web.json');
const reference=manifest.assets.acoustic_volume!;
const volume:AcousticVolume={metadata:json(reference.metadata),data:new Uint8Array(gunzipSync(readFileSync(resolve(root,reference.data))))};
const lines=json<SimulatorCenterlineAsset>(manifest.assets.centerlines);
const channel=buildChannelRaycastMesh(json<SimulatorMeshAsset>(manifest.assets.airway_mesh));
const preset=manifest.presets.find(p=>p.station==='4r')!;
const poseFor=(p:typeof preset)=>computeSimulatorPose(lines.polylines.find(l=>l.line_index===p.line_index)!,p.centerline_s_mm,0,p);
const pose=poseFor(preset),acousticPose=acousticPoseFromScope(pose);
const render=(controls={},offset=0)=>renderAcousticFrame(volume,{...acousticPose,originLps:[acousticPose.originLps[0]+offset,acousticPose.originLps[1],acousticPose.originLps[2]]},{...DEFAULT_ACOUSTIC_CONTROLS,...controls},160,160,100,160);
const difference=(a:Uint8ClampedArray,b:Uint8ClampedArray)=>a.reduce((s,v,i)=>s+(i%4===0?Math.abs(v-b[i]):0),0)/(a.length/4);
const brightness=(a:Uint8ClampedArray)=>a.reduce((s,v,i)=>s+(i%4===0?v:0),0)/(a.length/4);

describe('continuous acoustic case registration',()=>{
  it('uses the exact active geometry and verifies the decoded volume',()=>{
    const model=manifest.assets.clean_models?.find(m=>m.primary)!;
    expect(createHash('sha256').update(readFileSync(resolve(root,model.asset))).digest('hex')).toBe(volume.metadata.sourceGeometrySha256);
    expect(createHash('sha256').update(volume.data).digest('hex')).toBe(volume.metadata.decodedSha256);
    expect(()=>validateAcousticVolume(volume.metadata,volume.data,{assetVersion:reference.asset_version,sourceGeometrySha256:reference.source_geometry_sha256})).not.toThrow();
    expect(()=>validateAcousticVolume(volume.metadata,volume.data,{assetVersion:'old-case',sourceGeometrySha256:reference.source_geometry_sha256})).toThrow(/match/);
    expect(()=>validateAcousticVolume(volume.metadata,volume.data.subarray(1),{assetVersion:reference.asset_version,sourceGeometrySha256:reference.source_geometry_sha256})).toThrow(/dimensions/);
  });
  it.each(manifest.presets.map(p=>[p.preset_key,p] as const))('places %s at the active wall with the target in its longitudinal scan',(_key,p)=>{
    const live=poseFor(p),scan=acousticPoseFromScope(live);
    expect(isInsideChannel(channel,live.position,live.tangent)).toBe(true);
    expect(contactQualityForPose(live,channel)).toBeGreaterThan(.9);
    const normal=sectorPlaneNormal(live);
    expect(normal.dot(live.depthAxis)).toBeCloseTo(0,8);
    expect(normal.dot(live.tangent)).toBeCloseTo(0,8);
    const frame=renderAcousticFrame(volume,scan,DEFAULT_ACOUSTIC_CONTROLS,160,160,100,160);
    expect(frame.structures.some(s=>volume.metadata.labels[s.id].key===p.station_key)).toBe(true);
  });
  it('rejects unversioned, displaced, rotated and nonfinite snapshots',()=>{
    const snapshot={metadata:{asset_version:reference.asset_version,source_geometry_sha256:reference.source_geometry_sha256,contact:pose.position.toArray(),shaft_axis:pose.tangent.toArray(),depth_axis:pose.depthAxis.toArray(),lateral_axis:pose.lateralAxis.toArray()}} as unknown as SimulatorPhysicsSnapshot;
    expect(physicsSnapshotMatchesPose(snapshot,manifest,pose)).toBe(true);
    expect(physicsSnapshotMatchesPose({...snapshot,metadata:{...snapshot.metadata!,asset_version:'old'}},manifest,pose)).toBe(false);
    expect(physicsSnapshotMatchesPose(snapshot,manifest,{...pose,position:pose.position.clone().addScalar(20)})).toBe(false);
    expect(physicsSnapshotMatchesPose(snapshot,manifest,{...pose,depthAxis:pose.depthAxis.clone().negate()})).toBe(false);
    expect(physicsSnapshotMatchesPose({...snapshot,metadata:{...snapshot.metadata!,depth_axis:[NaN,0,1]}},manifest,pose)).toBe(false);
    expect(Object.keys(manifest.physics_snapshots??{})).toHaveLength(0);
  });
});
describe('pulse/echo behavior',()=>{
  it('transports the calibrated frame and contact continuously across the old snap boundary',()=>{
    const line=lines.polylines.find(l=>l.line_index===preset.line_index)!;
    for(const offset of [-1.001,-.001,.999]){
      const a=computeSimulatorPose(line,preset.centerline_s_mm+offset,0,preset),b=computeSimulatorPose(line,preset.centerline_s_mm+offset+.002,0,preset);
      expect(a.position.distanceTo(b.position)).toBeLessThan(.015);
      expect(a.depthAxis.angleTo(b.depthAxis)).toBeLessThan(.002);
    }
  });
  it('sweeps large drive steps and permits withdrawal from a wall',()=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    const at=(s:number)=>({...pose,position:new THREE.Vector3(s,0,0),tangent:new THREE.Vector3(1,0,0)});
    const end=constrainedPathAdvance(0,20,at,mesh);expect(end).toBeLessThan(5);expect(end).toBeGreaterThan(4);
    expect(constrainedPathAdvance(end,0,at,mesh)).toBe(0);
  });
  it('is stationary when held still and changes coherently during scanning',()=>{
    const base=render();
    expect(render().rgba).toEqual(base.rgba);
    const small=difference(base.rgba,render({},.04).rgba),large=difference(base.rgba,render({},3).rgba);
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(large*.5);
    for(let i=0;i<base.rgba.length;i+=4){expect(base.rgba[i]).toBe(base.rgba[i+1]);expect(base.rgba[i]).toBe(base.rgba[i+2]);}
  });
  it('responds to gain, TGC, depth and contact loss/recovery',()=>{
    const base=render(),gain=render({gainDb:12}),far=render({tgcDb:[0,12,36]}),lost=render({contactQuality:0});
    expect(brightness(gain.rgba)).toBeGreaterThan(brightness(base.rgba)*1.3);
    expect(brightness(far.rgba)).toBeGreaterThan(brightness(base.rgba));
    expect(brightness(lost.rgba)).toBeLessThan(brightness(base.rgba)*.1);
    expect(difference(render({depthMm:20}).rgba,base.rgba)).toBeGreaterThan(5);
    expect(render({contactQuality:1}).rgba).toEqual(base.rgba);
  });
  it('accepts gzip bytes and HTTP responses that were already decoded',async()=>{
    const compressed=readFileSync(resolve(root,reference.data));
    expect(Buffer.from(await decodeGzip(Uint8Array.from(compressed).buffer)).equals(Buffer.from(volume.data))).toBe(true);
    expect(Buffer.from(await decodeGzip(volume.data.slice().buffer)).equals(Buffer.from(volume.data))).toBe(true);
  });
  it('keeps device specifications separate from case origin calibration',()=>{
    expect(BF_UC180F_NOMINAL.forwardObliquityDeg).toBe(35);
    expect(BF_UC180F_NOMINAL.fieldOfViewDeg).toBe(80);
    expect(patientToEbusWeb(ebusWebToPatient([2,7,-4]))).toEqual([2,7,-4]);
    const origins=scopeOrigins([0,0,0],[0,0,1],[1,0,0],[0,1,0],{shaft:-6,depth:1,lateral:0});
    expect(origins.transducer).toEqual([0,0,0]);expect(origins.optical).toEqual([1,0,-6]);expect(origins.shaft).toEqual([0,0,-6]);
  });
});

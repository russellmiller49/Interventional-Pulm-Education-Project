import { useEffect, useState } from 'react';
import { acousticLabelAt, validateAcousticVolume, type AcousticPose, type AcousticVolume, type AcousticVolumeMetadata } from '@bronchoscopy-core/acoustic';
import { decodeGzip,isGzip } from '@bronchoscopy-core/compression';
import { ebusWebToPatient } from '@bronchoscopy-core/devices';
import { simulatorCaseAssetUrl } from './paths';
import { cephalicImageAxis, type SimulatorProbePose } from './pose';
import type { SimulatorCaseManifest, SimulatorPhysicsSnapshot, SimulatorSectorItem } from './types';

export function acousticPoseFromScope(pose:SimulatorProbePose):AcousticPose {
  // Convex-probe EBUS scans longitudinally along the shaft. The scope frame's
  // lateral axis is the plane normal, not the ultrasound image's horizontal axis.
  return {originLps:ebusWebToPatient(pose.position.toArray()),depthAxisLps:ebusWebToPatient(pose.depthAxis.toArray()),lateralAxisLps:ebusWebToPatient(cephalicImageAxis(pose).toArray())};
}
export function useAcousticVolume(caseData:SimulatorCaseManifest|null) {
  const [volume,setVolume]=useState<AcousticVolume|null>(null),[error,setError]=useState<string|null>(null);
  const ref=caseData?.assets.acoustic_volume;
  useEffect(()=>{
    setVolume(null);setError(null);
    if(!ref)return;
    const controller=new AbortController();
    void (async()=>{
      try {
        const [metadataResponse,dataResponse]=await Promise.all([fetch(simulatorCaseAssetUrl(ref.metadata),{signal:controller.signal}),fetch(simulatorCaseAssetUrl(ref.data),{signal:controller.signal})]);
        if(!metadataResponse.ok||!dataResponse.ok)throw new Error('Unable to load this case’s acoustic volume.');
        const metadata=await metadataResponse.json() as AcousticVolumeMetadata,compressed=await dataResponse.arrayBuffer();
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',compressed))).map(v=>v.toString(16).padStart(2,'0')).join('');
        if(digest!==(isGzip(new Uint8Array(compressed))?metadata.dataSha256:metadata.decodedSha256))throw new Error('Acoustic asset checksum mismatch.');
        const data=new Uint8Array(await decodeGzip(compressed));
        validateAcousticVolume(metadata,data,{assetVersion:ref.asset_version,sourceGeometrySha256:ref.source_geometry_sha256});
        if(!controller.signal.aborted)setVolume({metadata,data});
      } catch(reason) {if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Unable to read acoustic volume.');}
    })();
    return()=>controller.abort();
  },[ref]);
  return {volume,error};
}
/** Lightweight visibility sampling for 3D correlation and existing quest scoring. */
export function acousticSectorItems(volume:AcousticVolume,pose:SimulatorProbePose,caseData:SimulatorCaseManifest):SimulatorSectorItem[] {
  const frame=acousticPoseFromScope(pose),seen=new Map<number,{count:number;depth:number;lateral:number}>();
  const angle=caseData.render_defaults.sector_angle_deg*Math.PI/360,depth=caseData.render_defaults.max_depth_mm;
  for(let beam=0;beam<49;beam++) {
    const a=-angle+angle*2*beam/48,c=Math.cos(a),s=Math.sin(a);
    for(let d=.5;d<=depth;d+=.65) {
      const x=frame.originLps[0]+d*(frame.depthAxisLps[0]*c+frame.lateralAxisLps[0]*s),y=frame.originLps[1]+d*(frame.depthAxisLps[1]*c+frame.lateralAxisLps[1]*s),z=frame.originLps[2]+d*(frame.depthAxisLps[2]*c+frame.lateralAxisLps[2]*s);
      const id=acousticLabelAt(volume,x,y,z);
      if(id<3)continue;
      const value=seen.get(id)??{count:0,depth:0,lateral:0};value.count++;value.depth+=d*c;value.lateral+=d*s;seen.set(id,value);
    }
  }
  return [...seen].filter(([,v])=>v.count>=3).map(([id,v])=>{
    const label=volume.metadata.labels[id],listed=[...caseData.assets.stations,...caseData.assets.vessels].find(a=>a.key===label.key);
    return {id:label.key,label:listed?.label??label.label,kind:label.kind==='node'?'node':'vessel',color:listed?.color??'#94a3b8',depthMm:v.depth/v.count,lateralMm:v.lateral/v.count,visible:true} as SimulatorSectorItem;
  });
}
/** A reference image may be displayed only for the same geometry version and probe frame. */
export function physicsSnapshotMatchesPose(snapshot:SimulatorPhysicsSnapshot|null,caseData:SimulatorCaseManifest,pose:SimulatorProbePose):boolean {
  const metadata=snapshot?.metadata,asset=caseData.assets.acoustic_volume;
  if(!metadata||!asset||metadata.asset_version!==asset.asset_version||metadata.source_geometry_sha256!==asset.source_geometry_sha256)return false;
  if(!metadata.contact?.every(Number.isFinite)||Math.hypot(pose.position.x-metadata.contact[0],pose.position.y-metadata.contact[1],pose.position.z-metadata.contact[2])>.5)return false;
  const axes=[[pose.tangent,metadata.shaft_axis],[pose.depthAxis,metadata.depth_axis],[pose.lateralAxis,metadata.lateral_axis]] as const;
  return axes.every(([live,stored])=>{
    if(!stored||stored.length!==3||!stored.every(Number.isFinite))return false;
    const length=Math.hypot(...stored)*live.length();
    return length>1e-8&&Math.acos(Math.max(-1,Math.min(1,(live.x*stored[0]+live.y*stored[1]+live.z*stored[2])/length)))*180/Math.PI<.5;
  });
}

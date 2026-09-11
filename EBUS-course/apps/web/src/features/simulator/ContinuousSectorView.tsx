import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_ACOUSTIC_CONTROLS, type AcousticControls, type AcousticFrame, type AcousticVolume } from '@bronchoscopy-core/acoustic';
import { acousticPoseFromScope } from './acousticAdapter';
import { formatSimulatorStation } from './stationIds';
import { useCourseShellText } from '@/i18n/courseShell';
import type { SimulatorProbePose } from './pose';
import type { SimulatorCaseManifest, SimulatorPreset } from './types';

export function ContinuousSectorView({caseData,volume,error,pose,contactQuality,compact=false,assessment=false,onEnlarge,onShowAll,selectedPreset,activeStructure,setActiveStructure}:{caseData:SimulatorCaseManifest;volume:AcousticVolume|null;error:string|null;pose:SimulatorProbePose;contactQuality:number;compact?:boolean;assessment?:boolean;onEnlarge?:(()=>void)|null;onShowAll?:(()=>void)|null;selectedPreset:SimulatorPreset|null;activeStructure:string|null;setActiveStructure:(id:string|null)=>void}) {
  const t=useCourseShellText(),canvas=useRef<HTMLCanvasElement>(null),overlay=useRef<HTMLCanvasElement>(null),worker=useRef<Worker|null>(null),sequence=useRef(0),scheduled=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [controls,setControls]=useState<AcousticControls>({...DEFAULT_ACOUSTIC_CONTROLS,depthMm:caseData.render_defaults.max_depth_mm,sectorAngleDeg:caseData.render_defaults.sector_angle_deg});
  const [frozen,setFrozen]=useState(false),[teaching,setTeaching]=useState(false),[frame,setFrame]=useState<AcousticFrame|null>(null),[renderError,setRenderError]=useState<string|null>(null);
  const acousticPose=useMemo(()=>acousticPoseFromScope(pose),[pose]);
  const desired=useRef({pose:acousticPose,controls:{...controls,contactQuality},frozen});
  useEffect(()=>{desired.current={pose:acousticPose,controls:{...controls,contactQuality},frozen};},[acousticPose,controls,contactQuality,frozen]);
  useEffect(()=>{
    if(!volume)return;
    const instance=new Worker(new URL('../../../../../../src/lib/bronchoscopy-core/acoustic.worker.ts',import.meta.url),{type:'module'});
    worker.current=instance;
    instance.onmessage=event=>{if(event.data.id===sequence.current&&!desired.current.frozen)setFrame(event.data.frame);};
    instance.onerror=()=>setRenderError('Ultrasound rendering could not start. Reload to retry.');
    const data=volume.data.slice();instance.postMessage({type:'init',volume:{...volume,data}},[data.buffer]);
    instance.postMessage({type:'render',id:++sequence.current,...desired.current,width:384,height:384});
    return()=>{instance.terminate();worker.current=null;if(scheduled.current)clearTimeout(scheduled.current);scheduled.current=null;};
  },[volume]);
  useEffect(()=>{
    if(!worker.current||frozen||scheduled.current)return;
    scheduled.current=setTimeout(()=>{scheduled.current=null;if(!desired.current.frozen)worker.current?.postMessage({type:'render',id:++sequence.current,...desired.current,width:384,height:384});},33);
  },[acousticPose,controls,contactQuality,frozen]);
  useEffect(()=>{
    if(!frame||!canvas.current)return;
    const element=canvas.current;element.width=frame.width;element.height=frame.height;
    const ctx=element.getContext('2d');if(!ctx)return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.rgba),frame.width,frame.height),0,0);
    ctx.font='11px system-ui';ctx.fillStyle='#dce3e8';ctx.strokeStyle='#76838d';ctx.lineWidth=1;
    const half=frame.controls.sectorAngleDeg*Math.PI/360,radius=Math.min(frame.height*.86,frame.width*.46/Math.sin(half)),apexY=frame.height*.075;
    for(let mm=10;mm<=frame.controls.depthMm;mm+=10){const r=radius*mm/frame.controls.depthMm,x=frame.width/2+Math.sin(half)*r,y=apexY+Math.cos(half)*r;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+6,y);ctx.stroke();ctx.fillText(`${mm}`,x+8,y+4);}
  },[frame]);
  useEffect(()=>{
    const element=overlay.current;if(!element||!frame||!volume)return;
    element.width=frame.width;element.height=frame.height;const ctx=element.getContext('2d');if(!ctx)return;
    ctx.clearRect(0,0,frame.width,frame.height);if(!teaching||assessment)return;
    const colors=volume.metadata.labels.map(label=>label.kind==='node'?[110,210,110]:[80,170,245]);
    const image=ctx.createImageData(frame.width,frame.height);
    for(let i=0;i<frame.labelImage.length;i++){const id=frame.labelImage[i];if(id<3)continue;const c=colors[id],p=i*4;image.data[p]=c[0];image.data[p+1]=c[1];image.data[p+2]=c[2];image.data[p+3]=volume.metadata.labels[id].key===activeStructure?130:55;}
    ctx.putImageData(image,0,0);
  },[frame,volume,teaching,assessment,activeStructure]);
  const change=(key:'depthMm'|'gainDb',value:number)=>setControls(c=>({...c,[key]:value}));
  return <section className={`simulator-sector-pane${compact?' simulator-sector-pane--compact':''}`} aria-label={t('Continuous EBUS ultrasound')} data-sector-source="acoustic-volume" data-acoustic-version={volume?.metadata.assetVersion}>
    <div className="simulator-pane-header"><div><span className="eyebrow">{t('EBUS ultrasound')}</span><h2>{selectedPreset?`${t('Station')} ${formatSimulatorStation(selectedPreset.station)}`:t('Live scan')}</h2></div>
      <div className="simulator-sector-header-actions">{onEnlarge&&<button className="simulator-sector-style-toggle" onClick={onEnlarge}>{t('Enlarge')}</button>}{onShowAll&&<button className="simulator-sector-style-toggle" onClick={onShowAll}>{t('All views')}</button>}<button className="simulator-sector-style-toggle" aria-pressed={frozen} onClick={()=>setFrozen(!frozen)}>{t(frozen?'Resume':'Freeze')}</button></div>
    </div>
    <div className="simulator-continuous-ultrasound">
      <canvas ref={canvas} aria-label={t('Grayscale ultrasound image')}/><canvas ref={overlay} aria-hidden="true"/>
      {!frame&&<div className="simulator-ultrasound-message" role="status">{t(error??renderError??'Loading acoustic anatomy…')}</div>}
      {frame&&<div className="simulator-ultrasound-readout">{frozen?t('Frozen'):`${frame.controls.frequencyMHz} MHz`} · {frame.controls.depthMm} mm · {frame.controls.gainDb} dB</div>}
      {!frozen&&contactQuality<.45&&<div className="simulator-ultrasound-coupling" role="status">{t('Poor coupling — bring the transducer to the airway wall')}</div>}
    </div>
    <div className="simulator-ultrasound-controls">
      <label>{t('Depth')} {controls.depthMm} mm<input aria-label={t('Ultrasound depth')} disabled={frozen} type="range" min="15" max="70" step="1" value={controls.depthMm} onChange={e=>change('depthMm',Number(e.target.value))}/></label>
      <label>{t('Gain')} {controls.gainDb} dB<input aria-label={t('Ultrasound gain')} disabled={frozen} type="range" min="-18" max="24" step="1" value={controls.gainDb} onChange={e=>change('gainDb',Number(e.target.value))}/></label>
      {controls.tgcDb.map((value,index)=><label key={index}>{t(['Near TGC','Mid TGC','Far TGC'][index])}<input aria-label={['Near TGC','Mid TGC','Far TGC'][index]} disabled={frozen} type="range" min="-12" max="36" step="1" value={value} onChange={e=>setControls(c=>({...c,tgcDb:c.tgcDb.map((v,i)=>i===index?Number(e.target.value):v) as [number,number,number]}))}/></label>)}
      {!assessment&&<label className="simulator-ultrasound-teaching"><input type="checkbox" checked={teaching} onChange={e=>setTeaching(e.target.checked)}/>{t('Teaching color overlay')}</label>}
    </div>
    {!assessment&&!compact&&teaching&&frame&&volume&&<div className="simulator-ultrasound-structures">{frame.structures.map(s=>{const label=volume.metadata.labels[s.id];return <button key={s.id} aria-pressed={activeStructure===label.key} onClick={()=>setActiveStructure(activeStructure===label.key?null:label.key)}>{label.label}</button>;})}</div>}
  </section>;
}

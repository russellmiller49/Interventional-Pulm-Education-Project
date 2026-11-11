import type { LinkedRenderedFrame } from '../../../../../../src/lib/ebus-linked-contract';
import { ContactComparison } from '../../guided/ContactComparison';
import type { EbusWorkbenchConfig } from '../../../../../../src/lib/ebus-guided-bridge';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_ACOUSTIC_CONTROLS, type AcousticControls, type AcousticFrame, type AcousticVolume } from '@bronchoscopy-core/acoustic';
import { acousticPoseFromScope } from './acousticAdapter';
import { formatSimulatorStation } from './stationIds';
import { useCourseShellText } from '@/i18n/courseShell';
import type { SimulatorProbePose } from './pose';
import type { SimulatorCaseManifest, SimulatorPreset } from './types';
import { ImageDiscovery } from '../../guided/ImageDiscovery';
import { canDiscoverImage, imagePixelAt } from '../../guided/imageDiscoveryPixels';
import { ARTERY_KEYS, drawPulse, pulseRegion, pulseScale, structureOutline, type PulseRegion } from './sectorOverlays';

export function ContinuousSectorView({caseData,volume,error,pose,contactQuality,compact=false,assessment=false,onEnlarge,onShowAll,selectedPreset,activeStructure,setActiveStructure,guided}:{caseData:SimulatorCaseManifest;volume:AcousticVolume|null;error:string|null;pose:SimulatorProbePose;contactQuality:number;compact?:boolean;assessment?:boolean;onEnlarge?:(()=>void)|null;onShowAll?:(()=>void)|null;selectedPreset:SimulatorPreset|null;activeStructure:string|null;setActiveStructure:(id:string|null)=>void;guided?:{config:EbusWorkbenchConfig;targetKey:string;poseKey:string;onFrame:(frame:LinkedRenderedFrame)=>void;onAction:(name:string,apply:()=>void)=>void;onPick?:(pick:{near:string[];centerKey:string|null;centerLabel:string|null})=>void;outlined?:readonly string[]}}) {
  const t=useCourseShellText(),canvas=useRef<HTMLCanvasElement>(null),pulse=useRef<HTMLCanvasElement>(null),overlay=useRef<HTMLCanvasElement>(null),worker=useRef<Worker|null>(null),sequence=useRef(0),scheduled=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [controls,setControls]=useState<AcousticControls>({...DEFAULT_ACOUSTIC_CONTROLS,gainDb:guided?.config.initialGain ?? DEFAULT_ACOUSTIC_CONTROLS.gainDb,depthMm:guided?.config.initialDepth ?? caseData.render_defaults.max_depth_mm,sectorAngleDeg:caseData.render_defaults.sector_angle_deg});
  const [frozen,setFrozen]=useState(false),[teaching,setTeaching]=useState(false),[frame,setFrame]=useState<AcousticFrame|null>(null),[renderError,setRenderError]=useState<string|null>(null);
  const [baseline,setBaseline]=useState<{frame:AcousticFrame;id:string}|null>(null);
  const renderedSequence=useRef(0);
  const held = frozen || !!(guided?.config.linkedLesson && guided.config.locked);
  const acousticPose=useMemo(()=>acousticPoseFromScope(pose),[pose]);
  const desired=useRef({pose:acousticPose,controls:{...controls,contactQuality},frozen:held});
  useEffect(()=>{desired.current={pose:acousticPose,controls:{...controls,contactQuality},frozen:held};},[acousticPose,controls,contactQuality,held]);
  useEffect(()=>{
    if(!volume)return;
    const instance=new Worker(new URL('../../../../../../src/lib/bronchoscopy-core/acoustic.worker.ts',import.meta.url),{type:'module'});
    worker.current=instance;
    instance.onmessage=event=>{if(event.data.id===sequence.current&&!desired.current.frozen){renderedSequence.current=event.data.id;setFrame(event.data.frame);}};
    instance.onerror=()=>setRenderError('Ultrasound rendering could not start. Reload to retry.');
    const data=volume.data.slice();instance.postMessage({type:'init',volume:{...volume,data}},[data.buffer]);
    instance.postMessage({type:'render',id:++sequence.current,...desired.current,width:384,height:384});
    return()=>{instance.terminate();worker.current=null;if(scheduled.current)clearTimeout(scheduled.current);scheduled.current=null;};
  },[volume]);
  useEffect(()=>{
    if(!worker.current||held||scheduled.current)return;
    scheduled.current=setTimeout(()=>{scheduled.current=null;if(!desired.current.frozen)worker.current?.postMessage({type:'render',id:++sequence.current,...desired.current,width:384,height:384});},33);
  },[acousticPose,controls,contactQuality,held]);
  useEffect(()=>{
    if(!frame||!canvas.current)return;
    const element=canvas.current;element.width=frame.width;element.height=frame.height;
    const ctx=element.getContext('2d');if(!ctx)return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.rgba),frame.width,frame.height),0,0);
    ctx.font='11px system-ui';ctx.fillStyle='#dce3e8';ctx.strokeStyle='#76838d';ctx.lineWidth=1;
    const half=frame.controls.sectorAngleDeg*Math.PI/360,radius=Math.min(frame.height*.86,frame.width*.46/Math.sin(half)),apexY=frame.height*.075;
    for(let mm=10;mm<=frame.controls.depthMm;mm+=10){const r=radius*mm/frame.controls.depthMm,x=frame.width/2+Math.sin(half)*r,y=apexY+Math.cos(half)*r;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+6,y);ctx.stroke();ctx.fillText(`${mm}`,x+8,y+4);}
    // Orientation dot, as on the processor: it sits on the proximal (cephalad) side of the image,
    // which is image right here because the lateral axis is `cephalicImageAxis`.
    ctx.fillStyle='#35d06a';ctx.beginPath();ctx.arc(frame.width/2+frame.width*.07,apexY+frame.height*.012,frame.width*.013,0,Math.PI*2);ctx.fill();
  },[frame]);
  useEffect(()=>{
    const element=overlay.current;if(!element||!frame||!volume)return;
    element.width=frame.width;element.height=frame.height;const ctx=element.getContext('2d');if(!ctx)return;
    ctx.clearRect(0,0,frame.width,frame.height);
    const w=frame.width,h=frame.height,labels=volume.metadata.labels;
    if(teaching&&!assessment){
      const colors=labels.map(label=>label.kind==='node'?[110,210,110]:[80,170,245]);
      const image=ctx.createImageData(w,h);
      for(let i=0;i<frame.labelImage.length;i++){const id=frame.labelImage[i];if(id<3)continue;const c=colors[id],p=i*4;image.data[p]=c[0];image.data[p+1]=c[1];image.data[p+2]=c[2];image.data[p+3]=labels[id].key===activeStructure?130:55;}
      ctx.putImageData(image,0,0);
    }
    if(!guided||guided.config.demonstration)return;
    const alongAirway=guided.config.linkedVariant==='along-airway';
    // The advance-and-withdraw task: a dashed line marks the middle the node is brought to, and the
    // node found in the rotation task is outlined so it can be followed across the image.
    if(alongAirway){ctx.strokeStyle='rgba(255,255,147,.85)';ctx.lineWidth=2;ctx.setLineDash([7,6]);ctx.beginPath();ctx.moveTo(w/2,h*.11);ctx.lineTo(w/2,h*.93);ctx.stroke();ctx.setLineDash([]);}
    // Every structure the learner has already found stays outlined and numbered, in the order it
    // was found, so it can be followed as the plane moves. Nothing is marked before it is found.
    const found=guided.outlined??[];
    const marks=[...found.map((key,index)=>({key,number:index+1})),...(alongAirway&&!found.includes(guided.targetKey)?[{key:guided.targetKey,number:0}]:[])];
    for(const mark of marks){
      const id=labels.findIndex(label=>label.key===mark.key);if(id<3)continue;
      const outline=structureOutline(frame.labelImage,w,h,id);if(!outline)continue;
      const colour=labels[id].kind==='node'?'rgba(120,230,140,.95)':labels[id].kind==='blood'?'rgba(125,195,255,.95)':'rgba(255,205,125,.95)';
      ctx.fillStyle=colour;
      for(const i of outline.edge)ctx.fillRect((i%w)-.5,Math.floor(i/w)-.5,2,2);
      if(!mark.number)continue;
      const [ax,ay]=outline.anchor,x=Math.min(w-15,Math.max(15,ax)),y=Math.min(h-15,Math.max(15,ay));
      ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fillStyle='rgba(6,22,28,.88)';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=colour;ctx.stroke();
      ctx.fillStyle='#f4fbfa';ctx.font='700 17px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(mark.number),x,y+1);
    }
  },[frame,volume,teaching,assessment,activeStructure,guided?.config.linkedVariant,guided?.config.demonstration,guided?.targetKey,guided?.outlined]);
  // Arterial pulsation, drawn on its own canvas above the frame: each artery in view widens a
  // little about its own centre with every beat. The frame, its labels and its id are untouched.
  // Still when the image is held or frozen, when there is no tissue window, and for a viewer who
  // asks for reduced motion.
  useEffect(()=>{
    const element=pulse.current;if(!element)return;
    const ctx=element.getContext('2d');
    if(ctx)ctx.clearRect(0,0,element.width,element.height);
    if(!ctx||!frame||!volume||held||contactQuality<.45)return;
    if(typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const w=frame.width,h=frame.height;
    const regions:PulseRegion[]=[];
    for(const structure of frame.structures){
      if(!ARTERY_KEYS.includes(volume.metadata.labels[structure.id]?.key))continue;
      const region=pulseRegion(frame.labelImage,w,h,structure.id);if(region)regions.push(region);
    }
    if(!regions.length)return;
    element.width=w;element.height=h;
    const image=ctx.createImageData(w,h);
    let request=0;
    const draw=(now:number)=>{
      image.data.fill(0);
      const scale=pulseScale(now);
      if(scale>1.0005)for(const region of regions)drawPulse(frame.rgba,frame.labelImage,w,h,region,scale,image.data);
      ctx.putImageData(image,0,0);
      element.dataset.pulseScale=scale.toFixed(4);
      request=window.requestAnimationFrame(draw);
    };
    element.dataset.pulseArteries=String(regions.length);
    request=window.requestAnimationFrame(draw);
    return()=>{window.cancelAnimationFrame(request);delete element.dataset.pulseArteries;delete element.dataset.pulseScale;};
  },[frame,volume,held,contactQuality]);
  // A click on the image reports the structure under it and within a few pixels of it, so the
  // lesson can ask the learner to find a structure on ultrasound. Nothing is named on screen here.
  const pickCallback = useRef(guided?.onPick);
  useEffect(() => { pickCallback.current = guided?.onPick; }, [guided?.onPick]);
  const picking = !!guided?.onPick;
  useEffect(() => {
    const element = canvas.current;
    if (!element || !frame || !volume || !picking) return;
    const click = (event: MouseEvent) => {
      const pixel = imagePixelAt(event.clientX, event.clientY, element.getBoundingClientRect(), frame);
      if (!pixel) return;
      const labels = volume.metadata.labels, near = new Set<string>(), reach = Math.max(2, Math.round(frame.width / 64));
      for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
        const x = pixel.x + dx, y = pixel.y + dy;
        if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) continue;
        const id = frame.labelImage[y * frame.width + x];
        if (id >= 3 && labels[id]) near.add(labels[id].key);
      }
      const center = labels[frame.labelImage[pixel.y * frame.width + pixel.x]];
      const named = center && frame.labelImage[pixel.y * frame.width + pixel.x] >= 3 ? center : null;
      pickCallback.current?.({ near: [...near], centerKey: named?.key ?? null, centerLabel: named?.label ?? null });
    };
    element.addEventListener('click', click);
    element.style.cursor = 'crosshair';
    return () => { element.removeEventListener('click', click); element.style.cursor = ''; };
  }, [frame, volume, picking]);
  // For browser tests of the pick task: where each structure's pixels sit in the current frame, as
  // fractions of the image. An attribute only; nothing on screen names a structure.
  const labelCentroids = useMemo(() => {
    if (!picking || !frame || !volume) return undefined;
    const sums = new Map<number, [number, number, number]>();
    for (let i = 0; i < frame.labelImage.length; i++) {
      const id = frame.labelImage[i];
      if (id < 3) continue;
      const entry = sums.get(id) ?? [0, 0, 0];
      entry[0] += i % frame.width; entry[1] += Math.floor(i / frame.width); entry[2] += 1;
      sums.set(id, entry);
    }
    const out: Record<string, [number, number]> = {};
    for (const [id, [sx, sy, n]] of sums) {
      if (n < 40) continue;
      // The centroid of a crescent can fall outside it: use the structure's own pixel nearest to it.
      const cx = sx / n, cy = sy / n;
      let best = Infinity, bx = cx, by = cy;
      for (let i = 0; i < frame.labelImage.length; i++) {
        if (frame.labelImage[i] !== id) continue;
        const x = i % frame.width, y = Math.floor(i / frame.width), d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d < best) { best = d; bx = x; by = y; }
      }
      out[volume.metadata.labels[id].key] = [(bx + 0.5) / frame.width, (by + 0.5) / frame.height];
    }
    return JSON.stringify(out);
  }, [picking, frame, volume]);
  const frameCallback = useRef(guided?.onFrame);
  useEffect(() => { frameCallback.current = guided?.onFrame; }, [guided?.onFrame]);
  const frameId = useMemo(() => {
    if (!frame) return '';
    let value = 2166136261;
    for (const byte of frame.rgba) value = Math.imul(value ^ byte, 16777619) >>> 0;
    const signature = JSON.stringify([frame.pose,frame.controls]);
    for (let i=0;i<signature.length;i++) value = Math.imul(value ^ signature.charCodeAt(i),16777619) >>> 0;
    return `${volume?.metadata.sourceGeometrySha256.slice(0,12)}:${value.toString(16)}`;
  }, [frame,volume]);
  const poseKey = guided?.poseKey ?? '';
  const targetKey = guided?.targetKey ?? '';
  useEffect(() => {
    const targetId = volume?.metadata.labels.findIndex(l => l.key === targetKey) ?? -1;
    const samePose = frame && JSON.stringify(frame.pose) === JSON.stringify(acousticPose);
    if (samePose && !baseline && guided?.config.linkedLesson === 'acoustic-contact' && frame) setBaseline({frame,id:frameId});
    // Where the target sits across this frame (0 = image left, 1 = image right): the mean column
    // of its own pixels in the frame's label image. Null when too little of it is in the image.
    let targetLateral: number | null = null;
    if (frame && targetId >= 3) {
      let sum = 0, count = 0;
      for (let i = 0; i < frame.labelImage.length; i++) if (frame.labelImage[i] === targetId) { sum += i % frame.width; count += 1; }
      if (count >= 40) targetLateral = (sum / count + 0.5) / frame.width;
    }
    frameCallback.current?.({ targetLateral, renderSequence: renderedSequence.current, pose:frame?.pose, settings:frame?.controls, baselineFrameId:baseline?.id, ready: !!samePose && frame?.controls.depthMm === controls.depthMm && frame?.controls.gainDb === controls.gainDb && frame?.controls.contactQuality === contactQuality && !error && !renderError, targetVisible: !!frame && frame.structures.some(s => s.id === targetId), depth: controls.depthMm, gain: controls.gainDb, frozen:held, poseKey, frameId });
  }, [frame, volume, acousticPose, controls.depthMm, controls.gainDb, frozen, poseKey, targetKey, error, renderError, contactQuality, held, frameId, baseline, guided?.config.linkedLesson]);
  const allowed = (control:'depth'|'gain'|'freeze') => !guided || (!guided.config.locked && guided.config.controls.includes(control));
  const act = (control:'depth'|'gain'|'freeze', apply:()=>void) => { if (!allowed(control)) return; if (guided) guided.onAction(control,apply); else apply(); };
  const change=(key:'depthMm'|'gainDb',value:number)=>act(key === 'depthMm' ? 'depth' : 'gain',()=>setControls(c=>({...c,[key]:value})));
  const discover = canDiscoverImage(guided?.config, assessment) && !!volume && !!frame && !error && !renderError;
  return <section className={`simulator-sector-pane${compact?' simulator-sector-pane--compact':''}`} aria-label={t('Continuous EBUS ultrasound')} data-sector-source="acoustic-volume" data-label-centroids={labelCentroids} data-acoustic-version={volume?.metadata.assetVersion} data-frame-id={frameId} data-frame-pose={frame ? JSON.stringify(frame.pose) : undefined}>
    <div className="simulator-pane-header"><div><span className="eyebrow">{t('EBUS ultrasound')}</span><h2>{held && guided?.config.linkedLesson ? 'Your image' : baseline ? 'Initial and current' : selectedPreset?`${t('Station')} ${formatSimulatorStation(selectedPreset.station)}`:t('Live scan')}</h2></div>
      <div className="simulator-sector-header-actions">{onEnlarge&&<button className="simulator-sector-style-toggle simulator-pane-layout-toggle" onClick={onEnlarge}>{t('Enlarge')}</button>}{onShowAll&&<button className="simulator-sector-style-toggle simulator-pane-layout-toggle" onClick={onShowAll}>{t('All views')}</button>}{/* A guided lab that was not given the freeze control does not show one (EBUS-PRE-REVIEW-02,
          L14-4). It used to render permanently disabled in every guided lab, since none of them
          include `freeze`, which reads as a broken button rather than an absent capability. The
          standalone simulator is unchanged: it always allows freezing and always shows it. */}
      {(!guided || guided.config.controls.includes('freeze')) && <button className="simulator-sector-style-toggle" aria-pressed={frozen} disabled={!allowed('freeze')} onClick={()=>act('freeze',()=>setFrozen(!frozen))}>{t(frozen?'Resume':'Freeze')}</button>}</div>
    </div>
    <div className="simulator-continuous-ultrasound">
      <canvas ref={canvas} aria-label={t('Grayscale ultrasound image')}/><canvas ref={pulse} aria-hidden="true" data-pulse-layer style={{pointerEvents:'none'}}/><canvas ref={overlay} aria-hidden="true" data-outline-layer style={{pointerEvents:'none'}}/>
      {volume && <ImageDiscovery canvas={canvas} image={frame} labels={volume.metadata.labels} enabled={discover} />}
      {!frame&&<div className="simulator-ultrasound-message" role="status">{t(error??renderError??'Loading acoustic anatomy…')}</div>}
      {frame&&<span data-orientation-dot style={{position:'absolute',width:1,height:1,overflow:'hidden',clipPath:'inset(50%)',whiteSpace:'nowrap'}}>{t('Green orientation dot at the upper right: the proximal (cephalad) side of the image.')}</span>}
      {frame&&<div className="simulator-ultrasound-readout">{held?t('Frozen'):`${frame.controls.frequencyMHz} MHz`} · {frame.controls.depthMm} mm · {frame.controls.gainDb} dB</div>}
      {!held&&contactQuality<.45&&<div className="simulator-ultrasound-coupling" role="status">{t('Poor coupling — bring the transducer to the airway wall')}</div>}
    </div>
    {discover && <p className="guided-label">Hover or tap the image to name a structure. Focus the image and use the arrow keys to explore.</p>}
    <div className="simulator-ultrasound-controls">
      <label>{t('Depth')} {controls.depthMm} mm<input aria-label={t('Ultrasound depth')} disabled={frozen || !allowed('depth')} type="range" min="15" max="70" step="1" value={controls.depthMm} onChange={e=>change('depthMm',Number(e.target.value))}/></label>
      <label>{t('Gain')} {controls.gainDb} dB<input aria-label={t('Ultrasound gain')} disabled={frozen || !allowed('gain')} type="range" min="-18" max="24" step="1" value={controls.gainDb} onChange={e=>change('gainDb',Number(e.target.value))}/></label>
      {!guided && controls.tgcDb.map((value,index)=><label key={index}>{t(['Near TGC','Mid TGC','Far TGC'][index])}<input aria-label={['Near TGC','Mid TGC','Far TGC'][index]} disabled={frozen} type="range" min="-12" max="36" step="1" value={value} onChange={e=>setControls(c=>({...c,tgcDb:c.tgcDb.map((v,i)=>i===index?Number(e.target.value):v) as [number,number,number]}))}/></label>)}
      {!assessment&&<label className="simulator-ultrasound-teaching"><input type="checkbox" checked={teaching} onChange={e=>setTeaching(e.target.checked)}/>{t('Teaching color overlay')}</label>}
    </div>
    {baseline && frame && volume && <ContactComparison baseline={baseline.frame} current={frame} volume={volume} />}
    {!assessment&&!compact&&teaching&&frame&&volume&&<div className="simulator-ultrasound-structures">{frame.structures.map(s=>{const label=volume.metadata.labels[s.id];return <button key={s.id} aria-pressed={activeStructure===label.key} onClick={()=>setActiveStructure(activeStructure===label.key?null:label.key)}>{label.label}</button>;})}</div>}
  </section>;
}

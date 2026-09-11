#!/usr/bin/env python3
"""Export native CT teaching slices in an isolated Slicer process.

BRANCH_TRACING_CT_SOURCE must point to the matching original NRRD (read-only).
BRANCH_TRACING_ROOT is this worktree. No scene/source files are saved or changed.
Launch with --no-main-window --disable-settings --ignore-slicerrc --python-script.
"""
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import traceback
import zlib

import numpy as np
import slicer
import vtk


def digest(data):
    return hashlib.sha256(data).hexdigest()


def png(pixels):
    height, width = pixels.shape
    def chunk(name, payload):
        return struct.pack('>I',len(payload))+name+payload+struct.pack('>I',zlib.crc32(name+payload)&0xffffffff)
    scan = b''.join(b'\0'+row.tobytes() for row in pixels)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,0,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')


def sample(points, distance):
    for a,b in zip(points,points[1:]):
        length=float(np.linalg.norm(b-a))
        if distance<=length:
            return a+(b-a)*(distance/max(length,1e-9))
        distance-=length
    return points[-1]


def main():
    root=Path(os.environ['BRANCH_TRACING_ROOT'])
    source=Path(os.environ['BRANCH_TRACING_CT_SOURCE'])
    author=json.loads((root/'scripts/branch-tracing/authoring/ct-traces.json').read_text())
    assert digest(source.read_bytes())==author['sourceSha256'], 'Unexpected CT source'
    graph_raw=(root/'public/fluoroview/cases/patient-new/metadata/airway_graph.json').read_bytes()
    assert digest(graph_raw)==author['graphSha256'], 'Unexpected graph source'
    graph=json.loads(graph_raw)
    edges={e['id']:e for e in graph['edges']}
    volume=slicer.util.loadVolume(str(source), {'name':'BranchTracing_export_working_copy'})
    ct=slicer.util.arrayFromVolume(volume)
    matrix=vtk.vtkMatrix4x4(); volume.GetIJKToRASMatrix(matrix)
    ijk_ras=np.array([[matrix.GetElement(i,j) for j in range(4)] for i in range(4)])
    ijk_lps=np.diag([-1,-1,1,1])@ijk_ras
    assert ct.shape==(636,512,512)
    assert np.allclose(ijk_lps[:3,:3],np.diag([.689453125,.689453125,.5]),atol=1e-9)
    lps_ijk=np.linalg.inv(ijk_lps)
    out=root/'public/branch-tracing/native-v1'
    out.mkdir(parents=True,exist_ok=True)
    (out/'axial').mkdir(exist_ok=True)
    assets=[]
    # Native axial acquisition planes; no through-plane interpolation or invented HU.
    slices=range(240,476)
    for k in slices:
        pixels=np.rint(np.clip((ct[k].astype(np.float64)+1000)/1400,0,1)*255).astype(np.uint8)
        data=png(pixels)
        path=f'axial/{k:03}.png'
        (out/path).write_bytes(data)
        assets.append({'path':path,'bytes':len(data),'sha256':digest(data)})
    traces=[]
    for spec in author['traces']:
        parts=[edges[i] for i in spec['edges']]
        assert all(a['endNodeId']==b['startNodeId'] for a,b in zip(parts,parts[1:]))
        points=np.array([p for j,e in enumerate(parts) for p in e['pointsLps'][int(j>0):]])
        length=float(np.linalg.norm(np.diff(points,axis=0),axis=1).sum())
        start=spec['trimStartMm']
        focus=sample(points,start+(length-start)*.52)
        # A compact native-pixel crop centers the complete tracing region. Full CT remains available.
        ijk=(lps_ijk@np.r_[focus,1])[:3]
        center=[round(float(ijk[0]),4),round(float(ijk[1]),4)]
        checkpoints=[]
        for number,fraction in enumerate(spec.get("fractions", [.08,.48,.90])):
            point=sample(points,start+(length-start)*fraction)
            ijk=(lps_ijk@np.r_[point,1])[:3]
            k=int(round(ijk[2])); x=int(round(ijk[0])); y=int(round(ijk[1]))
            assert spec['range'][0]<=k<=spec['range'][1], (spec['id'], k)
            # Record measured pixel intensity for author review; never silently snap a trace.
            hu=int(ct[k,y,x])
            checkpoints.append({'id':f'point-{number+1}','slice':k,'pixel':[round(float(ijk[0]),4),round(float(ijk[1]),4)],'lps':[round(float(v),4) for v in point],'sourceHu':hu})
        anchor=sample(points,start)
        anchor_ijk=(lps_ijk@np.r_[anchor,1])[:3]
        spec['range']=[min(spec['range'][0],int(round(anchor_ijk[2]))-2),max(spec['range'][1],int(round(anchor_ijk[2]))+2)]
        pose_distance=max(start,length*.15)
        position=sample(points,pose_distance)
        target=sample(points,min(length,pose_distance+6))
        traces.append({**{k:spec[k] for k in ['id','preset','region','range']},'cropCenter':center,'cropSize':190,'anchor':{'slice':int(round(anchor_ijk[2])),'pixel':[round(float(anchor_ijk[0]),4),round(float(anchor_ijk[1]),4)]},'checkpoints':checkpoints,'scopePositionLps':position.tolist(),'scopeDirectionLps':((target-position)/np.linalg.norm(target-position)).tolist()})
    result={'schema':'branch-tracing-native/v1','sourceSha256':author['sourceSha256'],'sourceGraphSha256':author['graphSha256'],'sourceCaseCount':1,'slicerVersion':slicer.app.applicationVersion,'sizeXyz':[512,512,636],'spacingXyzMm':[.689453125,.689453125,.5],'ijkToLps':ijk_lps.tolist(),'exportedSliceRange':[240,475],'windowHu':[-1000,400],'review':'Source-derived geometric comparison. Clinical labels and camera poses are not assessment keys.','traces':traces,'assets':assets}
    # Exactly match repository formatting before hashing/reviewing generated JSON.
    formatted=subprocess.run([str(root/'node_modules/.bin/prettier'),'--stdin-filepath',str(out/'manifest.json')],input=json.dumps(result).encode(),stdout=subprocess.PIPE,check=True,cwd=root).stdout
    (out/'manifest.json').write_bytes(formatted)
    review={'slicerVersion':slicer.app.applicationVersion,'sourceSha256':author['sourceSha256'],'nativeRoundTripMaxErrorMm':float(np.abs(ijk_lps@lps_ijk-np.eye(4)).max()),'sourceHuAtCheckpoints':{t['id']:[c['sourceHu'] for c in t['checkpoints']] for t in traces},'sliceCount':len(assets),'sliceBytes':sum(a['bytes'] for a in assets)}
    (root/'docs/bronchial-branch-tracing/native-export-review.json').write_text(json.dumps(review,indent=2)+'\n')
    print('BRANCH_TRACING_EXPORT',json.dumps(review),flush=True)


try:
    main(); slicer.util.exit(0)
except Exception:
    traceback.print_exc(); slicer.util.exit(1)

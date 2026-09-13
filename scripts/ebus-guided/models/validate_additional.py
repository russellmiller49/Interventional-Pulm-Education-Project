"""Validate optimized A3-A6 geometry against the shared analytic contract in Blender."""
import bpy
import hashlib
import json
import math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
CASE=ROOT/'EBUS-course/apps/web/public/simulator/case-001'
OUT=CASE/'models/guided-v2'
contract=json.loads((OUT/'model-contract.json').read_text())
manifest=json.loads((OUT/'asset-manifest.json').read_text())
rows=[]
for asset in manifest['assets']:
    path=OUT/asset['path']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==asset['sha256']
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(path))
    names={o.name for o in bpy.context.scene.objects}
    assert all(o['id'] in names for o in asset['objects'])
    points=[]
    for o in bpy.context.scene.objects:
        if o.type!='MESH':continue
        assert o.get('semanticId')==o.name
        for v in o.data.vertices:
            p=o.matrix_world@v.co
            points.append([p.x*1000,p.z*1000,-p.y*1000])
    assert points and all(math.isfinite(c) for p in points for c in p)
    row={'path':asset['path'],'sha256':asset['sha256'],'vertices':len(points),'boundsWebMm':[[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]]}
    if asset['path']=='measurement-phantoms.glb':
        worst=0
        for shape,parts in contract['phantoms'].items():
            for i,part in enumerate(parts):
                o=bpy.data.objects[shape+'_'+str(i)]
                for v in o.data.vertices:
                    p=o.matrix_world@v.co
                    web=[p.x*1000,p.z*1000,-p.y*1000]
                    normalized=sum(((web[k]-part['center'][k])/part['radii'][k])**2 for k in range(3))
                    worst=max(worst,abs(normalized-1))
        assert worst<.00001,worst
        row['maxEllipsoidEquationResidual']=worst
    if asset['path']=='ebus-needle-assembly.glb':
        assert bpy.data.objects['needle_tip'].parent.name=='needle_motion'
        assert bpy.data.objects['needle_handle'].parent.name=='handle_motion'
        assert bpy.data.objects['sheath'].parent.name=='sheath_motion'
        tip=bpy.data.objects['needle_tip'].matrix_world.translation
        web=Vector((tip.x*1000,tip.z*1000,-tip.y*1000))
        err=(web-Vector(contract['needle']['retractedTip'])).length
        assert err<.001,err
        row['tipAnchorErrorMm']=err
    rows.append(row)
for dep in manifest['dependencies']:
    assert hashlib.sha256((CASE/dep['path']).read_bytes()).hexdigest()==dep['sha256']
assert hashlib.sha256((OUT/'model-contract.json').read_bytes()).hexdigest()==manifest['contractSha256']
proof={'revision':contract['revision'],'assets':rows,'totalBytes':sum(a['bytes'] for a in manifest['assets']),
    'semanticHierarchy':'preserved through optimization','coordinates':'Blender (L,P,S) meters -> glTF (L,S,-P) meters -> browser mm once',
    'dependencies':'Phase 1 anatomy and nodes unchanged; same target coordinates for both route views',
    'clinicalAnatomicalReview':'pending','deviceValidation':'generic conceptual model, no device-specific claims'}
(OUT/'geometry-validation.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof,indent=2))

"""Course-authored A3-A6 Blender sources; GLB coordinates in meters, runtime in mm.
Run Blender --background --factory-startup --python this_file.py.
"""
import bpy
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scripts'))
from local_data import local_data_path
CASE = ROOT / 'EBUS-course/apps/web/public/simulator/case-001'
OUT = CASE / 'models/guided-v2'
NATIVE = local_data_path('raw-assets', 'ebus-guided-models', 'additional')
OUT.mkdir(parents=True, exist_ok=True)
NATIVE.mkdir(parents=True, exist_ok=True)
assets = []

def xyz(p): return Vector((p[0]/1000, -p[2]/1000, p[1]/1000))
def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def mat(name, color, alpha=1):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, alpha)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, alpha)
    p.inputs['Roughness'].default_value = .42
    p.inputs['Alpha'].default_value = alpha
    return m

def semantic(o, name, label, role='structure'):
    o.name = name
    o['semanticId'], o['label'], o['role'] = name, label, role
    o['sourceType'] = 'course-authored conceptual geometry'
    o['reviewStatus'] = 'faculty review pending'
    return o

def sphere(name, center, radii, material, label=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=xyz(center))
    o = bpy.context.object
    o.scale = (radii[0]/1000, radii[2]/1000, radii[1]/1000)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth = True
    return semantic(o, name, label or name.replace('_',' '))

def box(name, center, size, material, label=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(center))
    o=bpy.context.object
    o.scale=(size[0]/1000,size[2]/1000,size[1]/1000)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    return semantic(o,name,label or name.replace('_',' '))

def tube(name,a,b,r,material,label=None):
    a,b=xyz(a),xyz(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r/1000,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object
    o.rotation_mode='QUATERNION'
    o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    return semantic(o,name,label or name.replace('_',' '))

def group(name,objects):
    o=bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(o)
    for child in objects: child.parent=o
    return semantic(o,name,name.replace('_',' '),'pivot')

def export(name,notes):
    bpy.ops.wm.save_as_mainfile(filepath=str(NATIVE/(name+'.blend')))
    path=OUT/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_yup=True,
        export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
    assets.append({'path':path.name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'objects':[{'id':o.name,'label':o.get('label'),'role':o.get('role')} for o in bpy.context.scene.objects],
        'triangles':sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons),
        'units':'m','notes':notes,'reviewStatus':'faculty review pending'})

reset()
steel=mat('steel',(.6,.72,.8)); blue=mat('control_blue',(.12,.4,.65)); teal=mat('active_teal',(.1,.74,.67))
wall=mat('airway_wall',(.73,.42,.36),.36); tissue=mat('example_tissue',(.65,.55,.83)); vessel=mat('vessel_red',(.75,.18,.24))
sheath=mat('sheath',(.84,.86,.8),.5); dark=mat('scope_body',(.1,.15,.22),.45)
# A compressed longitudinal diagram, not a scaled commercial needle or endoscope.
tube('mount_connector',[-59,-8,0],[-50,-8,0],4,blue,'Mount / connector')
box('sheath_adjuster',[-44,-8,0],[10,10,10],blue,'Sheath adjuster')
box('sheath_lock',[-43,-1,0],[4,4,5],teal,'Sheath lock')
box('extension_stop',[-63,-8,0],[3,13,13],teal,'Needle extension stop')
handle=tube('needle_handle',[-81,-8,0],[-65,-8,0],4,blue,'Needle handle')
stylet=tube('stylet',[-90,-8,0],[-72,-8,0],.45,steel,'Stylet, shown seated')
group('handle_motion',[handle,stylet])
tube('suction_connection',[-84,-8,0],[-81,-8,0],2,blue,'Optional suction connection')
box('working_channel_cutaway',[-28,-5,0],[35,7,7],dark,'Cutaway working channel')
tube('channel_outlet',[-12,-8,0],[-6,2.392,0],1.7,dark,'Working-channel outlet')
# All distal movement is along a single axis registered to the outlet.
a=Vector((-10,-4,0)); d=Vector((.5,math.sqrt(3)/2,0)); end=a+d*8
s=tube('sheath',a,end,1.05,sheath,'Sheath'); group('sheath_motion',[s])
needle_end=end-d
needle=tube('needle_shaft',a,needle_end,.24,steel,'Needle shaft')
needle['fixedBaseWebMm']=list(a)
needle['spanMm']=7
tube('protected_needle_in_channel',[-42,-5,0],a,.24,steel,'Protected proximal needle, cutaway')
tip=sphere('needle_tip',needle_end,[.33,.33,.33],steel,'True needle tip (teaching view)')
group('needle_motion',[needle,tip])
sphere('transducer',[0,1,0],[5,1.8,3.5],teal,'Transducer')
box('airway_wall',[5,8,0],[54,3,20],wall,'Airway wall')
sphere('target_node',[6,23,0],[10,8,6],tissue,'Example node')
tube('adjacent_vessel',[25,15,-12],[25,15,12],4,vessel,'Adjacent vessel')
export('ebus-needle-assembly','Generic compressed assembly, not device CAD. Distal needle + sheath share an outlet axis. No prescribed extension, force, or puncture safety result.')

reset()
teal=mat('transducer_teal',(.12,.7,.68)); wall=mat('wall',(.78,.46,.4)); fluid=mat('fluid',(.25,.66,.91),.32)
node=mat('node',(.61,.5,.8)); white=mat('reflector',(.88,.86,.75)); air=mat('air',(.85,.94,1),.45)
box('scope_tip',[0,-5,0],[16,9,14],mat('scope',(.12,.17,.23)),'Scope tip')
box('transducer',[0,0,0],[12,2,10],teal,'Transducer')
sphere('fluid_balloon',[0,2.5,0],[10,6,8],fluid,'Fluid-filled balloon')
box('air_gap',[0,4,0],[20,2,18],air,'Air gap')
sphere('air_bubble',[0,5,0],[2.5,2,3],air,'Air bubble in contact window')
box('airway_wall',[0,8,0],[46,4,22],wall,'Airway wall')
box('cartilage',[13,8,0],[8,4.5,22],white,'Cartilage')
sphere('target_node',[0,23,0],[10,8,7],node,'Example node')
sphere('calcified_focus',[0,20,0],[2,2,2],white,'Calcified focus')
export('acoustic-contact-cutaway','Qualitative local contact/artifact illustration. No inflation volume, contact pressure, or clinically realistic intensity model.')

phantoms = {
 'sphere':[{'center':[0,22,0],'radii':[10,10,10]}],
 'ellipsoid':[{'center':[0,22,0],'radii':[16,8,10]}],
 'adjacent':[{'center':[-12,21,0],'radii':[8,7,8]},{'center':[10,24,2],'radii':[7,9,7]}],
 'lobulated':[{'center':[-5,21,0],'radii':[10,8,8]},{'center':[6,24,1],'radii':[9,8,7]}]
}
reset()
for name,parts in phantoms.items():
    m=mat(name,(.48,.55,.8))
    objects=[]
    for i,p in enumerate(parts):
        objects.append(sphere(name+'_'+str(i),p['center'],p['radii'],m,'Phantom surface'))
    group('phantom_'+name,objects)
export('measurement-phantoms','Four analytic authored shapes. Lobulated surface is a union of overlapping ellipsoids. Dimensions are phantom mm, not clinical-image calibration. Runtime displays one group at a time.')

# Preserve same-frame source anatomy for the route model, without any route-based movement of targets.
reset()
bpy.ops.import_scene.gltf(filepath=str(CASE/'models/guided-v1/mediastinum-teaching.glb'))
bpy.ops.import_scene.gltf(filepath=str(CASE/'models/guided-v1/node-examples.glb'))
def center_web(o):
    pts=[o.matrix_world@v.co for v in o.data.vertices]
    p=sum(pts,Vector())/len(pts)
    return Vector((p.x*1000,p.z*1000,-p.y*1000))
objects={o.name:o for o in bpy.context.scene.objects if o.type=='MESH'}
eso=objects['esophagus']
verts=[o for o in (eso.matrix_world@v.co for v in eso.data.vertices)]
eso_points=[Vector((p.x*1000,p.z*1000,-p.y*1000)) for p in verts]
airway=[p for name,o in objects.items() if name in ['trachea','carina','left_main_bronchus','right_main_bronchus'] for p in [center_web(o)]]
route_records=[]
for station,name in [('4L','node_station_4l'),('7','node_station_7')]:
    target=center_web(objects[name])
    nearby=[p for p in eso_points if abs(p.y-target.y)<3]
    ep=sum(nearby,Vector())/len(nearby)
    ap=min(airway,key=lambda p:(p-target).length)
    route_records.append({'id':station,'nodeId':name,'target':list(target),'airway':list(ap),'esophageal':list(ep),'source':'existing same-frame example node; derived orientation locators, not validated sampling windows'})
# A lower paraesophageal tissue example is explicitly authored, never passed into existing acoustic labels.
y=min(p.y for p in eso_points)+60
nearby=[p for p in eso_points if abs(p.y-y)<4]
ep=sum(nearby,Vector())/len(nearby)
lower=ep+Vector((12,0,0))
for o in list(bpy.context.scene.objects): bpy.data.objects.remove(o,do_unlink=True)
teal=mat('esophageal',(.1,.72,.67)); blue=mat('airway',(.18,.53,.84)); node=mat('lower_example',(.67,.54,.8))
for r in route_records:
    sphere('airway_window_'+r['id'],r['airway'],[2.5]*3,blue,'Airway orientation locator')
    sphere('esophageal_window_'+r['id'],r['esophageal'],[2.5]*3,teal,'Esophageal orientation locator')
sphere('node_station_8_authored',lower,[7,8,6],node,'Authored lower paraesophageal example')
sphere('esophageal_window_8',ep,[2.5]*3,teal,'Lower esophageal orientation locator')
route_records.append({'id':'8','nodeId':'node_station_8_authored','target':list(lower),'airway':None,'esophageal':list(ep),'source':'course-authored lower paraesophageal example; station assignment and locator require faculty review'})
export('eus-b-route-locators','Same web-mm anatomy frame as Phase 1. Locators indicate viewing direction, not a safe needle trajectory. Station 9 and interlobar EUS-B windows are explicitly unsupported.')
contract={'revision':'additional-models-v1','units':'authored mm; glTF meters converted once',
    'needle':{'outlet':list(end),'axis':list(d),'retractedTip':list(needle_end),'maxTravel':22,'sliceHalfThickness':.6,'note':'Travel and dimensions are illustrative, never a clinical extension recommendation.'},
    'phantoms':phantoms,'routes':route_records,
    'unsupportedWindows':['9','10/11 via EUS-B','4R via EUS-B'],
    'reviewStatus':'development, faculty/clinical review pending'}
(OUT/'model-contract.json').write_text(json.dumps(contract,indent=2)+'\n')
manifest={'version':'additional-models-v1','assets':assets,'contractSha256':hashlib.sha256((OUT/'model-contract.json').read_bytes()).hexdigest(),
    'dependencies':[{'path':'models/guided-v1/'+n,'sha256':hashlib.sha256((CASE/'models/guided-v1'/n).read_bytes()).hexdigest()} for n in ['mediastinum-teaching.glb','node-examples.glb']],
    'sourceGeometrySha256':hashlib.sha256((CASE/'models/simplified_sim_model.glb').read_bytes()).hexdigest(),
    'lighting':'runtime neutral lights; no baked textures','collision':'no navigation/physics collision; geometric plane and boundary tests only'}
(OUT/'asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Built',len(assets),'additional model packages')

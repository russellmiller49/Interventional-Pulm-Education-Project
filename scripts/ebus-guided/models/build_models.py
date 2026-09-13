"""Build Phase 1 display assets with Blender. Run from an isolated --factory-startup process.

Anatomy retains every source triangle. Native .blend files stay in Local-Data.
The browser uses meters converted to the existing web-mm frame exactly once.
"""
import hashlib
import json
import math
from pathlib import Path
import re
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))
from local_data import local_data_path

CASE = ROOT / "EBUS-course/apps/web/public/simulator/case-001"
OUT = CASE / "models/guided-v1"
NATIVE = local_data_path("raw-assets", "ebus-guided-models", "phase-1")
MANIFEST = json.loads((CASE / "case_manifest.simplified.web.json").read_text())
AUDIT = json.loads((NATIVE / "source-audit.json").read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def web_point(blender_point):
    p = blender_point
    return [1000 * p.x, 1000 * p.z, -1000 * p.y]


def blender_point(web_mm):
    x, y, z = web_mm
    return Vector((x / 1000, -z / 1000, y / 1000))


def key(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def empty(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    return obj


def material(name, rgb, metallic=0, alpha=1):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, alpha)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, alpha)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = .4
    bsdf.inputs["Alpha"].default_value = alpha
    return mat


def semantic(obj, ident, role, label, source_type="derived-display"):
    obj.name = ident
    for k, value in {"semanticId": ident, "role": role, "label": label, "sourceType": source_type,
                     "reviewStatus": "pending", "caseId": "case-001"}.items():
        obj[k] = value


def export_asset(name, objects, source_type, notes):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT / name), export_format="GLB", use_selection=True,
                              export_yup=True, export_extras=True, export_animations=False,
                              export_cameras=False, export_lights=False)
    mesh_objects = [o for o in objects if o.type == "MESH"]
    row = {"id": name.removesuffix(".glb"), "path": name, "version": 1, "sourceType": source_type,
           "bytes": (OUT / name).stat().st_size, "sha256": digest(OUT / name),
           "triangles": sum(len(p.vertices) - 2 for o in mesh_objects for p in o.data.polygons),
           "materials": len({m.name for o in mesh_objects for m in o.data.materials if m}),
           "objects": [{"id": o.name, "role": o.get("role"), "label": o.get("label")} for o in objects],
           "units": "m", "gltfToWebMm": "multiply scene coordinates by 1000", "compression": "none; no extra decoder",
           "reviewStatus": "pending", "rightsStatus": "existing project assets or course-authored geometry; owner release review pending",
           "notes": notes}
    return row


def sample(polyline, s):
    lengths, points = polyline["cumulative_lengths_mm"], polyline["points"]
    for i in range(1, len(lengths)):
        if lengths[i] >= s:
            t = (s - lengths[i-1]) / max(1e-9, lengths[i] - lengths[i-1])
            return Vector(points[i-1]).lerp(Vector(points[i]), t)
    return Vector(points[-1])


def capsule(name, center, dimensions, mat, parent, role="device", label=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=blender_point(center))
    obj = bpy.context.object
    # dimensions are given in glTF/web axes, not Blender axes.
    obj.scale = (dimensions[0] / 2000, dimensions[2] / 2000, dimensions[1] / 2000)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj.parent = parent
    semantic(obj, name, role, label or name, "authored-illustration")
    return obj


def tube(name, a, b, radius, mat, parent, role="device", label=None):
    start, end = blender_point(a), blender_point(b)
    delta = end - start
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius/1000, depth=delta.length, location=(start+end)/2)
    obj = bpy.context.object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj.parent = parent
    semantic(obj, name, role, label or name, "authored-illustration")
    return obj


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    NATIVE.mkdir(parents=True, exist_ok=True)
    source_path = CASE / "models/simplified_sim_model.glb"
    assert digest(source_path) == AUDIT["sourceGeometrySha256"]
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(source_path))
    imported = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    # Bake hierarchy transforms without modifying source positions or triangulation.
    for obj in imported:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.data.transform(world)
        obj.matrix_world = Matrix.Identity(4)
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    anatomy_root = empty("mediastinum_root")
    anatomy_root["sourceGeometrySha256"] = AUDIT["sourceGeometrySha256"]
    anatomy_root["coordinates"] = "glTF x=L y=S z=-P, meters; native Blender x=L y=P z=S, meters"
    node_root = empty("node_examples_root")
    node_root["role"] = "example nodes; not anatomical station compartments"
    lines = json.loads((CASE / "geometry/centerlines.json").read_text())["polylines"]
    split_s = next(s / 4 for s in range(240, 520) if (sample(lines[0], s/4) - sample(lines[8], s/4)).length >= 2)
    carina = (sample(lines[0], split_s) + sample(lines[8], split_s)) / 2
    airway = next(o for o in imported if o.name.lower() == "airway")
    positions = [v.co.copy() for v in airway.data.vertices]
    grouped = {}
    for polygon in airway.data.polygons:
        center = sum((Vector(web_point(positions[i])) for i in polygon.vertices), Vector()) / len(polygon.vertices)
        if (center-carina).length < 10:
            ident = "carina"
        elif center.y > carina.y:
            ident = "trachea"
        elif center.x < carina.x and center.y > 1200:
            ident = "right_main_bronchus"
        elif center.x >= carina.x and center.y > 1188:
            ident = "left_main_bronchus"
        else:
            ident = "distal_airway_branches"
        grouped.setdefault(ident, []).append(tuple(polygon.vertices))
    anatomy = [anatomy_root]
    nodes = [node_root]
    for ident, faces in grouped.items():
        used = sorted({i for face in faces for i in face})
        remap = {old: new for new, old in enumerate(used)}
        mesh = bpy.data.meshes.new(ident)
        mesh.from_pydata([positions[i] for i in used], [], [[remap[i] for i in face] for face in faces])
        mesh.materials.append(airway.data.materials[0])
        obj = bpy.data.objects.new(ident, mesh)
        bpy.context.collection.objects.link(obj)
        obj.parent = anatomy_root
        semantic(obj, ident, "airway", ident.replace("_", " "))
        obj["partitionMethod"] = "Display face partition using centerline split and authored main-bronchus cut levels; anatomical extent review pending. No source triangles moved."
        anatomy.append(obj)
    bpy.data.objects.remove(airway, do_unlink=True)
    for obj in imported:
        if obj == airway:
            continue
        ident = key(obj.name)
        if ident.startswith("station_"):
            obj.parent = node_root
            station = ident.removeprefix("station_")
            semantic(obj, "node_" + ident, "node", "Example node " + station.upper())
            obj["nodeId"] = ident + "_node_a"
            obj["stationId"] = station.upper()
            nodes.append(obj)
        else:
            obj.parent = anatomy_root
            role = "esophagus" if ident == "esophagus" else "heart" if any(v in ident for v in ["atrium", "ventricle", "appendage"]) else "vessel"
            semantic(obj, ident, role, obj.name.replace("_", " "))
            anatomy.append(obj)
    # Use an actual source mesh vertex on the anterior portion of the azygos arch.
    azygos = next(o for o in anatomy if o.name == "azygous")
    pts = [Vector(web_point(v.co)) for v in azygos.data.vertices]
    anterior = max(p.z for p in pts)
    arch_lower = min((p for p in pts if p.z > anterior - 6), key=lambda p: p.y)
    landmarks = [
        {"id": "carina", "label": "Main carina", "positionWebMm": list(carina), "sourceType": "centerline-derived", "method": "First main-route separation of 2 mm; locator requires anatomical review"},
        {"id": "right_main_bronchus", "label": "Right main bronchus", "positionWebMm": list(sample(lines[8],125)), "sourceType": "centerline-derived"},
        {"id": "left_main_bronchus", "label": "Left main bronchus", "positionWebMm": list(sample(lines[0],125)), "sourceType": "centerline-derived"},
        {"id": "azygos_arch", "label": "Azygos arch", "positionWebMm": list(arch_lower), "sourceType": "source-mesh-derived", "method": "Inferior vertex among anterior arch vertices; boundary interpretation requires review"},
    ]
    for ident in ["superior_vena_cava", "left_brachiocephalic_vein", "aorta", "esophagus", "pulmonary_artery"]:
        obj = next(o for o in anatomy if o.name == ident)
        center = sum((Vector(web_point(v.co)) for v in obj.data.vertices), Vector()) / len(obj.data.vertices)
        landmarks.append({"id": ident, "label": obj["label"], "positionWebMm": list(center), "sourceType": "source-mesh-centroid"})
    assets = [export_asset("mediastinum-teaching.glb", anatomy, "derived-display", "Every source anatomy triangle retained. Airway semantic partitions are display aids, not new segmentation authority."),
              export_asset("node-examples.glb", nodes, "derived-display", "Existing modeled tissue volumes. Node instance and station identity remain separate.")]
    # Open wire landmarks, deliberately not opaque anatomical compartment volumes.
    aid_root = empty("draft_boundary_aids_root")
    aid_root["reviewOnly"] = True
    amber = material("review_amber", (.95, .67, .25))
    aids = [aid_root]
    for ident, point, width, depth in [("carina_level", carina, 55, 34), ("azygos_lower_level", arch_lower, 34, 32)]:
        x, y, z = point
        corners = [(x-width/2,y,z-depth/2),(x+width/2,y,z-depth/2),(x+width/2,y,z+depth/2),(x-width/2,y,z+depth/2)]
        for i in range(4):
            obj = tube(ident + "_" + str(i), corners[i], corners[(i+1)%4], .3, amber, aid_root, "draft-boundary", ident.replace("_"," "))
            obj["reviewOnly"] = True
            aids.append(obj)
    assets.append(export_asset("station-regions.review.glb", aids, "authored-review-aid", "Open boundary-level frames only; not validated IASLC compartment surfaces. Default off and excluded from task answer overlays."))
    bpy.ops.wm.save_as_mainfile(filepath=str(NATIVE / "mediastinum-teaching.blend"))
    # The scope uses the SAME legacy tip shape and fan anchor. Added parts are conceptual.
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(CASE / "models/device/EBUS_tip.glb"))
    tip_meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    anchor = Vector(MANIFEST["assets"]["scope_model"]["fan_apex_anchor_point"])
    scale = MANIFEST["assets"]["scope_model"]["scale_mm_per_unit"]
    root = empty("scope_root")
    root["localAxes"] = "+X proximal/image-cephalic, +Y scan depth, +Z sector normal; meters"
    distal = empty("distal_frame", root)
    rig = [root, distal]
    for obj in tip_meshes:
        world = obj.matrix_world.copy()
        for v in obj.data.vertices:
            old = world @ v.co
            local_gltf = Vector((old.x, old.z, -old.y))
            v.co = blender_point((local_gltf-anchor)*scale)
        obj.parent = distal
        obj.matrix_world = Matrix.Identity(4)
        semantic(obj, "legacy_distal_body", "distal-body", "Existing calibrated distal body")
        rig.append(obj)
    black = material("housing_graphite", (.15,.20,.24), .15)
    blue = material("lens_blue", (.15,.65,.88), .5)
    teal = material("transducer_teal", (.15,.8,.7), .25)
    silver = material("metal_silver", (.6,.66,.7), .8)
    balloon = material("balloon_translucent", (.55,.85,.92), alpha=.18)
    rig += [capsule("optical_lens", [6,5.5,0], [2.4,1,2.4], blue, distal, "optical", "Optical lens locator"),
            capsule("transducer_face", [0,5.5,0], [8,1,5], teal, distal, "transducer", "Active transducer surface locator"),
            capsule("balloon", [0,4.5,0], [11,6,8], balloon, distal, "balloon", "Illustrative balloon envelope"),
            tube("channel_outlet", [7,1.5,0], [5,2.4,0], .8, silver, distal, "channel", "Working-channel outlet, illustrative"),
            tube("retracted_needle", [10,1.1,0], [7,1.5,0], .25, silver, distal, "retracted-needle", "Retracted needle, illustrative")]
    bending = empty("bending_pivot", root)
    rig.append(bending)
    for i in range(8):
        rig.append(tube("bending_ring_" + str(i), [7.2+i*2.3,1.2,0], [9+i*2.3,1.2,0], 3.1, black, bending, "bending", "Bending section"))
    proximal = empty("proximal_frame", root)
    rig.append(proximal)
    rig.append(tube("insertion_shaft", [25.6,1.2,0], [158,1.2,0], 3.1, black, proximal, "shaft", "Illustrative shortened insertion shaft"))
    handle = empty("handle_frame", proximal)
    rig.append(handle)
    rig.append(capsule("control_body", [187,-2,0], [65,27,23], black, handle, "handle", "Conceptual control body"))
    lever = empty("angulation_lever_pivot", handle)
    rig.append(lever)
    lever.location = blender_point([177,10,0])
    lever_mesh = tube("angulation_lever", [177,10,0], [170,23,0], 2.5, silver, lever, "lever", "Angulation lever")
    lever_mesh.location -= lever.location
    rig.append(lever_mesh)
    rig.append(tube("instrument_port", [166,-10,0], [153,-21,0], 3, black, handle, "port", "Instrument port"))
    for ident, point in [("transducer_origin",[0,0,0]),("optical_origin",[6,0,0]),("needle_outlet_origin",[5,2.4,0])]:
        obj=empty(ident, distal);obj.location=blender_point(point);obj["role"]="coordinate-anchor";rig.append(obj)
    assets.append(export_asset("ebus-scope-teaching.glb", rig, "derived-and-authored", "Legacy distal geometry and fan anchor preserved. Lens/port locators, balloon, shortened shaft and control body are illustrative; not device CAD or a needle simulator."))
    bpy.ops.wm.save_as_mainfile(filepath=str(NATIVE / "ebus-scope-teaching.blend"))
    device = {"schema":"ebus-device-geometry/v1","profile":"bf_uc180f optical profile with illustrative teaching parts",
              "optics":MANIFEST["endoscope_camera"],"fan":MANIFEST["ultrasound_probe"],
              "originalTipSha256":digest(CASE / "models/device/EBUS_tip.glb"),"originalAnchor":list(anchor),"originalScaleMmPerUnit":scale,
              "localFrame":"+X cephalicImageAxis; +Y depthAxis; +Z cross(cephalicImageAxis,depthAxis)",
              "gltfUnits":"m","localOrigin":"existing virtual fan apex; illustrative physical surface locator offset +5.5 mm along local depth",
              "pivotsWebLocalMm":{"bendingStart":[7.2,1.2,0],"proximalStart":[25.6,1.2,0],"angulationLever":[177,10,0]},"rigAnchors":{"transducer":[0,0,0],"optical":[6,0,0],"needleOutlet":[5,2.4,0]},
              "surfaceLocators":"Illustrative external colored surfaces; calibrated optical and sector origins remain unchanged inside the source housing.",
              "opticalPlacement":"Runtime optical ray uses resolveScopeFrame / resolveCalibratedOpticalAxis and the original manifest offsets.",
              "limits":["Added mechanical dimensions are authored illustrations, not IFU tolerances.","Original insertion channel/contact mechanics are unchanged.","Needle is retracted and noninteractive in Phase 1."],"reviewStatus":"pending"}
    transforms = {"schema":"ebus-case-transforms/v1","units":"mm","lpsToWeb":AUDIT["lpsToWeb"],"rasToWeb":AUDIT["rasToWeb"],
                  "gltfToWeb":[[1000,0,0,0],[0,1000,0,0],[0,0,1000,0],[0,0,0,1]],
                  "blenderToWeb":[[1000,0,0,0],[0,0,1000,0],[0,-1000,0,0],[0,0,0,1]],
                  "referenceCtRegistration":"not established to relocated presentation geometry; no linked clinical CT",
                  "sourceCtIjkToRas":AUDIT["ct"]["ijkToRas"]}
    for name,data in [("device-geometry.json",device),("case-transforms.json",transforms),("landmarks.json",{"schema":"ebus-landmarks/v1","reviewStatus":"pending","landmarks":landmarks})]:
        (OUT/name).write_text(json.dumps(data,indent=2)+"\n")
    result = {"schema":"ebus-teaching-assets/v1","version":"guided-models-1","caseId":"case-001",
              "sourceGeometrySha256":AUDIT["sourceGeometrySha256"],"acousticVersion":MANIFEST["asset_version"],
              "acousticDataSha256":digest(CASE / MANIFEST["assets"]["acoustic_volume"]["data"]),
              "centerlineSha256":digest(CASE / MANIFEST["assets"]["centerlines"]),"presetManifestSha256":digest(CASE / "case_manifest.simplified.web.json"),
              "lessons":["scope-orientation","acoustic-contact","ct-map","station-seven","right-paratracheal"],
              "reviewStatus":"pending","assets":assets,"localizer":"section of the same acoustic label volume; not CT or predicted echogenicity",
              "nativeSources":"Local-Data/raw-assets/ebus-guided-models/phase-1", "blenderVersion":bpy.app.version_string}
    (OUT/"asset-manifest.json").write_text(json.dumps(result,indent=2)+"\n")
    print("EBUS_GUIDED_BUILD",json.dumps({"assets":len(assets),"bytes":sum(a["bytes"] for a in assets),"landmarks":len(landmarks),"carina":list(carina),"azygosLower":list(arch_lower)}))


main()

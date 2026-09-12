"""Author synthetic wall-attached lesions in Blender; no clinical images are embedded.

Blender --background --factory-startup --python scripts/airway-abnormalities/build-assets.py
Local axes: X circumferential, Y distal, Z inward. The wall attachment is Z=0.
Runtime scales these normalized assets in patient-LPS millimeters. No histology is implied.
"""
import hashlib
import json
import math
import random
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector, noise

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/bronchoscopy-abnormalities"
AUTHORING = ROOT / "artifacts/airway-abnormalities"
OUT.mkdir(parents=True, exist_ok=True)
AUTHORING.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def sphere(name, center, radius, sculpt=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=40, location=center)
    obj = bpy.context.object
    obj.name = name
    for v in obj.data.vertices:
        p = v.co.copy()
        n = noise.noise_vector(p * 3.1, noise_basis="PERLIN_ORIGINAL")[0]
        lobes = math.sin(p.x * 8 + p.z * 2) * math.cos(p.y * 7 - p.z * 3)
        v.co = Vector((p.x * radius[0], p.y * radius[1], p.z * radius[2])) * (1 + sculpt * (n * .4 + lobes * .6))
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


assets = []
for kind in ["obstructing", "polypoid", "mucosal"]:
    bpy.ops.object.select_all(action="DESELECT")
    if kind == "polypoid":
        crown = sphere(kind, (0, 0, .62), (.55, .53, .45), .045)
        stem = sphere("attachment", (.03, .06, .18), (.25, .24, .45))
        crown.select_set(True)
        stem.select_set(True)
        bpy.context.view_layer.objects.active = crown
        bpy.ops.object.join()
        obj = crown
        remesh = obj.modifiers.new("Joined stalk", "REMESH")
        remesh.mode = "VOXEL"
        remesh.voxel_size = .024
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        smooth = obj.modifiers.new("Smooth attachment", "SMOOTH")
        smooth.factor = 1.3
        smooth.iterations = 6
        bpy.ops.object.modifier_apply(modifier=smooth.name)
        decimate = obj.modifiers.new("Browser budget", "DECIMATE")
        decimate.ratio = .32
        bpy.ops.object.modifier_apply(modifier=decimate.name)
    elif kind == "obstructing":
        obj = sphere(kind, (0, 0, .23), (.69, .75, .48), .035)
        pieces = [obj]
        rng = random.Random(49)
        for i in range(15):
            angle = i * 2.39996
            ring = .18 + .45 * math.sqrt((i + .5) / 15)
            x, y = math.cos(angle)*ring, math.sin(angle)*ring
            z = .35 + .30 * math.sqrt(max(0, 1 - (ring/.8)**2))
            r = rng.uniform(.20, .31)
            pieces.append(sphere("lobule", (x, y, z), (r, r*rng.uniform(.85,1.2), r), .035))
        for piece in pieces:
            piece.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.join()
        remesh = obj.modifiers.new("Continuous lobulated surface", "REMESH")
        remesh.mode = "VOXEL"
        remesh.voxel_size = .020
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        smooth = obj.modifiers.new("Tissue transitions", "SMOOTH")
        smooth.factor = 1.0
        smooth.iterations = 3
        bpy.ops.object.modifier_apply(modifier=smooth.name)
        decimate = obj.modifiers.new("Browser budget", "DECIMATE")
        decimate.ratio = .32
        bpy.ops.object.modifier_apply(modifier=decimate.name)
    else:
        obj = sphere(kind, (0, 0, .35), (.72, .78, .66), .035)

    # Consistent, documented dimensions and outward winding for exact-mesh collision.
    points = [v.co.copy() for v in obj.data.vertices]
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    for v in obj.data.vertices:
        v.co.x = 2 * (v.co.x - lo[0]) / (hi[0] - lo[0]) - 1
        v.co.y = 2 * (v.co.y - lo[1]) / (hi[1] - lo[1]) - 1
        v.co.z = 1.18 * (v.co.z - lo[2]) / (hi[2] - lo[2]) - .18
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    assert all(e.is_manifold for e in bm.edges), kind
    bm.to_mesh(obj.data)
    bm.free()
    for p in obj.data.polygons:
        p.use_smooth = True

    colors = obj.data.color_attributes.new(name="Tissue", type="FLOAT_COLOR", domain="POINT")
    for v, c in zip(obj.data.vertices, colors.data):
        x, y, z = v.co
        n = noise.noise_vector(v.co * 4.7, noise_basis="PERLIN_ORIGINAL")[0]
        detail = noise.noise_vector(v.co * 22.0, noise_basis="PERLIN_ORIGINAL")[1]
        if kind == "obstructing":
            base = (.38 + .12*n, .09 + .035*n, .068 + .028*n)
            patch = min(math.sqrt((x+.30)**2+(y+.72)**2+(z-.50)**2),
                        math.sqrt((x-.48)**2+(y-.15)**2+(z-.62)**2))
            blend = max(0, min(1, (.34 + n*.20 - patch) / .10))
            blend = blend*blend*(3-2*blend)
            cream = (.48+.05*n, .34+.04*n, .19+.03*n)
            base = tuple(b*(1-blend)+c*blend for b,c in zip(base,cream))
        elif kind == "polypoid":
            vessel = max(0, 1-abs(math.sin(x*9 + math.sin(y*4)*1.5 + z*3))/.15)
            base = (.44 + n*.07, .13 + n*.04, .11 + n*.03)
            base = tuple(b*(1-vessel*.36) for b in base)
        else:
            base = (.37 + n*.11, .074 + n*.045, .06 + n*.025)
        c.color = (*[max(.01, b + detail*.018) for b in base], 1)
    mat = bpy.data.materials.new(kind + "_wet_tissue")
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    vertex = mat.node_tree.nodes.new("ShaderNodeVertexColor")
    vertex.layer_name = "Tissue"
    mat.node_tree.links.new(vertex.outputs["Color"], shader.inputs["Base Color"])
    shader.inputs["Roughness"].default_value = .24
    obj.data.materials.append(mat)
    obj["provenance"] = "Original synthetic educational model; visual references supplied by owner, 2026-09-11"
    obj["axes"] = "X circumferential; Y distal; Z into lumen; wall Z=0"
    obj["units"] = "normalized; scaled to authored mm at runtime"
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    target = OUT / (kind + ".glb")
    bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLB", use_selection=True,
        export_yup=False, export_normals=True, export_extras=True, export_materials="EXPORT")
    assets.append({"id": kind, "file": target.name, "vertices": len(obj.data.vertices),
        "triangles": len(obj.data.polygons), "closed": True, "bytes": target.stat().st_size,
        "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})

bpy.ops.wm.save_as_mainfile(filepath=str(AUTHORING / "airway-abnormalities.blend"))
(OUT / "manifest.json").write_text(json.dumps({
    "schema": "bronchoscopy-abnormalities/v1", "authored": "2026-09-11",
    "provenance": "Original synthetic meshes. Supplied stills and video used for visual study only; no source media redistributed.",
    "coordinateSystem": "normalized lesion-local XYZ; X circumferential, Y distal, Z inward",
    "bounds": {"x": [-1, 1], "y": [-1, 1], "z": [-.18, 1]},
    "clinicalValidation": "Not clinically validated. Morphology does not establish histology.",
    "assets": assets,
}, indent=2) + "\n")
print(json.dumps(assets, indent=2))

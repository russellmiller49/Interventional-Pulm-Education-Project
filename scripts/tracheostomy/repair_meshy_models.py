"""Repair and optimize user-supplied tracheostomy GLBs for the web module.

The original exports are intentionally left untouched. This script:

- flattens imported transforms and normalizes each asset around the origin;
- welds coincident geometry, removes loose vertices, and recalculates normals;
- applies a conservative per-asset triangle budget;
- downsizes oversized embedded textures while preserving aspect ratio;
- preserves source/license metadata as exported glTF extras; and
- writes a machine-readable manifest alongside the repaired GLBs.

Run with Blender, not system Python:

  blender --background --python scripts/tracheostomy/repair_meshy_models.py -- \
    "3D assets/Tracheostomy" public/tracheostomy/models
"""

from __future__ import annotations

import hashlib
import json
import sys
from dataclasses import dataclass
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector


@dataclass(frozen=True)
class AssetConfig:
    output_name: str
    display_name: str
    target_triangles: int
    texture_limit: int
    role: str
    attribution: str | None = None
    source_url: str | None = None
    license_name: str | None = None
    strip_emission: bool = False
    strip_normal_map: bool = False
    learner_facing: bool = False


ASSETS: dict[str, AssetConfig] = {
    "Patient.glb": AssetConfig(
        output_name="patient-context.glb",
        display_name="Patient positioning context",
        target_triangles=78_000,
        texture_limit=1024,
        role="Reviewed authoring reference; not a precise internal anatomy reference.",
        strip_emission=True,
    ),
    "Pilot balloon.glb": AssetConfig(
        output_name="pilot-balloon.glb",
        display_name="Pilot balloon and inflation line",
        target_triangles=18_000,
        texture_limit=1024,
        role=(
            "Source-repaired review asset only; the generated valve/disc geometry remains "
            "semantically unreliable and is excluded from learner-facing views."
        ),
        strip_emission=True,
        strip_normal_map=True,
        learner_facing=False,
    ),
    "cuffed_tracheostomy_tube.glb": AssetConfig(
        output_name="cuffed-tube.glb",
        display_name="Cuffed tracheostomy tube",
        target_triangles=82_000,
        texture_limit=1024,
        role="Reviewed authoring reference; fused geometry prevents component animation.",
        strip_emission=True,
        strip_normal_map=True,
    ),
    "cuffless tracheostomy.glb": AssetConfig(
        output_name="cuffless-tube.glb",
        display_name="Cuffless tracheostomy tube",
        target_triangles=62_000,
        texture_limit=1024,
        role="Reviewed authoring reference; not used in the segmented animation.",
        strip_emission=True,
        strip_normal_map=True,
    ),
    "inner cannula.glb": AssetConfig(
        output_name="inner-cannula.glb",
        display_name="Removable inner cannula",
        target_triangles=42_000,
        texture_limit=1024,
        role="Reviewed authoring reference; hub details remain illustrative.",
        strip_emission=True,
        strip_normal_map=True,
    ),
    "larynx_with_muscles_and_ligaments.glb": AssetConfig(
        output_name="larynx-anatomy.glb",
        display_name="Larynx with muscles and ligaments",
        target_triangles=165_000,
        texture_limit=1024,
        role="Reviewed orientation reference; not registered to the procedural tube geometry.",
        attribution="University of Dundee School of Medicine",
        source_url=(
            "https://sketchfab.com/3d-models/"
            "larynx-with-muscles-and-ligaments-3b247ff11b104e24acbb1c453f5bad46"
        ),
        license_name="CC BY-NC-SA 4.0",
    ),
    "obterator.glb": AssetConfig(
        output_name="obturator.glb",
        display_name="Insertion obturator",
        target_triangles=18_000,
        texture_limit=1024,
        role=(
            "Source-repaired review asset only; the generated handle and curvature do not match "
            "the supplied tubes and are excluded from learner-facing views."
        ),
        strip_emission=True,
        strip_normal_map=True,
        learner_facing=False,
    ),
}


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(collection):
            if datablock.users == 0:
                collection.remove(datablock)


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def triangle_count(objects: list[bpy.types.Object]) -> int:
    return sum(len(poly.vertices) - 2 for obj in objects for poly in obj.data.polygons)


def flatten_transforms(objects: list[bpy.types.Object]) -> None:
    for obj in objects:
        world_matrix = obj.matrix_world.copy()
        obj.data.transform(world_matrix)
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)


def geometry_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [vertex.co for obj in objects for vertex in obj.data.vertices]
    if not points:
        raise RuntimeError("Imported asset contains no vertices")
    minimum = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    maximum = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    return minimum, maximum


def normalize_geometry(objects: list[bpy.types.Object]) -> tuple[float, tuple[float, float, float]]:
    minimum, maximum = geometry_bounds(objects)
    center = (minimum + maximum) * 0.5
    dimensions = maximum - minimum
    max_dimension = max(dimensions)
    if max_dimension <= 0:
        raise RuntimeError("Imported asset has zero-size bounds")
    scale = 2.0 / max_dimension
    for obj in objects:
        for vertex in obj.data.vertices:
            vertex.co = (vertex.co - center) * scale
        obj.data.update()
    return scale, tuple(round(value, 6) for value in dimensions)


def clean_mesh(obj: bpy.types.Object, weld_distance: float = 0.00001) -> None:
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=weld_distance)
    loose_vertices = [vertex for vertex in bm.verts if not vertex.link_faces]
    if loose_vertices:
        bmesh.ops.delete(bm, geom=loose_vertices, context="VERTS")
    if bm.faces:
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.validate(clean_customdata=True)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True


def decimate(objects: list[bpy.types.Object], target_triangles: int) -> float:
    current = triangle_count(objects)
    if current <= target_triangles:
        return 1.0
    ratio = max(0.05, min(1.0, target_triangles / current))
    for obj in objects:
        if len(obj.data.polygons) < 200:
            continue
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        modifier = obj.modifiers.new(name="Web triangle budget", type="DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
    return ratio


def resize_images(texture_limit: int) -> list[dict[str, object]]:
    report: list[dict[str, object]] = []
    for image in bpy.data.images:
        width, height = image.size
        if width <= 0 or height <= 0:
            continue
        original = [width, height]
        if max(width, height) > texture_limit:
            factor = texture_limit / max(width, height)
            width = max(1, round(width * factor))
            height = max(1, round(height * factor))
            image.scale(width, height)
            image.pack()
        report.append({"name": image.name, "original": original, "optimized": [width, height]})
    return report


def simplify_materials(config: AssetConfig) -> None:
    for material in bpy.data.materials:
        if material.node_tree:
            principled = next(
                (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
                None,
            )
            if principled and config.strip_emission:
                emission = principled.inputs.get("Emission Color") or principled.inputs.get("Emission")
                if emission:
                    for link in list(emission.links):
                        material.node_tree.links.remove(link)
                    emission.default_value = (0.0, 0.0, 0.0, 1.0)
            if principled and config.strip_normal_map:
                normal = principled.inputs.get("Normal")
                if normal:
                    for link in list(normal.links):
                        material.node_tree.links.remove(link)
        material.use_backface_culling = config.license_name is None


def add_metadata(config: AssetConfig, source: Path, objects: list[bpy.types.Object]) -> None:
    root = bpy.data.objects.new(config.display_name, None)
    bpy.context.scene.collection.objects.link(root)
    root["source_file"] = source.name
    root["display_name"] = config.display_name
    root["role"] = config.role
    root["repair_pipeline"] = "scripts/tracheostomy/repair_meshy_models.py"
    if config.attribution:
        root["attribution"] = config.attribution
    if config.source_url:
        root["source_url"] = config.source_url
    if config.license_name:
        root["license"] = config.license_name
    for index, obj in enumerate(objects, start=1):
        obj.name = f"{config.output_name.removesuffix('.glb')}-{index:02d}"
        obj.data.name = f"{obj.name}-mesh"
        obj.parent = root
    for obj in list(bpy.context.scene.objects):
        if obj.type == "EMPTY" and obj != root:
            bpy.data.objects.remove(obj, do_unlink=True)
def export_glb(output: Path) -> None:
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_image_format="JPEG",
        export_jpeg_quality=82,
        export_image_quality=82,
        export_keep_originals=False,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_extras=True,
        export_apply=True,
        export_yup=True,
        export_use_gltfpack=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def repair_asset(source: Path, output_dir: Path, config: AssetConfig) -> dict[str, object]:
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects = mesh_objects()
    if not objects:
        raise RuntimeError(f"No mesh objects found in {source}")
    original_triangles = triangle_count(objects)
    flatten_transforms(objects)
    normalization_scale, original_dimensions = normalize_geometry(objects)
    for obj in objects:
        clean_mesh(obj)
    cleaned_triangles = triangle_count(objects)
    decimation_ratio = decimate(objects, config.target_triangles)
    for obj in objects:
        clean_mesh(obj)
    optimized_triangles = triangle_count(objects)
    simplify_materials(config)
    image_report = resize_images(config.texture_limit)
    add_metadata(config, source, objects)

    output = output_dir / config.output_name
    export_glb(output)
    result = {
        "id": config.output_name.removesuffix(".glb"),
        "displayName": config.display_name,
        "sourceFile": source.name,
        "sourceSha256": sha256(source),
        "url": f"/tracheostomy/models/{config.output_name}",
        "outputBytes": output.stat().st_size,
        "meshCount": len(objects),
        "triangles": {
            "original": original_triangles,
            "afterCleanup": cleaned_triangles,
            "optimized": optimized_triangles,
            "target": config.target_triangles,
        },
        "decimationRatio": round(decimation_ratio, 5),
        "normalizationScale": round(normalization_scale, 8),
        "originalDimensions": original_dimensions,
        "normalizedMaxDimension": 2.0,
        "textures": image_report,
        "role": config.role,
        "learnerFacing": config.learner_facing,
        "attribution": config.attribution,
        "sourceUrl": config.source_url,
        "license": config.license_name,
        "repairs": [
            "flattened transforms",
            "centered and normalized scale",
            "welded coincident vertices",
            "removed unreferenced loose vertices",
            "recalculated face normals",
            "applied conservative triangle budget",
            f"limited embedded textures to {config.texture_limit}px",
            "renamed generic mesh nodes",
        ],
    }
    print(
        f"REPAIRED {source.name} -> {config.output_name}: "
        f"{original_triangles} -> {optimized_triangles} triangles, "
        f"{source.stat().st_size / 1048576:.1f} -> {output.stat().st_size / 1048576:.1f} MiB"
    )
    return result


def main() -> None:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(args) != 2:
        raise SystemExit("Expected source directory and output directory")
    source_dir = Path(args[0]).resolve()
    output_dir = Path(args[1]).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    missing = sorted(set(ASSETS) - {path.name for path in source_dir.glob("*.glb")})
    if missing:
        raise RuntimeError(f"Missing expected assets: {', '.join(missing)}")

    results = [
        repair_asset(source_dir / source_name, output_dir, config)
        for source_name, config in ASSETS.items()
    ]
    try:
        source_label = str(source_dir.relative_to(Path.cwd()))
    except ValueError:
        source_label = source_dir.name
    manifest = {
        "generatedBy": "scripts/tracheostomy/repair_meshy_models.py",
        "sourceDirectory": source_label,
        "notes": [
            "Original source files are preserved unchanged.",
            "Models are normalized individually and are not anatomically registered to one another.",
            "The larynx derivative retains its CC BY-NC-SA 4.0 attribution and license metadata.",
        ],
        "models": results,
    }
    (output_dir / "model-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()

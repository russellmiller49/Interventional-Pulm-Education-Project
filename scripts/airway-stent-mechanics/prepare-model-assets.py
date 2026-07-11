"""Prepare the user-supplied airway-stent GLBs for the protected web lesson.

The authoring originals in ``3D assets/Stents`` are never modified. This Blender pipeline:

- flattens source transforms and normalizes every asset to a shared long-axis convention;
- centers geometry, welds coincident vertices, removes loose vertices, and recalculates normals;
- applies conservative, asset-specific triangle budgets;
- replaces unstable source texture inputs with audited neutral PBR materials;
- adds lightweight educational morph targets for prescribed visual deformation;
- exports self-contained Draco-compressed GLBs; and
- writes a hash- and geometry-auditable manifest next to the derivatives.

Run with Blender, not system Python:

  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/airway-stent-mechanics/prepare-model-assets.py -- \
    "3D assets/Stents" public/airway-stent-mechanics/models/v1
"""

from __future__ import annotations

import hashlib
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector


RIGHTS_STATUS = (
    "User-supplied repository asset; production publication rights and exact product provenance "
    "are not documented in the source folder."
)
VALIDATION_STATUS = (
    "Illustrative geometry specimen; not manufacturer-validated, dimensionally registered, "
    "bench-calibrated, or suitable for patient-specific prediction."
)
NORMALIZED_MAX_DIMENSION = 2.0


@dataclass(frozen=True)
class AssetConfig:
    output_name: str
    display_name: str
    family: str
    coverage: str
    target_triangles: int
    source_long_axis: str
    axial_coupling: float = 0.0
    morph_profile: str = "straight-stent"
    material_color: tuple[float, float, float, float] | None = None
    metallic: float = 0.0
    roughness: float = 0.5


ASSETS: dict[str, AssetConfig] = {
    "AERO_LaserCut_Covered.glb": AssetConfig(
        output_name="aero-laser-cut-covered.glb",
        display_name="AERO laser-cut covered specimen",
        family="laser-cut self-expanding lattice",
        coverage="covered",
        target_triangles=110_000,
        source_long_axis="Z",
        axial_coupling=0.05,
    ),
    "AERO_LaserCut_Uncovered.glb": AssetConfig(
        output_name="aero-laser-cut-uncovered.glb",
        display_name="AERO laser-cut uncovered specimen",
        family="laser-cut self-expanding lattice",
        coverage="uncovered",
        target_triangles=120_000,
        source_long_axis="Z",
        axial_coupling=0.05,
    ),
    "Bonastent_HookCross_Covered.glb": AssetConfig(
        output_name="bonastent-hook-cross-covered.glb",
        display_name="BONASTENT hook-and-cross covered specimen",
        family="captured-cell braided scaffold",
        coverage="covered",
        target_triangles=110_000,
        source_long_axis="Z",
        axial_coupling=0.14,
    ),
    "Bonastent_HookCross_Uncovered.glb": AssetConfig(
        output_name="bonastent-hook-cross-uncovered.glb",
        display_name="BONASTENT hook-and-cross uncovered specimen",
        family="captured-cell braided scaffold",
        coverage="uncovered",
        target_triangles=120_000,
        source_long_axis="Z",
        axial_coupling=0.14,
    ),
    "Ultraflex_Woven_Covered.glb": AssetConfig(
        output_name="ultraflex-woven-covered.glb",
        display_name="Ultraflex woven covered specimen",
        family="single-wire knitted scaffold",
        coverage="covered",
        target_triangles=110_000,
        source_long_axis="Z",
        axial_coupling=0.18,
    ),
    "Ultraflex_Woven_Uncov.glb": AssetConfig(
        output_name="ultraflex-woven-uncovered.glb",
        display_name="Ultraflex woven uncovered specimen",
        family="single-wire knitted scaffold",
        coverage="uncovered",
        target_triangles=120_000,
        source_long_axis="X",
        axial_coupling=0.18,
    ),
    "Silicone Y-stent.glb": AssetConfig(
        output_name="silicone-y-stent.glb",
        display_name="Silicone Y-stent specimen",
        family="bifurcated molded silicone",
        coverage="continuous wall",
        target_triangles=66_000,
        source_long_axis="Y",
        morph_profile="y-stent",
        material_color=(0.78, 0.87, 0.94, 1.0),
        metallic=0.0,
        roughness=0.56,
    ),
    "Trachea_openface_with_stenosis.glb": AssetConfig(
        output_name="trachea-openface-stenosis.glb",
        display_name="Open-face trachea with stenotic segment",
        family="educational airway context",
        coverage="not applicable",
        target_triangles=100_000,
        source_long_axis="Z",
        morph_profile="airway",
    ),
    "Wall_stent.glb": AssetConfig(
        output_name="wall-stent.glb",
        display_name="Wall-type braided stent specimen",
        family="multiwire braided scaffold",
        coverage="uncovered",
        target_triangles=84_000,
        source_long_axis="Z",
        axial_coupling=0.2,
        material_color=(0.26, 0.55, 0.75, 1.0),
        metallic=0.72,
        roughness=0.28,
    ),
}


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def triangle_count(objects: list[bpy.types.Object]) -> int:
    return sum(max(0, len(poly.vertices) - 2) for obj in objects for poly in obj.data.polygons)


def vertex_count(objects: list[bpy.types.Object]) -> int:
    return sum(len(obj.data.vertices) for obj in objects)


def flatten_transforms(objects: list[bpy.types.Object]) -> None:
    for obj in objects:
        obj.data.transform(obj.matrix_world.copy())
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)


def align_long_axis(objects: list[bpy.types.Object], source_axis: str) -> None:
    if source_axis == "Z":
        return
    if source_axis == "X":
        transform = Matrix.Rotation(-math.pi / 2.0, 4, "Y")
    elif source_axis == "Y":
        transform = Matrix.Rotation(math.pi / 2.0, 4, "X")
    else:
        raise ValueError(f"Unsupported source long axis: {source_axis}")
    for obj in objects:
        obj.data.transform(transform)


def geometry_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [vertex.co for obj in objects for vertex in obj.data.vertices]
    if not points:
        raise RuntimeError("Imported asset contains no vertices")
    minimum = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    maximum = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    return minimum, maximum


def normalize_geometry(
    objects: list[bpy.types.Object],
) -> tuple[float, tuple[float, float, float]]:
    minimum, maximum = geometry_bounds(objects)
    center = (minimum + maximum) * 0.5
    dimensions = maximum - minimum
    max_dimension = max(dimensions)
    if max_dimension <= 0:
        raise RuntimeError("Imported asset has zero-size bounds")
    scale = NORMALIZED_MAX_DIMENSION / max_dimension
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
    ratio = max(0.04, min(1.0, target_triangles / current))
    for obj in objects:
        if len(obj.data.polygons) < 500:
            continue
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        modifier = obj.modifiers.new(name="Web triangle budget", type="DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        modifier.use_symmetry = False
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
    return ratio


def discard_source_images() -> list[dict[str, object]]:
    report: list[dict[str, object]] = []
    for image in list(bpy.data.images):
        width, height = image.size
        if width <= 0 or height <= 0:
            continue
        report.append({"name": image.name, "original": [width, height], "retained": False})
        bpy.data.images.remove(image)
    return report


def principled_node(material: bpy.types.Material):
    if not material.node_tree:
        return None
    return next(
        (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
        None,
    )


def sanitize_materials(config: AssetConfig, objects: list[bpy.types.Object]) -> None:
    color = config.material_color
    if color is None:
        if config.morph_profile == "airway":
            color = (0.76, 0.34, 0.36, 1.0)
        elif config.coverage == "covered":
            color = (0.66, 0.75, 0.82, 1.0)
        else:
            color = (0.34, 0.58, 0.74, 1.0)

    if not any(obj.data.materials for obj in objects):
        material = bpy.data.materials.new(name=f"{config.output_name.removesuffix('.glb')}-material")
        material.use_nodes = True
        for obj in objects:
            obj.data.materials.append(material)

    for material in bpy.data.materials:
        node = principled_node(material)
        if node:
            base_color = node.inputs.get("Base Color")
            if base_color:
                for link in list(base_color.links):
                    material.node_tree.links.remove(link)
                base_color.default_value = color
            metallic = node.inputs.get("Metallic")
            if metallic:
                for link in list(metallic.links):
                    material.node_tree.links.remove(link)
                metallic.default_value = config.metallic if config.material_color else 0.38
            roughness = node.inputs.get("Roughness")
            if roughness:
                for link in list(roughness.links):
                    material.node_tree.links.remove(link)
                roughness.default_value = config.roughness if config.material_color else 0.42
            alpha = node.inputs.get("Alpha")
            if alpha:
                for link in list(alpha.links):
                    material.node_tree.links.remove(link)
                alpha.default_value = 1.0
            emission = node.inputs.get("Emission Color") or node.inputs.get("Emission")
            if emission:
                for link in list(emission.links):
                    material.node_tree.links.remove(link)
                emission.default_value = (0.0, 0.0, 0.0, 1.0)
            emission_strength = node.inputs.get("Emission Strength")
            if emission_strength:
                emission_strength.default_value = 0.0
            normal = node.inputs.get("Normal")
            if normal:
                for link in list(normal.links):
                    material.node_tree.links.remove(link)
        material.use_backface_culling = config.morph_profile not in {"airway", "y-stent"}


def add_shape_key(obj: bpy.types.Object, name: str, transform) -> None:
    key = obj.shape_key_add(name=name, from_mix=False)
    for point, vertex in zip(key.data, obj.data.vertices, strict=True):
        point.co = transform(vertex.co.copy())
    key.value = 0.0


def add_straight_stent_morphs(obj: bpy.types.Object, axial_coupling: float) -> list[str]:
    obj.shape_key_add(name="Basis", from_mix=False)
    minimum, maximum = geometry_bounds([obj])
    half_length = max((maximum.z - minimum.z) * 0.5, 0.001)
    center_z = (minimum.z + maximum.z) * 0.5

    def radial_compression(co: Vector) -> Vector:
        co.x *= 0.68
        co.y *= 0.68
        co.z = center_z + (co.z - center_z) * (1.0 + axial_coupling * 0.32)
        return co

    def ovalization(co: Vector) -> Vector:
        co.x *= 0.62
        co.y *= 1.08
        return co

    max_angle = math.radians(32.0)
    radius = half_length / max_angle

    def bend(co: Vector) -> Vector:
        theta = ((co.z - center_z) / half_length) * max_angle
        local_radius = max(0.08, radius - co.x)
        co.x = radius - local_radius * math.cos(theta)
        co.z = center_z + local_radius * math.sin(theta)
        return co

    add_shape_key(obj, "RadialCompression", radial_compression)
    add_shape_key(obj, "Ovalization", ovalization)
    add_shape_key(obj, "Bend", bend)
    return ["RadialCompression", "Ovalization", "Bend"]


def add_y_stent_morphs(obj: bpy.types.Object) -> list[str]:
    obj.shape_key_add(name="Basis", from_mix=False)

    def branch_compression(co: Vector) -> Vector:
        co.x *= 0.78
        co.y *= 0.78
        return co

    add_shape_key(obj, "RadialCompression", branch_compression)
    return ["RadialCompression"]


def add_airway_morphs(obj: bpy.types.Object) -> list[str]:
    obj.shape_key_add(name="Basis", from_mix=False)
    minimum, maximum = geometry_bounds([obj])
    half_length = max((maximum.z - minimum.z) * 0.5, 0.001)
    center_z = (minimum.z + maximum.z) * 0.5

    def axial_weight(z: float, width: float) -> float:
        normalized = (z - center_z) / (half_length * width)
        return math.exp(-(normalized * normalized))

    def stenosis_relief(co: Vector) -> Vector:
        weight = axial_weight(co.z, 0.34)
        scale = 1.0 + 0.2 * weight
        co.x *= scale
        co.y *= scale
        return co

    def cough_ovalization(co: Vector) -> Vector:
        weight = axial_weight(co.z, 0.48)
        co.x *= 1.0 - 0.18 * weight
        co.y *= 1.0 + 0.05 * weight
        return co

    add_shape_key(obj, "StenosisRelief", stenosis_relief)
    add_shape_key(obj, "CoughOvalization", cough_ovalization)
    return ["StenosisRelief", "CoughOvalization"]


def add_morph_targets(config: AssetConfig, objects: list[bpy.types.Object]) -> list[str]:
    names: set[str] = set()
    for obj in objects:
        if config.morph_profile == "straight-stent":
            names.update(add_straight_stent_morphs(obj, config.axial_coupling))
        elif config.morph_profile == "y-stent":
            names.update(add_y_stent_morphs(obj))
        elif config.morph_profile == "airway":
            names.update(add_airway_morphs(obj))
        else:
            raise ValueError(f"Unknown morph profile: {config.morph_profile}")
    return sorted(names)


def add_metadata(
    config: AssetConfig,
    source: Path,
    source_hash: str,
    objects: list[bpy.types.Object],
) -> None:
    root = bpy.data.objects.new(config.display_name, None)
    bpy.context.scene.collection.objects.link(root)
    root["source_file"] = source.name
    root["source_sha256"] = source_hash
    root["display_name"] = config.display_name
    root["family"] = config.family
    root["coverage"] = config.coverage
    root["rights_status"] = RIGHTS_STATUS
    root["validation_status"] = VALIDATION_STATUS
    root["repair_pipeline"] = "scripts/airway-stent-mechanics/prepare-model-assets.py"
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
        export_animations=True,
        export_morph=True,
        export_morph_normal=False,
        export_morph_tangent=False,
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

    source_hash = sha256(source)
    original_triangles = triangle_count(objects)
    original_vertices = vertex_count(objects)
    flatten_transforms(objects)
    align_long_axis(objects, config.source_long_axis)
    normalization_scale, original_dimensions = normalize_geometry(objects)
    for obj in objects:
        clean_mesh(obj)
    cleaned_triangles = triangle_count(objects)
    decimation_ratio = decimate(objects, config.target_triangles)
    for obj in objects:
        clean_mesh(obj)
    optimized_triangles = triangle_count(objects)
    optimized_vertices = vertex_count(objects)
    sanitize_materials(config, objects)
    image_report = discard_source_images()
    morph_targets = add_morph_targets(config, objects)
    add_metadata(config, source, source_hash, objects)

    output = output_dir / config.output_name
    export_glb(output)
    output_hash = sha256(output)
    result = {
        "id": config.output_name.removesuffix(".glb"),
        "displayName": config.display_name,
        "family": config.family,
        "coverage": config.coverage,
        "sourceFile": source.name,
        "sourceSha256": source_hash,
        "url": f"/airway-stent-mechanics/models/v1/{config.output_name}",
        "outputSha256": output_hash,
        "outputBytes": output.stat().st_size,
        "meshCount": len(objects),
        "materialCount": len(bpy.data.materials),
        "vertices": {"original": original_vertices, "optimized": optimized_vertices},
        "triangles": {
            "original": original_triangles,
            "afterCleanup": cleaned_triangles,
            "optimized": optimized_triangles,
            "target": config.target_triangles,
        },
        "decimationRatio": round(decimation_ratio, 6),
        "normalizationScale": round(normalization_scale, 8),
        "sourceLongAxis": config.source_long_axis,
        "outputLongAxis": "Y (glTF export)",
        "originalDimensions": original_dimensions,
        "normalizedMaxDimension": NORMALIZED_MAX_DIMENSION,
        "discardedSourceTextures": image_report,
        "morphTargets": morph_targets,
        "rightsStatus": RIGHTS_STATUS,
        "validationStatus": VALIDATION_STATUS,
        "repairs": [
            "flattened source transforms",
            "aligned the primary long axis before glTF Y-up export",
            "centered and normalized scale",
            "welded coincident vertices",
            "removed unreferenced loose vertices",
            "recalculated face normals",
            "applied a conservative triangle budget",
            "replaced source texture inputs with an audited neutral PBR material",
            "removed source emissive and visually flat normal-map dependencies",
            "added prescribed educational morph targets",
            "renamed generic scene nodes",
            "exported self-contained Draco-compressed GLB",
        ],
    }
    print(
        f"PREPARED {source.name} -> {config.output_name}: "
        f"{original_triangles:,} -> {optimized_triangles:,} triangles; "
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
        "schemaVersion": 1,
        "generatedBy": "scripts/airway-stent-mechanics/prepare-model-assets.py",
        "generatedWith": f"Blender {bpy.app.version_string}",
        "sourceDirectory": source_label,
        "assetPrefix": "/airway-stent-mechanics/models/v1/",
        "rightsStatus": RIGHTS_STATUS,
        "validationStatus": VALIDATION_STATUS,
        "notes": [
            "Original source files are preserved unchanged.",
            "Models are individually normalized and are not anatomically registered to one another.",
            "Morph targets prescribe educational deformation and do not encode measured mechanics.",
            "Named labels follow user-supplied filenames and do not imply manufacturer validation or endorsement.",
        ],
        "models": results,
    }
    (output_dir / "model-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()

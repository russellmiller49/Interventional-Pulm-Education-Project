"""Export a SlicerHeart Virtual Cath Lab bundle for FluoroView.

Run this with 3D Slicer's Python while the Virtual Cath Lab scene is open and the C-arm view is
rendered. The output should contain derived educational artifacts only: JSON metadata, screenshots,
and rendered C-arm PNGs. Do not commit raw CT volumes, DICOM, NIfTI, NRRD, STL, or OBJ exports.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any


VIRTUAL_CATH_LAB_NODE_HINTS = ("VirtualCathLab", "CArm", "GenericFluoro", "GenericBiplaneFluoro")
C_ARM_VOLUME_NAMES = ("CArmFrontalXRay", "CArmLateralXRay")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "output_dir",
        help="Output directory for virtual_cath_lab_bundle.json, C-arm PNGs, and screenshots.",
    )
    parser.add_argument(
        "--screenshots",
        action="store_true",
        help="Capture current Slicer 3D and slice view screenshots.",
    )
    parser.add_argument(
        "--render",
        action="store_true",
        help="Ask the Virtual Cath Lab logic to re-render C-arm volumes before export.",
    )
    parser.add_argument(
        "--sample-model-points",
        type=int,
        default=0,
        help="Optional number of world RAS points to sample per model/segmentation segment.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.render:
        render_virtual_cath_lab()

    c_arm_exports = export_c_arm_pngs(output_dir)
    bundle = export_bundle(
        c_arm_exports=c_arm_exports,
        sample_model_points=max(args.sample_model_points, 0),
    )
    bundle_path = output_dir / "virtual_cath_lab_bundle.json"
    bundle_path.write_text(json.dumps(bundle, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {bundle_path}")

    if args.screenshots:
        screenshots = export_screenshots(output_dir)
        screenshot_path = output_dir / "virtual_cath_lab_screenshots_manifest.json"
        screenshot_path.write_text(json.dumps(screenshots, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {screenshot_path}")


def export_bundle(*, c_arm_exports: list[dict[str, Any]], sample_model_points: int) -> dict[str, Any]:
    import slicer  # type: ignore

    parameter_nodes = export_virtual_cath_lab_parameter_nodes(slicer)
    return {
        "schema": "fluoroview_virtual_cath_lab_bundle/v1",
        "createdUtc": datetime.now(timezone.utc).isoformat(),
        "coordinateSystem": "RAS",
        "units": "mm",
        "notes": [
            "3D Slicer uses RAS coordinates. FluoroView case geometry uses LPS.",
            "Convert RAS to LPS with [-R, -A, S] before comparing with FluoroView manifests.",
            "This bundle is for educational calibration and derived web-asset generation.",
            "Review node names and storage paths for PHI before sharing this file.",
        ],
        "slicer": slicer_metadata(slicer),
        "scene": scene_metadata(slicer),
        "virtualCathLab": {
            "parameterNodes": parameter_nodes,
            "cArmVolumes": c_arm_exports,
        },
        "volumes": export_volumes(slicer),
        "models": export_models(slicer, sample_model_points=sample_model_points),
        "segmentations": export_segmentations(slicer, sample_model_points=sample_model_points),
        "markups": export_markups(slicer),
        "transforms": export_transforms(slicer),
        "cameras": export_cameras(slicer),
        "sliceViews": export_slice_views(slicer),
        "views": export_view_nodes(slicer),
    }


def render_virtual_cath_lab() -> None:
    import slicer  # type: ignore

    try:
        widget = slicer.modules.virtualcathlab.widgetRepresentation().self()
        widget.logic.renderToVolume()
        slicer.app.processEvents()
        print("Requested Virtual Cath Lab C-arm re-render.")
    except Exception as exc:
        print(f"Could not trigger Virtual Cath Lab render automatically: {exc}")
        print("Continue if the C-arm fluoro images are already visible in Slicer.")


def export_c_arm_pngs(output_dir: Path) -> list[dict[str, Any]]:
    import slicer  # type: ignore

    exports = []
    for name in C_ARM_VOLUME_NAMES:
        node = slicer.util.getFirstNodeByName(name)
        if node is None:
            continue
        image_data = node.GetImageData()
        if image_data is None:
            continue
        filename = f"{safe_file_token(name)}.png"
        path = output_dir / filename
        write_image_data_png(image_data, path)
        exports.append(
            {
                "nodeId": node.GetID(),
                "nodeName": node.GetName(),
                "file": filename,
                "dimensionsIJK": list(image_data.GetDimensions()),
                "scalarRange": list(image_data.GetScalarRange()),
                "spacingIJKMm": list(node.GetSpacing()),
                "originRASMm": list(node.GetOrigin()),
                "ijkToRas": volume_ijk_to_ras(node),
                "parentTransformNodeId": parent_transform_id(node),
                "worldTransformFromParent": transform_between_parent_and_world(node),
            }
        )
        print(f"Wrote {path}")
    return exports


def write_image_data_png(image_data: Any, path: Path) -> None:
    import vtk  # type: ignore

    shift_scale = vtk.vtkImageShiftScale()
    shift_scale.SetInputData(image_data)
    scalar_min, scalar_max = image_data.GetScalarRange()
    if scalar_max > scalar_min:
        shift_scale.SetShift(-scalar_min)
        shift_scale.SetScale(255.0 / (scalar_max - scalar_min))
    shift_scale.SetOutputScalarTypeToUnsignedChar()
    shift_scale.ClampOverflowOn()
    shift_scale.Update()

    writer = vtk.vtkPNGWriter()
    writer.SetFileName(str(path))
    writer.SetInputData(shift_scale.GetOutput())
    if hasattr(writer, "SetFileDimensionality"):
        writer.SetFileDimensionality(2)
    writer.Write()


def export_virtual_cath_lab_parameter_nodes(slicer: Any) -> list[dict[str, Any]]:
    nodes = []
    for node in get_nodes_by_class(slicer, "vtkMRMLScriptedModuleNode"):
        if not is_virtual_cath_lab_node(node):
            continue
        nodes.append(
            {
                "id": node.GetID(),
                "name": node.GetName(),
                "moduleName": safe_call(node.GetModuleName),
                "parameters": scripted_module_parameters(node),
                "nodeReferences": node_references(node),
            }
        )
    return nodes


def is_virtual_cath_lab_node(node: Any) -> bool:
    haystack = " ".join(
        str(value or "")
        for value in [
            safe_call(node.GetName),
            safe_call(node.GetModuleName),
            safe_call(lambda: node.GetParameter("DeviceClassId")),
        ]
    )
    return any(hint in haystack for hint in VIRTUAL_CATH_LAB_NODE_HINTS)


def scripted_module_parameters(node: Any) -> dict[str, str]:
    names = vtk_string_array()
    if safe_call(lambda: node.GetParameterNames(names)) is None:
        return {}
    return {
        names.GetValue(index): str(node.GetParameter(names.GetValue(index)))
        for index in range(names.GetNumberOfValues())
    }


def node_references(node: Any) -> dict[str, list[dict[str, str | None]]]:
    references: dict[str, list[dict[str, str | None]]] = {}
    role_count = safe_call(node.GetNumberOfNodeReferenceRoles, default=0)
    for role_index in range(role_count):
        role = safe_call(lambda i=role_index: node.GetNthNodeReferenceRole(i))
        if not role:
            continue
        references[role] = []
        reference_count = safe_call(lambda r=role: node.GetNumberOfNodeReferences(r), default=0)
        for reference_index in range(reference_count):
            referenced_node = safe_call(
                lambda r=role, i=reference_index: node.GetNthNodeReference(r, i)
            )
            if referenced_node is None:
                continue
            references[role].append(
                {
                    "id": referenced_node.GetID(),
                    "name": referenced_node.GetName(),
                    "className": referenced_node.GetClassName(),
                }
            )
    return references


def slicer_metadata(slicer: Any) -> dict[str, Any]:
    app = getattr(slicer, "app", None)
    if app is None:
        return {}
    return {
        "applicationName": safe_call(lambda: app.applicationName),
        "applicationVersion": safe_call(lambda: app.applicationVersion),
        "revision": safe_call(lambda: app.revision),
        "platform": safe_call(lambda: app.platform),
    }


def scene_metadata(slicer: Any) -> dict[str, Any]:
    scene = slicer.mrmlScene
    return {
        "url": safe_call(scene.GetURL),
        "rootDirectory": safe_call(scene.GetRootDirectory),
        "nodeCount": safe_call(scene.GetNumberOfNodes),
    }


def export_volumes(slicer: Any) -> list[dict[str, Any]]:
    volumes = []
    for node in get_nodes_by_class(slicer, "vtkMRMLScalarVolumeNode"):
        image_data = node.GetImageData()
        bounds = [0.0] * 6
        safe_call(lambda: node.GetRASBounds(bounds))
        volumes.append(
            {
                "id": node.GetID(),
                "name": node.GetName(),
                "storageFileName": storage_file_name(node),
                "parentTransformNodeId": parent_transform_id(node),
                "spacingIJKMm": list(node.GetSpacing()),
                "originRASMm": list(node.GetOrigin()),
                "dimensionsIJK": list(image_data.GetDimensions()) if image_data else None,
                "rasBoundsMm": bounds,
                "ijkToRas": volume_ijk_to_ras(node),
                "rasToIjk": volume_ras_to_ijk(node),
                "worldTransformFromParent": transform_between_parent_and_world(node),
            }
        )
    return volumes


def export_models(slicer: Any, *, sample_model_points: int) -> list[dict[str, Any]]:
    models = []
    for node in get_nodes_by_class(slicer, "vtkMRMLModelNode"):
        bounds = [0.0] * 6
        local_bounds = [0.0] * 6
        safe_call(lambda: node.GetRASBounds(bounds))
        safe_call(lambda: node.GetBounds(local_bounds))
        poly = node.GetPolyData()
        models.append(
            {
                "id": node.GetID(),
                "name": node.GetName(),
                "storageFileName": storage_file_name(node),
                "parentTransformNodeId": parent_transform_id(node),
                "rasBoundsMm": bounds,
                "localBoundsMm": local_bounds,
                "numberOfPoints": poly.GetNumberOfPoints() if poly else 0,
                "numberOfCells": poly.GetNumberOfCells() if poly else 0,
                "worldTransformFromParent": transform_between_parent_and_world(node),
                "samplePointsRAS": sample_model_points_ras(node, sample_model_points),
            }
        )
    return models


def export_segmentations(slicer: Any, *, sample_model_points: int) -> list[dict[str, Any]]:
    segmentations = []
    for node in get_nodes_by_class(slicer, "vtkMRMLSegmentationNode"):
        safe_call(node.CreateClosedSurfaceRepresentation)
        bounds = [0.0] * 6
        safe_call(lambda: node.GetRASBounds(bounds))
        segmentation = node.GetSegmentation()
        segment_ids = vtk_string_array()
        safe_call(lambda: segmentation.GetSegmentIDs(segment_ids)) if segmentation else None
        segments = []
        for index in range(segment_ids.GetNumberOfValues() if segment_ids else 0):
            segment_id = segment_ids.GetValue(index)
            segment = segmentation.GetSegment(segment_id)
            poly = safe_call(lambda s=segment: s.GetRepresentation("Closed surface"))
            local_bounds = [0.0] * 6
            if poly:
                safe_call(lambda p=poly: p.GetBounds(local_bounds))
            segments.append(
                {
                    "id": segment_id,
                    "name": safe_call(segment.GetName) if segment else None,
                    "color": list(safe_call(segment.GetColor, default=[])) if segment else [],
                    "localBoundsMm": local_bounds,
                    "numberOfPoints": poly.GetNumberOfPoints() if poly else 0,
                    "numberOfCells": poly.GetNumberOfCells() if poly else 0,
                    "samplePointsRAS": sample_polydata_points_ras(
                        poly,
                        transform_between_parent_and_world_matrix(node),
                        sample_model_points,
                    ),
                }
            )
        segmentations.append(
            {
                "id": node.GetID(),
                "name": node.GetName(),
                "storageFileName": storage_file_name(node),
                "parentTransformNodeId": parent_transform_id(node),
                "rasBoundsMm": bounds,
                "worldTransformFromParent": transform_between_parent_and_world(node),
                "segmentCount": len(segments),
                "segments": segments,
            }
        )
    return segmentations


def export_markups(slicer: Any) -> list[dict[str, Any]]:
    markups = []
    for node in get_nodes_by_class(slicer, "vtkMRMLMarkupsNode"):
        points = []
        count = safe_call(node.GetNumberOfControlPoints, default=0)
        for index in range(count):
            local = [0.0, 0.0, 0.0]
            world = [0.0, 0.0, 0.0]
            safe_call(lambda i=index: node.GetNthControlPointPosition(i, local))
            safe_call(lambda i=index: node.GetNthControlPointPositionWorld(i, world))
            points.append(
                {
                    "index": index,
                    "label": safe_call(lambda i=index: node.GetNthControlPointLabel(i)),
                    "positionRASMm": local,
                    "positionWorldRASMm": world,
                }
            )
        markups.append(
            {
                "id": node.GetID(),
                "name": node.GetName(),
                "className": node.GetClassName(),
                "storageFileName": storage_file_name(node),
                "parentTransformNodeId": parent_transform_id(node),
                "worldTransformFromParent": transform_between_parent_and_world(node),
                "controlPoints": points,
            }
        )
    return markups


def export_transforms(slicer: Any) -> list[dict[str, Any]]:
    transforms = []
    for node in get_nodes_by_class(slicer, "vtkMRMLTransformNode"):
        matrix = matrix4x4()
        safe_call(lambda: node.GetMatrixTransformToWorld(matrix))
        transforms.append(
            {
                "id": node.GetID(),
                "name": node.GetName(),
                "className": node.GetClassName(),
                "parentTransformNodeId": parent_transform_id(node),
                "matrixToWorldRAS": matrix_to_list(matrix),
                "isLinear": safe_call(node.IsLinear, default=None),
            }
        )
    return transforms


def export_cameras(slicer: Any) -> list[dict[str, Any]]:
    cameras = []
    for node in get_nodes_by_class(slicer, "vtkMRMLCameraNode"):
        camera = node.GetCamera()
        cameras.append(
            {
                "id": node.GetID(),
                "name": node.GetName(),
                "activeTag": safe_call(node.GetActiveTag),
                "positionRASMm": list(camera.GetPosition()) if camera else None,
                "focalPointRASMm": list(camera.GetFocalPoint()) if camera else None,
                "viewUpRAS": list(camera.GetViewUp()) if camera else None,
                "clippingRangeMm": list(camera.GetClippingRange()) if camera else None,
                "viewAngleDeg": camera.GetViewAngle() if camera else None,
                "parallelProjection": bool(camera.GetParallelProjection()) if camera else None,
                "parallelScaleMm": camera.GetParallelScale() if camera else None,
            }
        )
    return cameras


def export_slice_views(slicer: Any) -> list[dict[str, Any]]:
    slice_views = []
    for node in get_nodes_by_class(slicer, "vtkMRMLSliceNode"):
        slice_to_ras = node.GetSliceToRAS()
        xy_to_ras = node.GetXYToRAS()
        slice_views.append(
            {
                "id": node.GetID(),
                "name": node.GetName(),
                "layoutName": safe_call(node.GetLayoutName),
                "orientation": safe_call(node.GetOrientation),
                "sliceOffsetMm": safe_call(node.GetSliceOffset),
                "fieldOfViewMm": list(safe_call(node.GetFieldOfView, default=[])),
                "dimensionsPx": list(safe_call(node.GetDimensions, default=[])),
                "sliceToRAS": matrix_to_list(slice_to_ras),
                "xyToRAS": matrix_to_list(xy_to_ras),
            }
        )
    return slice_views


def export_view_nodes(slicer: Any) -> list[dict[str, Any]]:
    views = []
    for node in get_nodes_by_class(slicer, "vtkMRMLViewNode"):
        views.append(
            {
                "id": node.GetID(),
                "name": node.GetName(),
                "layoutName": safe_call(node.GetLayoutName),
                "backgroundColor": list(safe_call(node.GetBackgroundColor, default=[])),
                "boxVisible": safe_call(node.GetBoxVisible),
                "axisLabelsVisible": safe_call(node.GetAxisLabelsVisible),
            }
        )
    return views


def export_screenshots(output_dir: Path) -> dict[str, Any]:
    import slicer  # type: ignore

    layout_manager = slicer.app.layoutManager()
    screenshots: list[dict[str, str]] = []
    if layout_manager is None:
        return {"screenshots": screenshots, "note": "No Slicer layout manager available."}

    for index in range(layout_manager.threeDViewCount):
        view = layout_manager.threeDWidget(index).threeDView()
        name = f"three_d_view_{index}.png"
        path = output_dir / name
        view.grab().save(str(path))
        screenshots.append({"type": "threeD", "index": str(index), "file": name})

    for name in layout_manager.sliceViewNames():
        view = layout_manager.sliceWidget(name).sliceView()
        filename = f"slice_view_{safe_file_token(name)}.png"
        path = output_dir / filename
        view.grab().save(str(path))
        screenshots.append({"type": "slice", "name": name, "file": filename})

    return {"screenshots": screenshots}


def get_nodes_by_class(slicer: Any, class_name: str) -> list[Any]:
    collection = slicer.mrmlScene.GetNodesByClass(class_name)
    collection.UnRegister(slicer.mrmlScene)
    nodes = []
    for index in range(collection.GetNumberOfItems()):
        nodes.append(collection.GetItemAsObject(index))
    return nodes


def matrix4x4() -> Any:
    import vtk  # type: ignore

    return vtk.vtkMatrix4x4()


def vtk_string_array() -> Any:
    import vtk  # type: ignore

    return vtk.vtkStringArray()


def volume_ijk_to_ras(node: Any) -> list[list[float]] | None:
    matrix = matrix4x4()
    if safe_call(lambda: node.GetIJKToRASMatrix(matrix)) is None:
        return None
    return matrix_to_list(matrix)


def volume_ras_to_ijk(node: Any) -> list[list[float]] | None:
    matrix = matrix4x4()
    if safe_call(lambda: node.GetRASToIJKMatrix(matrix)) is None:
        return None
    return matrix_to_list(matrix)


def matrix_to_list(matrix: Any) -> list[list[float]] | None:
    if matrix is None:
        return None
    return [[float(matrix.GetElement(row, col)) for col in range(4)] for row in range(4)]


def storage_file_name(node: Any) -> str | None:
    storage = safe_call(node.GetStorageNode)
    if storage is None:
        return None
    return safe_call(storage.GetFileName)


def parent_transform_id(node: Any) -> str | None:
    parent = safe_call(node.GetParentTransformNode)
    return parent.GetID() if parent else None


def transform_between_parent_and_world(node: Any) -> list[list[float]] | None:
    matrix = transform_between_parent_and_world_matrix(node)
    return matrix_to_list(matrix)


def transform_between_parent_and_world_matrix(node: Any) -> Any:
    import slicer  # type: ignore

    matrix = matrix4x4()
    parent = safe_call(node.GetParentTransformNode)
    if parent is None:
        matrix.Identity()
        return matrix
    slicer.vtkMRMLTransformNode.GetMatrixTransformBetweenNodes(parent, None, matrix)
    return matrix


def sample_model_points_ras(node: Any, sample_count: int) -> list[list[float]]:
    if sample_count <= 0:
        return []
    poly = node.GetPolyData()
    if poly is None or poly.GetNumberOfPoints() == 0:
        return []
    return sample_polydata_points_ras(
        poly,
        transform_between_parent_and_world_matrix(node),
        sample_count,
    )


def sample_polydata_points_ras(poly: Any, matrix: Any, sample_count: int) -> list[list[float]]:
    if sample_count <= 0 or poly is None or poly.GetNumberOfPoints() == 0:
        return []
    total = poly.GetNumberOfPoints()
    step = max(1, total // sample_count)
    points = []
    for index in range(0, total, step):
        local_xyz = [0.0, 0.0, 0.0]
        poly.GetPoint(index, local_xyz)
        point = [local_xyz[0], local_xyz[1], local_xyz[2], 1.0]
        transformed = [0.0, 0.0, 0.0, 0.0]
        matrix.MultiplyPoint(point, transformed)
        points.append([float(transformed[0]), float(transformed[1]), float(transformed[2])])
        if len(points) >= sample_count:
            break
    return points


def safe_call(fn: Any, default: Any = None) -> Any:
    try:
        return fn()
    except Exception:
        return default


def safe_file_token(value: str) -> str:
    return "".join(char if char.isalnum() or char in {"-", "_"} else "_" for char in value)


if __name__ == "__main__":
    main()

"""Export a 3D Slicer scene calibration bundle for FluoroView alignment.

Run this with 3D Slicer's Python, not normal system Python. The output is a PHI-free-ish geometry
debug bundle only if node names and file paths are non-PHI; review before sharing or committing.
Do not commit raw volume/model files exported separately from Slicer.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "output_dir",
        help="Output directory for slicer_calibration_bundle.json and optional screenshots.",
    )
    parser.add_argument(
        "--screenshots",
        action="store_true",
        help="Also capture current 3D and slice view screenshots when Slicer is running with a GUI.",
    )
    parser.add_argument(
        "--sample-model-points",
        type=int,
        default=0,
        help="Optional number of world RAS points to sample per model for spot-checking transforms.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    bundle = export_bundle(sample_model_points=max(args.sample_model_points, 0))
    bundle_path = output_dir / "slicer_calibration_bundle.json"
    bundle_path.write_text(json.dumps(bundle, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {bundle_path}")

    if args.screenshots:
        screenshots = export_screenshots(output_dir)
        screenshot_path = output_dir / "slicer_screenshots_manifest.json"
        screenshot_path.write_text(json.dumps(screenshots, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {screenshot_path}")


def export_bundle(*, sample_model_points: int = 0) -> dict[str, Any]:
    import slicer  # type: ignore

    return {
        "schema": "fluoroview_slicer_calibration_bundle/v1",
        "createdUtc": datetime.now(timezone.utc).isoformat(),
        "coordinateSystem": "RAS",
        "units": "mm",
        "notes": [
            "3D Slicer uses RAS coordinates. FluoroView case geometry uses LPS.",
            "Convert RAS to LPS with [-R, -A, S] before comparing with FluoroView manifests.",
            "Review node names and storage paths for PHI before sharing this file.",
        ],
        "slicer": slicer_metadata(slicer),
        "scene": scene_metadata(slicer),
        "volumes": export_volumes(slicer),
        "models": export_models(slicer, sample_model_points=sample_model_points),
        "segmentations": export_segmentations(slicer, sample_model_points=sample_model_points),
        "markups": export_markups(slicer),
        "transforms": export_transforms(slicer),
        "cameras": export_cameras(slicer),
        "sliceViews": export_slice_views(slicer),
        "views": export_view_nodes(slicer),
    }


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
        ijk_to_ras = matrix4x4()
        ras_to_ijk = matrix4x4()
        node.GetIJKToRASMatrix(ijk_to_ras)
        node.GetRASToIJKMatrix(ras_to_ijk)
        bounds = [0.0] * 6
        node.GetRASBounds(bounds)
        image_data = node.GetImageData()
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
                "ijkToRas": matrix_to_list(ijk_to_ras),
                "rasToIjk": matrix_to_list(ras_to_ijk),
                "worldTransformFromParent": transform_between_parent_and_world(node),
            }
        )
    return volumes


def export_models(slicer: Any, *, sample_model_points: int = 0) -> list[dict[str, Any]]:
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


def export_segmentations(slicer: Any, *, sample_model_points: int = 0) -> list[dict[str, Any]]:
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
    import slicer  # type: ignore

    parent = safe_call(node.GetParentTransformNode)
    if parent is None:
        identity = matrix4x4()
        identity.Identity()
        return matrix_to_list(identity)
    matrix = matrix4x4()
    ok = safe_call(
        lambda: slicer.vtkMRMLTransformNode.GetMatrixTransformBetweenNodes(parent, None, matrix),
        default=False,
    )
    return matrix_to_list(matrix) if ok is not None else None


def sample_model_points_ras(node: Any, sample_count: int) -> list[list[float]]:
    if sample_count <= 0:
        return []
    poly = node.GetPolyData()
    if poly is None or poly.GetNumberOfPoints() == 0:
        return []

    matrix = transform_between_parent_and_world_matrix(node)

    return sample_polydata_points_ras(poly, matrix, sample_count)


def transform_between_parent_and_world_matrix(node: Any) -> Any:
    matrix = matrix4x4()
    parent = safe_call(node.GetParentTransformNode)
    if parent is not None:
        import slicer  # type: ignore

        slicer.vtkMRMLTransformNode.GetMatrixTransformBetweenNodes(parent, None, matrix)
    else:
        matrix.Identity()
    return matrix


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

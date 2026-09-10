import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkLineSource from '@kitware/vtk.js/Filters/Sources/LineSource';

import {
  addVectors,
  dotVectors,
  getPlanePoseAtAxisIndex,
  scaleVector,
  subtractVectors,
} from '../../../../../../features/case3d/patient-space';
import type { CasePlane, RuntimeCaseManifest, Vector3Tuple } from '../../../../../../features/case3d/types';

type SliceCrosshairEntry = {
  actor: vtkActor;
  source: ReturnType<typeof vtkLineSource.newInstance>;
};

function getProjectedPlaneCenter(
  manifest: RuntimeCaseManifest,
  plane: CasePlane,
  planeIndex: number,
  world: Vector3Tuple,
) {
  const pose = getPlanePoseAtAxisIndex(manifest.volumeGeometry, plane, planeIndex);
  const relative = subtractVectors(world, pose.center);
  const uOffset = dotVectors(relative, pose.basisU);
  const vOffset = dotVectors(relative, pose.basisV);

  return {
    center: addVectors(
      pose.center,
      addVectors(scaleVector(pose.basisU, uOffset), scaleVector(pose.basisV, vOffset)),
    ),
    pose,
  };
}

function createLine(color: [number, number, number]) {
  const source = vtkLineSource.newInstance({
    point1: [0, 0, 0],
    point2: [0, 0, 0],
    resolution: 1,
  });
  const mapper = vtkMapper.newInstance();
  mapper.setInputConnection(source.getOutputPort());

  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);
  actor.getProperty().setColor(color[0], color[1], color[2]);
  actor.getProperty().setLineWidth(2.2);

  return { actor, source };
}

function updateLine(
  entry: SliceCrosshairEntry,
  center: Vector3Tuple,
  axis: Vector3Tuple,
  totalLength: number,
) {
  entry.source.setPoint1(...addVectors(center, scaleVector(axis, -totalLength / 2)));
  entry.source.setPoint2(...addVectors(center, scaleVector(axis, totalLength / 2)));
  entry.source.modified();
}

export function createSliceCrosshairActors(
  manifest: RuntimeCaseManifest,
  plane: CasePlane,
  planeIndex: number,
  world: Vector3Tuple,
) {
  const entries: SliceCrosshairEntry[] = [createLine([0.98, 0.86, 0.36]), createLine([0.98, 0.86, 0.36])];
  updateSliceCrosshairActors(entries, manifest, plane, planeIndex, world);
  return entries;
}

export function updateSliceCrosshairActors(
  entries: SliceCrosshairEntry[],
  manifest: RuntimeCaseManifest,
  plane: CasePlane,
  planeIndex: number,
  world: Vector3Tuple,
) {
  const { center, pose } = getProjectedPlaneCenter(manifest, plane, planeIndex, world);

  updateLine(entries[0], center, pose.basisU, pose.widthMm * 1.02);
  updateLine(entries[1], center, pose.basisV, pose.heightMm * 1.02);
}

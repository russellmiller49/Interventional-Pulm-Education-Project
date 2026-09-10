import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkLineSource from '@kitware/vtk.js/Filters/Sources/LineSource';

import type { Vector3Tuple } from '../../../../../../features/case3d/types';

function add(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v: Vector3Tuple, scalar: number): Vector3Tuple {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

export function createCrosshairActors(center: Vector3Tuple, length = 14) {
  const axes: Vector3Tuple[] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  return axes.map((axis) => {
    const source = vtkLineSource.newInstance({
      point1: add(center, scale(axis, -length / 2)),
      point2: add(center, scale(axis, length / 2)),
      resolution: 1,
    });
    const mapper = vtkMapper.newInstance();
    mapper.setInputConnection(source.getOutputPort());

    const actor = vtkActor.newInstance();
    actor.setMapper(mapper);
    actor.getProperty().setColor(0.98, 0.86, 0.36);
    actor.getProperty().setLineWidth(2.4);

    return { actor, source };
  });
}

export function updateCrosshairActors(
  crosshair: Array<{ source: ReturnType<typeof vtkLineSource.newInstance> }>,
  center: Vector3Tuple,
  length = 14,
) {
  const axes: Vector3Tuple[] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  crosshair.forEach((entry, index) => {
    const axis = axes[index];
    entry.source.setPoint1(...add(center, scale(axis, -length / 2)));
    entry.source.setPoint2(...add(center, scale(axis, length / 2)));
    entry.source.modified();
  });
}

import vtkGLTFImporter from '@kitware/vtk.js/IO/Geometry/GLTFImporter';
import type vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';

import { normalizeStructureKey } from '../structureKeys';
import { rowMajorToColumnMajor } from './coordinateTransforms';

import type { RuntimeCaseManifest } from '../../../../../../features/case3d/types';

type GlbSceneNode = {
  id: string | number;
  name?: string;
  children?: GlbSceneNode[];
};

export interface LoadedGlbOverlay {
  importer: vtkGLTFImporter;
  namedActors: Map<string, any[]>;
}

function multiplyColumnMajorMatrices(left: ArrayLike<number>, right: ArrayLike<number>) {
  const output = new Float32Array(16);

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      output[column * 4 + row] =
        left[0 * 4 + row] * right[column * 4 + 0] +
        left[1 * 4 + row] * right[column * 4 + 1] +
        left[2 * 4 + row] * right[column * 4 + 2] +
        left[3 * 4 + row] * right[column * 4 + 3];
    }
  }

  return output;
}

function collectNamedActors(importer: vtkGLTFImporter) {
  const namedActors = new Map<string, any[]>();
  const actorMap = importer.getActors();
  const scenes = (importer as vtkGLTFImporter & {
    getScenes?: () => Array<{ nodes?: GlbSceneNode[] }>;
  }).getScenes?.();

  function visit(node: GlbSceneNode) {
    const nodeKey = String(node.id);
    const actorsForNode = new Set<any>();
    const nodeActor = actorMap?.get(nodeKey);

    if (nodeActor) {
      actorsForNode.add(nodeActor);
    }

    actorMap?.forEach((actor, key) => {
      if (String(key).startsWith(`${nodeKey}_`)) {
        actorsForNode.add(actor);
      }
    });

    if (node.name && actorsForNode.size > 0) {
      const key = normalizeStructureKey(node.name);
      const existing = namedActors.get(key) ?? [];

      namedActors.set(
        key,
        [...new Set([...existing, ...actorsForNode])],
      );
    }

    node.children?.forEach(visit);
  }

  scenes?.forEach((scene) => scene.nodes?.forEach(visit));

  return namedActors;
}

export async function loadGlbOverlay(
  renderer: vtkRenderer,
  manifest: RuntimeCaseManifest,
  url: string,
): Promise<LoadedGlbOverlay> {
  const importer = vtkGLTFImporter.newInstance();
  importer.setRenderer(renderer);
  await importer.setUrl(url, { binary: true });
  await importer.loadData({ binary: true });
  importer.importActors();
  const matrix = rowMajorToColumnMajor(manifest.patientToScene.inverseMatrix);

  importer.getActors().forEach((actor) => {
    const actorMatrix = actor.getUserMatrix?.();
    actor.setUserMatrix(actorMatrix ? multiplyColumnMajorMatrices(matrix, actorMatrix) : matrix);
  });

  return {
    importer,
    namedActors: collectNamedActors(importer),
  };
}

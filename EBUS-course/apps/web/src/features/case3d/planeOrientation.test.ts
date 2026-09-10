import { describe, expect, it } from 'vitest';

import case001RuntimeData from '../../../../../content/cases/case_001.runtime.json';

import { getPlanePoseAtAxisIndex, projectWorldPointToPlaneUv } from '../../../../../features/case3d/patient-space';
import type { RuntimeCaseManifest } from '../../../../../features/case3d/types';

const manifest = case001RuntimeData as unknown as RuntimeCaseManifest;

describe('case3d plane display orientation', () => {
  it('shows axial CT in radiology orientation with patient right on image left', () => {
    const pose = getPlanePoseAtAxisIndex(manifest.volumeGeometry, 'axial', 89);
    const uv = projectWorldPointToPlaneUv([pose.center[0] - 10, pose.center[1], pose.center[2]], pose);

    expect(pose.basisU[0]).toBeGreaterThan(0);
    expect(uv.u).toBeLessThan(0.5);
  });

  it('keeps coronal CT in facing-patient orientation with patient right on image left', () => {
    const pose = getPlanePoseAtAxisIndex(manifest.volumeGeometry, 'coronal', 114);
    const uv = projectWorldPointToPlaneUv([pose.center[0] - 10, pose.center[1], pose.center[2]], pose);

    expect(pose.basisU[0]).toBeGreaterThan(0);
    expect(uv.u).toBeLessThan(0.5);
  });
});

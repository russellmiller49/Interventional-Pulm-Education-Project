import { useMemo } from 'react';

import type { Vector3Tuple } from '../../../../../features/case3d/types';

export function useCutPlane(origin: Vector3Tuple, normal: Vector3Tuple) {
  return useMemo(
    () => ({
      origin,
      normal,
    }),
    [normal, origin],
  );
}

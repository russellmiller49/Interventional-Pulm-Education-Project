import { useEffect, useRef, useState } from 'react';

import { case001AssetUrls } from './case001';
import { loadCaseVolume, type LoadedCaseVolume } from './vtk/loadCaseVolume';
import { loadSegmentation, type LoadedSegmentation } from './vtk/loadSegmentation';

interface CaseVolumeStatus {
  error: string | null;
  loading: boolean;
}

// VTK image objects are stored in a ref so React's dev-mode effect logger
// never attempts to deeply serialize millions of voxels (which triggers
// "RangeError: Invalid array length" and kills the entire render tree).
interface CaseVolumeData {
  ct: LoadedCaseVolume | null;
  segmentation: LoadedSegmentation | null;
}

export function useCaseVolume() {
  const dataRef = useRef<CaseVolumeData>({ ct: null, segmentation: null });
  const [status, setStatus] = useState<CaseVolumeStatus>({
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [ct, segmentation] = await Promise.all([
          loadCaseVolume(case001AssetUrls.ct),
          loadSegmentation(case001AssetUrls.segmentation),
        ]);

        if (cancelled) {
          return;
        }

        dataRef.current = { ct, segmentation };
        setStatus({ error: null, loading: false });
      } catch (error) {
        if (cancelled) {
          return;
        }

        dataRef.current = { ct: null, segmentation: null };
        setStatus({
          error: error instanceof Error ? error.message : 'Case volume could not be loaded.',
          loading: false,
        });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    ...status,
    ct: dataRef.current.ct,
    segmentation: dataRef.current.segmentation,
  };
}

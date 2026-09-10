import { useEffect, useState } from 'react';

import {
  isKnobologyVideoLookup,
  KNOBOLOGY_LOOKUP_SRC,
  type KnobologyVideoLookup,
} from '@/features/knobology/videoSegments';

type LookupStatus = 'loading' | 'ready' | 'error';

export interface KnobologyVideoLookupState {
  lookup: KnobologyVideoLookup | null;
  status: LookupStatus;
}

export function useKnobologyVideoLookup(): KnobologyVideoLookupState {
  const [state, setState] = useState<KnobologyVideoLookupState>({
    lookup: null,
    status: 'loading',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadLookup() {
      try {
        const response = await fetch(KNOBOLOGY_LOOKUP_SRC);

        if (!response.ok) {
          throw new Error(`Unable to load knobology timeline: ${response.status}`);
        }

        const data: unknown = await response.json();

        if (!isKnobologyVideoLookup(data)) {
          throw new Error('Knobology timeline JSON did not match the expected shape.');
        }

        if (!cancelled) {
          setState({ lookup: data, status: 'ready' });
        }
      } catch {
        if (!cancelled) {
          setState({ lookup: null, status: 'error' });
        }
      }
    }

    void loadLookup();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

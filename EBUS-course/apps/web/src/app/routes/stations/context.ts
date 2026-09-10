import { useOutletContext } from 'react-router-dom';

import type {
  CombinedStation,
  StationExplorerModuleContent,
  StationMapLayout,
  StationMapModuleContent,
} from '@/content/types';

export interface StationsRouteContextValue {
  explorerContent: StationExplorerModuleContent;
  layout: StationMapLayout;
  mapContent: StationMapModuleContent;
  selectedStation: CombinedStation | undefined;
  selectedStationId: string;
  selectStation: (stationId: string) => void;
  stations: CombinedStation[];
}

export function useStationsRouteContext() {
  return useOutletContext<StationsRouteContextValue>();
}

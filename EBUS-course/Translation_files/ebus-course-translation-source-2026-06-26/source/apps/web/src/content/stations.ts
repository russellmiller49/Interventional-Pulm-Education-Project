import stationMapContentData from '../../../../content/modules/station-map.json';
import stationExplorerContentData from '../../../../content/modules/station-explorer.json';
import stationCorrelationsData from '../../../../content/stations/station-correlations.json';
import stationsData from '../../../../content/stations/core-stations.json';

import { getStationMedia } from '@/content/media';
import stationMapLayoutData from '@/content/station-map-layout.web.json';
import type {
  CombinedStation,
  ExplorerViewId,
  StationContent,
  StationCorrelationContent,
  StationMapConnection,
  StationMapLayout,
  StationMapModuleContent,
  StationExplorerModuleContent,
  StationZoneKey,
  ZoneTheme,
} from '@/content/types';

const stationMapLayout = stationMapLayoutData as StationMapLayout;
const stationMapContent = stationMapContentData as StationMapModuleContent;
const stationExplorerContent = stationExplorerContentData as StationExplorerModuleContent;
const stations = stationsData as StationContent[];
const stationCorrelations = stationCorrelationsData as StationCorrelationContent[];

export const zoneThemes: Record<StationZoneKey, ZoneTheme> = {
  upper: {
    bg: '#122a40',
    border: '#2d6ca3',
    text: '#90ccff',
    label: 'Upper Mediastinal',
  },
  subcarinal: {
    bg: '#123429',
    border: '#2d8a6a',
    text: '#88e0bd',
    label: 'Subcarinal',
  },
  hilar: {
    bg: '#36213b',
    border: '#8861a7',
    text: '#d6afe8',
    label: 'Hilar / Interlobar',
  },
};

export const stationConnections: StationMapConnection[] = [
  { from: '2R', to: '4R' },
  { from: '2L', to: '4L' },
  { from: '4R', to: '7' },
  { from: '4L', to: '7' },
  { from: '4R', to: '10R' },
  { from: '4L', to: '10L' },
  { from: '7', to: '10R' },
  { from: '7', to: '10L' },
  { from: '10R', to: '11Rs' },
  { from: '10R', to: '11Ri' },
  { from: '10L', to: '11L' },
];

function normalizeZone(zone: string): StationZoneKey {
  const lower = zone.toLowerCase();

  if (lower.includes('subcarinal')) {
    return 'subcarinal';
  }

  if (lower.includes('hilar')) {
    return 'hilar';
  }

  return 'upper';
}

function getNodeByStationId(stationId: string) {
  return stationMapLayout.nodes.find((node) => node.stationId === stationId);
}

function getCorrelationByStationId(stationId: string) {
  return stationCorrelations.find((entry) => entry.stationId === stationId);
}

export const combinedStations: CombinedStation[] = stations.flatMap((station) => {
  const mapNode = getNodeByStationId(station.id);
  const correlation = getCorrelationByStationId(station.id);

  if (!mapNode || !correlation) {
    return [];
  }

  return [
    {
      ...station,
      zoneKey: normalizeZone(station.zone),
      aliases: correlation.aliases,
      landmarkChecklist: correlation.landmarkChecklist,
      mapNode,
      views: correlation.views,
      quizItems: correlation.quizItems,
      media: getStationMedia(station.id),
    },
  ];
});

export function getStationMapContent(): StationMapModuleContent {
  return stationMapContent;
}

export function getStationExplorerContent(): StationExplorerModuleContent {
  return stationExplorerContent;
}

export function getStationMapLayout(): StationMapLayout {
  return stationMapLayout;
}

export function getStations(): CombinedStation[] {
  return combinedStations;
}

export function getStationById(stationId: string): CombinedStation | undefined {
  return combinedStations.find((station) => station.id === stationId);
}

export function getStationLabel(stationId: string): string {
  return getStationById(stationId)?.displayName ?? stationId;
}

export function getViewLabel(viewId: ExplorerViewId): string {
  if (viewId === 'ct') {
    return 'CT';
  }

  if (viewId === 'bronchoscopy') {
    return 'Bronchoscopy';
  }

  return 'EBUS';
}

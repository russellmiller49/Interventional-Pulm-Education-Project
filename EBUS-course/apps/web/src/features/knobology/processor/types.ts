import type { KnobologyMenuMode, KnobologyProcessorActionId } from '@/features/knobology/logic';

export interface EuMe2ImageMeta {
  src: string;
  width: number;
  height: number;
  notes?: string;
}

export interface EuMe2Trackball {
  cx: number;
  cy: number;
  r: number;
}

export interface EuMe2Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EuMe2PanelVariant {
  image: EuMe2ImageMeta;
  sourceRegion?: EuMe2Region;
}

interface EuMe2BaseHotspot {
  id: string;
  label: string;
  action: KnobologyProcessorActionId;
  visibleInMenus?: KnobologyMenuMode[];
}

export interface EuMe2RectHotspot extends EuMe2BaseHotspot {
  shape: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EuMe2CircleHotspot extends EuMe2BaseHotspot {
  shape: 'circle';
  cx: number;
  cy: number;
  r: number;
}

export interface EuMe2EllipseHotspot extends EuMe2BaseHotspot {
  shape: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export type EuMe2Hotspot = EuMe2RectHotspot | EuMe2CircleHotspot | EuMe2EllipseHotspot;

export interface EuMe2Layout {
  image: EuMe2ImageMeta;
  imageAdjustPanel?: EuMe2PanelVariant;
  trackball: EuMe2Trackball;
  regions: Record<string, EuMe2Region>;
  hotspots: EuMe2Hotspot[];
}

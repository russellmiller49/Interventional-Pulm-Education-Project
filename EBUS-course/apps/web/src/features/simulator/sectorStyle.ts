export type SectorStyle = 'classic' | 'realistic' | 'physics';

export const SECTOR_STYLE_STORAGE_KEY = 'ebus.sectorStyle';
export const SECTOR_STYLE_URL_PARAM = 'sectorStyle';
export const DEFAULT_SECTOR_STYLE: SectorStyle = 'realistic';
export const SECTOR_STYLE_OPTIONS: SectorStyle[] = ['classic', 'realistic', 'physics'];

export function normalizeSectorStyle(value: unknown): SectorStyle | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'classic' || normalized === 'realistic' || normalized === 'physics'
    ? normalized
    : null;
}

/**
 * Resolve the effective sector style with precedence URL > localStorage >
 * manifest > default. Unknown or missing values at any level fall through to
 * the next level rather than erroring.
 */
export function resolveSectorStyle(inputs: {
  urlValue?: unknown;
  storedValue?: unknown;
  manifestValue?: unknown;
}): SectorStyle {
  return (
    normalizeSectorStyle(inputs.urlValue)
    ?? normalizeSectorStyle(inputs.storedValue)
    ?? normalizeSectorStyle(inputs.manifestValue)
    ?? DEFAULT_SECTOR_STYLE
  );
}

export type SectorRenderPath = 'classic' | 'realistic' | 'physics';

/**
 * 'physics' draws the precomputed station-anchored snapshot PNG as the sector
 * background; when no snapshot is loaded for the current preset it renders
 * through the realistic path with a badge in the UI.
 */
export function sectorRenderPath(style: SectorStyle, physicsSnapshotReady = false): SectorRenderPath {
  if (style === 'classic') {
    return 'classic';
  }

  if (style === 'physics' && physicsSnapshotReady) {
    return 'physics';
  }

  return 'realistic';
}

export function readBrowserSectorStyle(manifestValue: unknown): SectorStyle {
  if (typeof window === 'undefined') {
    return resolveSectorStyle({ manifestValue });
  }

  let storedValue: string | null = null;
  try {
    storedValue = window.localStorage.getItem(SECTOR_STYLE_STORAGE_KEY);
  } catch {
    // Style persistence is optional; blocked storage should not affect rendering.
  }

  return resolveSectorStyle({
    urlValue: new URLSearchParams(window.location.search).get(SECTOR_STYLE_URL_PARAM),
    storedValue,
    manifestValue,
  });
}

export function persistSectorStyle(style: SectorStyle) {
  try {
    window.localStorage.setItem(SECTOR_STYLE_STORAGE_KEY, style);
  } catch {
    // Style persistence is optional; blocked storage should not affect rendering.
  }
}

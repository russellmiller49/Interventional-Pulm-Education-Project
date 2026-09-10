type JsonObject = Record<string, unknown>;

const preservedKeys = new Set([
  'id',
  'slug',
  'route',
  'path',
  'featureFolder',
  'category',
  'status',
  'kind',
  'type',
  'difficulty',
  'moduleId',
  'sourceFile',
  'key',
  'folder',
  'src',
  'video',
  'embedUrl',
  'poster',
  'thumbnail',
  'resourceUrl',
  'facilityUrl',
  'websiteUrl',
  'playlistUrl',
  'youtubeId',
  'stationId',
  'viewId',
  'zone',
  'accessProfile',
  'focusControl',
  'safePathId',
  'imageAssetKey',
  'imageIds',
  'assetKeys',
  'relatedStationIds',
  'requiredLectureIds',
  'correctOptionIds',
  'correctOptionId',
  'optionIds',
  'tags',
  'visualAnchor',
  'start',
  'target',
]);

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function mergeLocalizedValue<T>(base: T, overlay: unknown, key?: string): T {
  if (overlay === undefined || (key && preservedKeys.has(key))) {
    return base;
  }

  if (Array.isArray(base)) {
    if (!Array.isArray(overlay)) {
      return base;
    }

    if (base.every(isJsonObject)) {
      return base.map((entry, index) => mergeLocalizedValue(entry, overlay[index])) as T;
    }

    return overlay as T;
  }

  if (isJsonObject(base) && isJsonObject(overlay)) {
    return Object.fromEntries(
      Object.entries(base).map(([entryKey, entryValue]) => [
        entryKey,
        mergeLocalizedValue(entryValue, overlay[entryKey], entryKey),
      ]),
    ) as T;
  }

  return overlay as T;
}

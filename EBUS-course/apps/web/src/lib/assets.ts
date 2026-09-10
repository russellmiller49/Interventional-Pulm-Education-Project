const ASSET_PREFIXES = ['/media/', '/pipelines/', '/simulator/'] as const;
const ABSOLUTE_URL_PATTERN = /^(?:[a-z][a-z\d+\-.]*:)?\/\//i;

function normalizeBaseUrl(baseUrl: string | undefined): string {
  if (!baseUrl || baseUrl === '/') {
    return '';
  }

  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function shouldResolveAssetPath(value: string): boolean {
  return ASSET_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function resolveCourseAssetPath(value: string): string {
  if (!value || ABSOLUTE_URL_PATTERN.test(value) || !value.startsWith('/') || !shouldResolveAssetPath(value)) {
    return value;
  }

  const baseUrl = normalizeBaseUrl(import.meta.env.BASE_URL);

  if (!baseUrl || value.startsWith(`${baseUrl}/`)) {
    return value;
  }

  return `${baseUrl}${value}`;
}

export function mapNestedAssetPaths<T>(value: T): T {
  if (typeof value === 'string') {
    return resolveCourseAssetPath(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => mapNestedAssetPaths(entry)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, mapNestedAssetPaths(entry)]),
    ) as T;
  }

  return value;
}

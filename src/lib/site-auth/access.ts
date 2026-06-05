export type SiteEntitlement = 'ip_registry' | 'socal_ebus_course'

const PUBLIC_EXACT_PATHS = new Set([
  '/forgot-password',
  '/health',
  '/login',
  '/pocus',
  '/signup',
  '/verify-email',
  '/auth/update-password',
])

const PUBLIC_PREFIXES = [
  '/_next/',
  '/api/auth/callback',
  '/api/image-proxy',
  '/api/public/',
  '/auth/callback',
  '/pocus/auth/callback',
]

const STATIC_FILE_PATTERN =
  /\.(?:avif|bin|br|css|gif|glb|gltf|gz|ico|jpeg|jpg|js|json|map|mp4|mjs|nrrd|png|raw|stl|svg|txt|usdz|wasm|webmanifest|webp|woff|woff2|xml|zst)$/i

export function isStaticAssetPath(pathname: string) {
  return STATIC_FILE_PATTERN.test(pathname)
}

export function isLegacyEbusGatewayPath(pathname: string) {
  return (
    pathname === '/socal-ebus-course/app' ||
    pathname === '/socal-ebus-course/app/' ||
    pathname === '/socal-ebus-course/app/index.html'
  )
}

export function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT_PATHS.has(pathname)) {
    return true
  }

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true
  }

  if (isLegacyEbusGatewayPath(pathname)) {
    return true
  }

  if (pathname.startsWith('/socal-ebus-course/app/') && isStaticAssetPath(pathname)) {
    return true
  }

  if (pathname.startsWith('/bronch-navigation-trainer/app/') && isStaticAssetPath(pathname)) {
    return true
  }

  return isStaticAssetPath(pathname)
}

export function isAuthPath(pathname: string) {
  return (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/verify-email' ||
    pathname === '/auth/update-password' ||
    pathname.startsWith('/auth/callback')
  )
}

export function isPublicTrainingEmbed(pathname: string, searchParams: URLSearchParams) {
  if (!pathname.startsWith('/socal-ebus-course/app')) {
    return false
  }

  const publicScope = searchParams.get('publicScope')
  return (
    searchParams.get('publicTraining') === '1' && (publicScope === 'ebus' || publicScope === 'tnm')
  )
}

export function getRequiredEntitlement(
  pathname: string,
  searchParams: URLSearchParams,
): SiteEntitlement | null {
  if (pathname.startsWith('/ip-registry')) {
    return 'ip_registry'
  }

  if (pathname.startsWith('/socal-ebus-course/app')) {
    return isLegacyEbusGatewayPath(pathname) || isPublicTrainingEmbed(pathname, searchParams)
      ? null
      : 'socal_ebus_course'
  }

  if (pathname.startsWith('/socal-ebus-course')) {
    return 'socal_ebus_course'
  }

  return null
}

export function canUseLegacyEbusApproval(pathname: string, searchParams: URLSearchParams) {
  return getRequiredEntitlement(pathname, searchParams) === 'socal_ebus_course'
}

export function resolveLoginRedirectPath(pathname: string, search: string) {
  const target = `${pathname}${search}`
  if (!target.startsWith('/') || target.startsWith('//')) {
    return '/'
  }
  return target
}

export function resolveSiteModuleId(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const first = segments[0]

  if (
    !first ||
    isAuthPath(pathname) ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/pocus')
  ) {
    return null
  }

  if (first === 'board-prep') {
    return segments[1] ? `board-prep:${segments[1]}` : 'board-prep'
  }

  if (first === 'ebus-training') {
    return segments[1] ? `ebus-training:${segments[1]}` : 'ebus-training'
  }

  if (first === 'pleural-procedures') {
    return segments[1] ? `pleural-procedures:${segments[1]}` : 'pleural-procedures'
  }

  if (first === 'learn' && segments[1] === 'anatomy') {
    return 'anatomy'
  }

  if (first === 'education') {
    return segments.slice(0, 3).join(':')
  }

  if (
    first === 'bronch-navigation-trainer' ||
    first === 'fluoroview' ||
    first === 'intro-bronchoscopy' ||
    first === 'rapid-onsite-cytology' ||
    first === 'resources' ||
    first === 'tnm-9-staging' ||
    first === 'xr'
  ) {
    return segments.slice(0, 2).join(':')
  }

  return null
}

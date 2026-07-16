import { unlocalizedPathname } from '@/i18n/path'

export type SiteEntitlement =
  | 'ip_registry'
  | 'pccm_intro_course'
  | 'pccm_intro_course_admin_loma_linda'
  | 'pccm_intro_course_admin_ucsd'
  | 'site_admin'
  | 'socal_ebus_course'

const PUBLIC_EXACT_PATHS = new Set([
  '/forgot-password',
  '/health',
  '/api/scope-calibration',
  '/login',
  '/pocus',
  '/pleural-procedures/pleural-ultrasound-simulator',
  '/signup',
  '/verify-email',
  '/auth/update-password',
])

const PUBLIC_UNLISTED_EXACT_PATHS = new Set([
  '/cardiohelp-ecmo',
  '/mechanical-ventilation',
  '/hamilton-c6-ventilation',
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
  return STATIC_FILE_PATTERN.test(unlocalizedPathname(pathname))
}

export function isLegacyEbusGatewayPath(pathname: string) {
  const normalizedPathname = unlocalizedPathname(pathname)

  return (
    normalizedPathname === '/socal-ebus-course/app' ||
    normalizedPathname === '/socal-ebus-course/app/' ||
    normalizedPathname === '/socal-ebus-course/app/index.html'
  )
}

export function isCtAlignmentSandboxPath(pathname: string) {
  const normalizedPathname = unlocalizedPathname(pathname)

  return (
    normalizedPathname === '/learn/anatomy/ct-alignment' ||
    normalizedPathname.startsWith('/learn/anatomy/ct-alignment/')
  )
}

export function isDevOnlyAirwayAnatomyPath(pathname: string) {
  const normalizedPathname = unlocalizedPathname(pathname)

  return (
    normalizedPathname === '/learn/anatomy/airway' ||
    normalizedPathname.startsWith('/learn/anatomy/airway/') ||
    normalizedPathname === '/airway-anatomy' ||
    normalizedPathname.startsWith('/airway-anatomy/')
  )
}

export function isAdminOnlyAirwayStentMechanicsAssetPath(pathname: string) {
  const normalizedPathname = unlocalizedPathname(pathname)

  return (
    normalizedPathname.startsWith('/airway-stent-mechanics/models/') &&
    !isAuthenticatedAirwayStentMechanicsAssetPath(normalizedPathname)
  )
}

export function isAuthenticatedAirwayStentMechanicsAssetPath(pathname: string) {
  const normalizedPathname = unlocalizedPathname(pathname)

  return (
    normalizedPathname === '/airway-stent-mechanics/models/v2' ||
    normalizedPathname.startsWith('/airway-stent-mechanics/models/v2/')
  )
}

export function isPccmIntroCourseSharedModulePath(pathname: string) {
  const normalizedPathname = unlocalizedPathname(pathname)

  return (
    normalizedPathname === '/intro-bronchoscopy' ||
    normalizedPathname.startsWith('/intro-bronchoscopy/') ||
    normalizedPathname === '/pleural-procedures' ||
    normalizedPathname.startsWith('/pleural-procedures/')
  )
}

export function isPccmIntroCourseAdminDashboardPath(pathname: string) {
  const normalizedPathname = unlocalizedPathname(pathname)

  return (
    normalizedPathname === '/admin/pccm-intro-course' ||
    normalizedPathname.startsWith('/admin/pccm-intro-course/')
  )
}

export function isAdminOnlyEbusTrainingAssetPath(pathname: string) {
  const normalizedPathname = unlocalizedPathname(pathname)

  if (!normalizedPathname.startsWith('/socal-ebus-course/app/')) {
    return false
  }

  return (
    normalizedPathname.startsWith('/socal-ebus-course/app/pipelines/') ||
    /\/assets\/(?:Case001Page-|CT_segmentation_[12]-|case_001_(?:ct|segmentation)-|itk-wasm-pipeline\.worker-)/.test(
      normalizedPathname,
    )
  )
}

export function isPublicPath(pathname: string) {
  const normalizedPathname = unlocalizedPathname(pathname)

  if (
    isDevOnlyAirwayAnatomyPath(normalizedPathname) ||
    isAdminOnlyAirwayStentMechanicsAssetPath(normalizedPathname) ||
    isAuthenticatedAirwayStentMechanicsAssetPath(normalizedPathname) ||
    isAdminOnlyEbusTrainingAssetPath(normalizedPathname)
  ) {
    return false
  }

  if (
    PUBLIC_EXACT_PATHS.has(normalizedPathname) ||
    PUBLIC_UNLISTED_EXACT_PATHS.has(normalizedPathname)
  ) {
    return true
  }

  if (PUBLIC_PREFIXES.some((prefix) => normalizedPathname.startsWith(prefix))) {
    return true
  }

  if (isLegacyEbusGatewayPath(normalizedPathname)) {
    return true
  }

  if (
    normalizedPathname.startsWith('/socal-ebus-course/app/') &&
    isStaticAssetPath(normalizedPathname)
  ) {
    return true
  }

  if (
    normalizedPathname.startsWith('/bronch-navigation-trainer/app/') &&
    isStaticAssetPath(normalizedPathname)
  ) {
    return true
  }

  return isStaticAssetPath(normalizedPathname)
}

export function isPublicUnlistedPath(pathname: string) {
  return PUBLIC_UNLISTED_EXACT_PATHS.has(unlocalizedPathname(pathname))
}

export function isAuthPath(pathname: string) {
  const normalizedPathname = unlocalizedPathname(pathname)

  return (
    normalizedPathname === '/login' ||
    normalizedPathname === '/signup' ||
    normalizedPathname === '/forgot-password' ||
    normalizedPathname === '/verify-email' ||
    normalizedPathname === '/auth/update-password' ||
    normalizedPathname.startsWith('/auth/callback')
  )
}

export function isPublicTrainingEmbed(pathname: string, searchParams: URLSearchParams) {
  const normalizedPathname = unlocalizedPathname(pathname)

  if (!normalizedPathname.startsWith('/socal-ebus-course/app')) {
    return false
  }

  if (searchParams.get('adminPreview') === '1') {
    return false
  }

  const publicScope = searchParams.get('publicScope')
  return (
    searchParams.get('publicTraining') === '1' && (publicScope === 'ebus' || publicScope === 'tnm')
  )
}

export function isAdminEbusPreviewEmbed(pathname: string, searchParams: URLSearchParams) {
  return (
    isLegacyEbusGatewayPath(unlocalizedPathname(pathname)) &&
    searchParams.get('adminPreview') === '1'
  )
}

export function getRequiredEntitlement(
  pathname: string,
  searchParams: URLSearchParams,
): SiteEntitlement | null {
  const normalizedPathname = unlocalizedPathname(pathname)

  if (
    isDevOnlyAirwayAnatomyPath(normalizedPathname) ||
    isAdminOnlyAirwayStentMechanicsAssetPath(normalizedPathname) ||
    isAdminOnlyEbusTrainingAssetPath(normalizedPathname)
  ) {
    return 'site_admin'
  }

  if (normalizedPathname === '/admin' || normalizedPathname.startsWith('/admin/')) {
    return 'site_admin'
  }

  if (normalizedPathname.startsWith('/ip-registry')) {
    return 'ip_registry'
  }

  if (normalizedPathname.startsWith('/pccm-intro-course')) {
    return 'pccm_intro_course'
  }

  if (isAdminEbusPreviewEmbed(normalizedPathname, searchParams)) {
    return 'site_admin'
  }

  if (normalizedPathname.startsWith('/socal-ebus-course/app')) {
    return isLegacyEbusGatewayPath(normalizedPathname) ||
      isPublicTrainingEmbed(normalizedPathname, searchParams)
      ? null
      : 'socal_ebus_course'
  }

  if (normalizedPathname.startsWith('/socal-ebus-course')) {
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
  const normalizedPathname = unlocalizedPathname(pathname)
  const segments = normalizedPathname.split('/').filter(Boolean)
  const first = segments[0]

  if (
    !first ||
    isAuthPath(normalizedPathname) ||
    normalizedPathname.startsWith('/api') ||
    normalizedPathname.startsWith('/pocus')
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

  if (first === 'mechanical-ventilation' || first === 'hamilton-c6-ventilation') {
    return 'mechanical-ventilation'
  }

  if (first === 'baxter-crrt') {
    return 'baxter-crrt'
  }

  if (
    first === 'pccm-intro-course' ||
    first === 'bronch-navigation-trainer' ||
    first === 'cardiohelp-ecmo' ||
    first === 'fluoroview' ||
    first === 'intro-bronchoscopy' ||
    first === 'journal-club-podcasts' ||
    first === 'peripheral-ablation' ||
    first === 'rapid-onsite-cytology' ||
    first === 'resources' ||
    first === 'rigid-bronchoscopy' ||
    first === 'therapeutic-bronchoscopy' ||
    first === 'thermal-ablation' ||
    first === 'tracheostomy' ||
    first === 'tnm-9-staging' ||
    first === 'xr'
  ) {
    return segments.slice(0, 2).join(':')
  }

  return null
}

import {
  canUseLegacyEbusApproval,
  getRequiredEntitlement,
  isCtAlignmentSandboxPath,
  isLegacyEbusGatewayPath,
  isPublicPath,
  resolveLoginRedirectPath,
  resolveSiteModuleId,
} from './access'

function params(query = '') {
  return new URLSearchParams(query)
}

describe('main site auth access helpers', () => {
  it('keeps auth and reset pages public', () => {
    expect(isPublicPath('/')).toBe(false)
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/signup')).toBe(true)
    expect(isPublicPath('/forgot-password')).toBe(true)
    expect(isPublicPath('/auth/update-password')).toBe(true)
    expect(isPublicPath('/verify-email')).toBe(true)
    expect(isPublicPath('/api/scope-calibration')).toBe(true)
  })

  it('does not treat POCUS as a protected website module', () => {
    expect(isPublicPath('/pocus/auth/callback')).toBe(true)
    expect(resolveSiteModuleId('/pocus/cases')).toBeNull()
  })

  it('requires entitlements only for restricted website areas', () => {
    expect(getRequiredEntitlement('/admin', params())).toBe('site_admin')
    expect(getRequiredEntitlement('/admin/analytics', params())).toBe('site_admin')
    expect(getRequiredEntitlement('/ip-registry', params())).toBe('ip_registry')
    expect(getRequiredEntitlement('/socal-ebus-course', params())).toBe('socal_ebus_course')
    expect(getRequiredEntitlement('/ebus-training', params())).toBeNull()
    expect(getRequiredEntitlement('/tnm-9-staging', params())).toBeNull()
  })

  it('keeps public EBUS embeds open while gating the full generated app shell', () => {
    expect(
      getRequiredEntitlement(
        '/socal-ebus-course/app/index.html',
        params('publicTraining=1&publicScope=ebus'),
      ),
    ).toBeNull()
    expect(getRequiredEntitlement('/socal-ebus-course/app/index.html', params())).toBeNull()
    expect(getRequiredEntitlement('/socal-ebus-course/app/private-route', params())).toBe(
      'socal_ebus_course',
    )
  })

  it('keeps the legacy EBUS course gateway directly accessible', () => {
    expect(isLegacyEbusGatewayPath('/socal-ebus-course/app')).toBe(true)
    expect(isLegacyEbusGatewayPath('/socal-ebus-course/app/')).toBe(true)
    expect(isLegacyEbusGatewayPath('/socal-ebus-course/app/index.html')).toBe(true)
    expect(isPublicPath('/socal-ebus-course/app/index.html')).toBe(true)
    expect(isPublicPath('/socal-ebus-course')).toBe(false)
  })

  it('recognizes the dev-only CT alignment sandbox path', () => {
    expect(isCtAlignmentSandboxPath('/learn/anatomy/ct-alignment')).toBe(true)
    expect(isCtAlignmentSandboxPath('/learn/anatomy/ct-alignment/tools')).toBe(true)
    expect(isCtAlignmentSandboxPath('/learn/anatomy')).toBe(false)
  })

  it('uses legacy EBUS approval only for the restricted course area', () => {
    expect(canUseLegacyEbusApproval('/socal-ebus-course', params())).toBe(true)
    expect(canUseLegacyEbusApproval('/socal-ebus-course/app/index.html', params())).toBe(false)
    expect(
      canUseLegacyEbusApproval(
        '/socal-ebus-course/app/index.html',
        params('publicTraining=1&publicScope=ebus'),
      ),
    ).toBe(false)
    expect(canUseLegacyEbusApproval('/ip-registry', params())).toBe(false)
    expect(canUseLegacyEbusApproval('/ebus-training', params())).toBe(false)
  })

  it('allows generated static assets without making generated html public', () => {
    expect(isPublicPath('/socal-ebus-course/app/assets/module.js')).toBe(true)
    expect(isPublicPath('/socal-ebus-course/app/other.html')).toBe(false)
  })

  it('normalizes unsafe login redirects', () => {
    expect(resolveLoginRedirectPath('/resources', '?topic=rose')).toBe('/resources?topic=rose')
    expect(resolveLoginRedirectPath('//evil.example', '')).toBe('/')
  })
})

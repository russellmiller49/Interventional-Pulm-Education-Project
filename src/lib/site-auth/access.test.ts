import {
  isAdminOnlyEbusTrainingAssetPath,
  isAdminOnlyThermalAblationPath,
  isAdminEbusPreviewEmbed,
  canUseLegacyEbusApproval,
  getRequiredEntitlement,
  isCtAlignmentSandboxPath,
  isDevOnlyAirwayAnatomyPath,
  isLegacyEbusGatewayPath,
  isPccmIntroCourseAdminDashboardPath,
  isPccmIntroCourseSharedModulePath,
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

  it('keeps the experimental pleural ultrasound simulator publicly smoke-testable', () => {
    expect(isPublicPath('/pleural-procedures/pleural-ultrasound-simulator')).toBe(true)
    expect(isPublicPath('/pleural-procedures/pleural-ultrasound')).toBe(false)
  })

  it('requires login for the journal club podcast library while preserving module tracking', () => {
    expect(isPublicPath('/journal-club-podcasts')).toBe(false)
    expect(isPublicPath('/es/journal-club-podcasts')).toBe(false)
    expect(isPublicPath('/zh-CN/journal-club-podcasts')).toBe(false)
    expect(getRequiredEntitlement('/journal-club-podcasts', params())).toBeNull()
    expect(getRequiredEntitlement('/es/journal-club-podcasts', params())).toBeNull()
    expect(resolveSiteModuleId('/journal-club-podcasts')).toBe('journal-club-podcasts')
    expect(resolveSiteModuleId('/zh-CN/journal-club-podcasts')).toBe('journal-club-podcasts')
  })

  it('requires entitlements only for restricted website areas', () => {
    expect(getRequiredEntitlement('/admin', params())).toBe('site_admin')
    expect(getRequiredEntitlement('/admin/analytics', params())).toBe('site_admin')
    expect(getRequiredEntitlement('/es/admin', params())).toBe('site_admin')
    expect(getRequiredEntitlement('/zh-CN/admin/analytics', params())).toBe('site_admin')
    expect(getRequiredEntitlement('/ip-registry', params())).toBe('ip_registry')
    expect(getRequiredEntitlement('/pccm-intro-course', params())).toBe('pccm_intro_course')
    expect(getRequiredEntitlement('/es/pccm-intro-course', params())).toBe('pccm_intro_course')
    expect(
      getRequiredEntitlement('/pccm-intro-course/assessments/bronchoscopy_pre', params()),
    ).toBe('pccm_intro_course')
    expect(getRequiredEntitlement('/socal-ebus-course', params())).toBe('socal_ebus_course')
    expect(getRequiredEntitlement('/ebus-training', params())).toBeNull()
    expect(getRequiredEntitlement('/es/ebus-training', params())).toBeNull()
    expect(getRequiredEntitlement('/tnm-9-staging', params())).toBeNull()
  })

  it('recognizes the shared PCCM intro course module paths', () => {
    expect(isPccmIntroCourseSharedModulePath('/intro-bronchoscopy')).toBe(true)
    expect(isPccmIntroCourseSharedModulePath('/intro-bronchoscopy/airway-anatomy')).toBe(true)
    expect(isPccmIntroCourseSharedModulePath('/pleural-procedures')).toBe(true)
    expect(isPccmIntroCourseSharedModulePath('/es/pleural-procedures/clinical-review')).toBe(true)
    expect(isPccmIntroCourseSharedModulePath('/pccm-intro-course')).toBe(false)
  })

  it('recognizes the scoped PCCM intro course admin dashboard path', () => {
    expect(isPccmIntroCourseAdminDashboardPath('/admin/pccm-intro-course')).toBe(true)
    expect(isPccmIntroCourseAdminDashboardPath('/es/admin/pccm-intro-course')).toBe(true)
    expect(isPccmIntroCourseAdminDashboardPath('/admin/pccm-intro-course/users')).toBe(true)
    expect(isPccmIntroCourseAdminDashboardPath('/admin')).toBe(false)
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

  it('requires site admin for the virtual bronchoscopy EBUS preview embed', () => {
    expect(
      isAdminEbusPreviewEmbed('/socal-ebus-course/app/index.html', params('adminPreview=1')),
    ).toBe(true)
    expect(
      getRequiredEntitlement('/socal-ebus-course/app/index.html', params('adminPreview=1')),
    ).toBe('site_admin')
    expect(
      getRequiredEntitlement(
        '/socal-ebus-course/app/index.html',
        params('adminPreview=1&publicTraining=1&publicScope=ebus'),
      ),
    ).toBe('site_admin')
    expect(
      isAdminEbusPreviewEmbed(
        '/socal-ebus-course/app/index.html',
        params('publicTraining=1&publicScope=ebus'),
      ),
    ).toBe(false)
  })

  it('keeps the legacy EBUS course gateway directly accessible', () => {
    expect(isLegacyEbusGatewayPath('/socal-ebus-course/app')).toBe(true)
    expect(isLegacyEbusGatewayPath('/socal-ebus-course/app/')).toBe(true)
    expect(isLegacyEbusGatewayPath('/socal-ebus-course/app/index.html')).toBe(true)
    expect(isLegacyEbusGatewayPath('/es/socal-ebus-course/app/index.html')).toBe(true)
    expect(isPublicPath('/socal-ebus-course/app/index.html')).toBe(true)
    expect(isPublicPath('/socal-ebus-course')).toBe(false)
  })

  it('recognizes the dev-only CT alignment sandbox path', () => {
    expect(isCtAlignmentSandboxPath('/learn/anatomy/ct-alignment')).toBe(true)
    expect(isCtAlignmentSandboxPath('/learn/anatomy/ct-alignment/tools')).toBe(true)
    expect(isCtAlignmentSandboxPath('/learn/anatomy')).toBe(false)
  })

  it('recognizes dev-only airway anatomy routes and assets', () => {
    expect(isDevOnlyAirwayAnatomyPath('/learn/anatomy/airway')).toBe(true)
    expect(isDevOnlyAirwayAnatomyPath('/learn/anatomy/airway/segmental')).toBe(true)
    expect(isDevOnlyAirwayAnatomyPath('/airway-anatomy/case-001/case_manifest.json')).toBe(true)
    expect(isDevOnlyAirwayAnatomyPath('/learn/anatomy')).toBe(false)
    expect(isDevOnlyAirwayAnatomyPath('/bronch-navigation-trainer')).toBe(false)
  })

  it('requires site admin for synchronized airway anatomy routes and assets', () => {
    expect(getRequiredEntitlement('/learn/anatomy/airway', params())).toBe('site_admin')
    expect(getRequiredEntitlement('/zh-CN/learn/anatomy/airway', params())).toBe('site_admin')
    expect(getRequiredEntitlement('/airway-anatomy/case-001/case_manifest.json', params())).toBe(
      'site_admin',
    )
    expect(isPublicPath('/airway-anatomy/case-001/case_manifest.json')).toBe(false)
  })

  it('requires site admin for the thermal ablation module route and static assets', () => {
    expect(isAdminOnlyThermalAblationPath('/thermal-ablation')).toBe(true)
    expect(isAdminOnlyThermalAblationPath('/thermal-ablation/index.html')).toBe(true)
    expect(isAdminOnlyThermalAblationPath('/thermal-ablation/any-asset.js')).toBe(true)
    expect(isAdminOnlyThermalAblationPath('/es/thermal-ablation')).toBe(true)
    expect(isAdminOnlyThermalAblationPath('/thermal-ablation-extra')).toBe(false)
    expect(getRequiredEntitlement('/thermal-ablation', params())).toBe('site_admin')
    expect(getRequiredEntitlement('/zh-CN/thermal-ablation', params())).toBe('site_admin')
    expect(getRequiredEntitlement('/thermal-ablation/index.html', params())).toBe('site_admin')
    expect(getRequiredEntitlement('/thermal-ablation/any-asset.js', params())).toBe('site_admin')
    expect(isPublicPath('/thermal-ablation/index.html')).toBe(false)
    expect(isPublicPath('/thermal-ablation/any-asset.js')).toBe(false)
    expect(resolveSiteModuleId('/thermal-ablation')).toBe('thermal-ablation')
  })

  it('keeps virtual EBUS simulator artifacts out of public static access', () => {
    expect(
      isAdminOnlyEbusTrainingAssetPath('/socal-ebus-course/app/assets/Case001Page-abc.js'),
    ).toBe(true)
    expect(
      isAdminOnlyEbusTrainingAssetPath('/socal-ebus-course/app/assets/case_001_ct-abc.nrrd'),
    ).toBe(true)
    expect(isAdminOnlyEbusTrainingAssetPath('/socal-ebus-course/app/assets/index-abc.js')).toBe(
      false,
    )
    expect(
      getRequiredEntitlement('/socal-ebus-course/app/assets/Case001Page-abc.js', params()),
    ).toBe('site_admin')
    expect(isPublicPath('/socal-ebus-course/app/assets/Case001Page-abc.js')).toBe(false)
    expect(isPublicPath('/socal-ebus-course/app/assets/index-abc.js')).toBe(true)
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

  it('tracks PCCM course routes as site modules', () => {
    expect(resolveSiteModuleId('/pccm-intro-course')).toBe('pccm-intro-course')
    expect(resolveSiteModuleId('/pccm-intro-course/assessments/pleural_post')).toBe(
      'pccm-intro-course:assessments',
    )
  })

  it('normalizes unsafe login redirects', () => {
    expect(resolveLoginRedirectPath('/resources', '?topic=rose')).toBe('/resources?topic=rose')
    expect(resolveLoginRedirectPath('//evil.example', '')).toBe('/')
  })
})

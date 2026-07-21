import {
  isAdminOnlyAirwayStentMechanicsAssetPath,
  isAdminOnlyEbusTrainingAssetPath,
  isAuthenticatedAirwayStentMechanicsAssetPath,
  isAdminEbusPreviewEmbed,
  canUseLegacyEbusApproval,
  getRequiredEntitlement,
  isCtAlignmentSandboxPath,
  isDevOnlyAirwayAnatomyPath,
  isLegacyEbusGatewayPath,
  isPccmIntroCourseAdminDashboardPath,
  isPccmIntroCourseSharedModulePath,
  isPublicPath,
  isPublicUnlistedPath,
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

  it('keeps the CARDIOHELP ECMO module and its subroutes public but unlisted with one analytics id', () => {
    expect(isPublicPath('/cardiohelp-ecmo')).toBe(true)
    expect(isPublicPath('/es/cardiohelp-ecmo')).toBe(true)
    expect(isPublicPath('/zh-CN/cardiohelp-ecmo')).toBe(true)
    expect(isPublicPath('/cardiohelp-ecmo/learn')).toBe(true)
    expect(isPublicPath('/es/cardiohelp-ecmo/practice')).toBe(true)
    expect(isPublicUnlistedPath('/cardiohelp-ecmo')).toBe(true)
    expect(isPublicUnlistedPath('/es/cardiohelp-ecmo')).toBe(true)
    // Subroutes intentionally inherit the parent's public-unlisted treatment.
    expect(isPublicUnlistedPath('/cardiohelp-ecmo/learn')).toBe(true)
    expect(isPublicUnlistedPath('/cardiohelp-ecmo/assess')).toBe(true)
    expect(isPublicUnlistedPath('/zh-CN/cardiohelp-ecmo/practice')).toBe(true)
    // Other unlisted modules stay exact-match only.
    expect(isPublicUnlistedPath('/mechanical-ventilation/extra')).toBe(false)
    expect(getRequiredEntitlement('/cardiohelp-ecmo', params())).toBeNull()
    expect(getRequiredEntitlement('/cardiohelp-ecmo/learn', params())).toBeNull()
    expect(resolveSiteModuleId('/cardiohelp-ecmo')).toBe('cardiohelp-ecmo')
    expect(resolveSiteModuleId('/zh-CN/cardiohelp-ecmo')).toBe('cardiohelp-ecmo')
    expect(resolveSiteModuleId('/cardiohelp-ecmo/learn')).toBe('cardiohelp-ecmo')
    expect(resolveSiteModuleId('/es/cardiohelp-ecmo/practice')).toBe('cardiohelp-ecmo')
  })

  it('keeps the mechanical ventilation tester route public but unlisted and resolves both URLs to one module', () => {
    expect(isPublicPath('/mechanical-ventilation')).toBe(true)
    expect(isPublicPath('/es/mechanical-ventilation')).toBe(true)
    expect(isPublicPath('/hamilton-c6-ventilation')).toBe(true)
    expect(isPublicPath('/es/hamilton-c6-ventilation')).toBe(true)
    expect(isPublicUnlistedPath('/mechanical-ventilation')).toBe(true)
    expect(isPublicUnlistedPath('/es/mechanical-ventilation')).toBe(true)
    expect(isPublicUnlistedPath('/hamilton-c6-ventilation')).toBe(true)
    expect(isPublicUnlistedPath('/es/hamilton-c6-ventilation')).toBe(true)
    expect(isPublicUnlistedPath('/mechanical-ventilation/extra')).toBe(false)
    expect(getRequiredEntitlement('/mechanical-ventilation', params())).toBeNull()
    expect(getRequiredEntitlement('/hamilton-c6-ventilation', params())).toBeNull()
    expect(resolveSiteModuleId('/mechanical-ventilation')).toBe('mechanical-ventilation')
    expect(resolveSiteModuleId('/zh-CN/mechanical-ventilation')).toBe('mechanical-ventilation')
    expect(resolveSiteModuleId('/hamilton-c6-ventilation')).toBe('mechanical-ventilation')
    expect(resolveSiteModuleId('/zh-CN/hamilton-c6-ventilation')).toBe('mechanical-ventilation')
  })

  it('keeps the ICU hemodynamics preview public-unlisted with one localized analytics id', () => {
    expect(isPublicPath('/icu-hemodynamics')).toBe(true)
    expect(isPublicPath('/es/icu-hemodynamics')).toBe(true)
    expect(isPublicUnlistedPath('/icu-hemodynamics')).toBe(true)
    expect(isPublicUnlistedPath('/zh-CN/icu-hemodynamics')).toBe(true)
    expect(isPublicUnlistedPath('/icu-hemodynamics/extra')).toBe(false)
    expect(getRequiredEntitlement('/icu-hemodynamics', params())).toBeNull()
    expect(resolveSiteModuleId('/icu-hemodynamics')).toBe('icu-hemodynamics')
    expect(resolveSiteModuleId('/es/icu-hemodynamics')).toBe('icu-hemodynamics')
  })

  it('keeps the MCS lab and its subroutes public-unlisted with one analytics id', () => {
    for (const path of [
      '/mechanical-circulatory-support',
      '/es/mechanical-circulatory-support',
      '/mechanical-circulatory-support/learn',
      '/zh-CN/mechanical-circulatory-support/practice',
      '/mechanical-circulatory-support/assess',
    ]) {
      expect(isPublicPath(path)).toBe(true)
      expect(isPublicUnlistedPath(path)).toBe(true)
      expect(getRequiredEntitlement(path, params())).toBeNull()
      expect(resolveSiteModuleId(path)).toBe('mechanical-circulatory-support')
    }
  })

  it('keeps the localized SOCRATES demo public, unlisted, and exact-match only', () => {
    for (const path of ['/socrates-demo', '/es/socrates-demo', '/zh-CN/socrates-demo']) {
      expect(isPublicPath(path)).toBe(true)
      expect(isPublicUnlistedPath(path)).toBe(true)
      expect(getRequiredEntitlement(path, params())).toBeNull()
      expect(resolveSiteModuleId(path)).toBe('socrates-demo')
    }

    expect(isPublicPath('/socrates-demo/extra')).toBe(false)
    expect(isPublicUnlistedPath('/socrates-demo/extra')).toBe(false)
  })

  it('keeps Baxter CRRT authenticated, non-public, and on one localized analytics ID', () => {
    for (const path of ['/baxter-crrt', '/es/baxter-crrt', '/zh-CN/baxter-crrt']) {
      expect(isPublicPath(path)).toBe(false)
      expect(isPublicUnlistedPath(path)).toBe(false)
      expect(getRequiredEntitlement(path, params())).toBeNull()
      expect(resolveSiteModuleId(path)).toBe('baxter-crrt')
    }
    expect(resolveSiteModuleId('/en/baxter-crrt/orientation')).toBe('baxter-crrt')
  })

  it('requires entitlements only for restricted website areas', () => {
    expect(getRequiredEntitlement('/admin', params())).toBe('site_admin')
    expect(getRequiredEntitlement('/admin/analytics', params())).toBe('site_admin')
    expect(getRequiredEntitlement('/es/admin', params())).toBe('site_admin')
    expect(getRequiredEntitlement('/zh-CN/admin/analytics', params())).toBe('site_admin')
    expect(getRequiredEntitlement('/ip-registry', params())).toBe('ip_registry')
    expect(getRequiredEntitlement('/pccm-intro-course', params())).toBe('pccm_intro_course')
    expect(getRequiredEntitlement('/es/pccm-intro-course', params())).toBe('pccm_intro_course')
    expect(getRequiredEntitlement('/socrates-builder', params())).toBe('socrates_editor')
    expect(getRequiredEntitlement('/es/socrates-builder', params())).toBe('socrates_editor')
    expect(getRequiredEntitlement('/socrates-builder/slides/new', params())).toBe('socrates_editor')
    expect(
      getRequiredEntitlement('/pccm-intro-course/assessments/bronchoscopy_pre', params()),
    ).toBe('pccm_intro_course')
    expect(getRequiredEntitlement('/socal-ebus-course', params())).toBe('socal_ebus_course')
    expect(getRequiredEntitlement('/ebus-training', params())).toBeNull()
    expect(getRequiredEntitlement('/es/ebus-training', params())).toBeNull()
    expect(getRequiredEntitlement('/tnm-9-staging', params())).toBeNull()
  })

  it('tracks the protected SOCRATES builder separately from the public demo', () => {
    expect(isPublicPath('/socrates-builder')).toBe(false)
    expect(isPublicUnlistedPath('/socrates-builder')).toBe(false)
    expect(resolveSiteModuleId('/socrates-builder')).toBe('socrates-builder')
    expect(resolveSiteModuleId('/zh-CN/socrates-builder')).toBe('socrates-builder')
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
    expect(isPccmIntroCourseAdminDashboardPath('/admin/pccm-intro-course/ucsd')).toBe(true)
    expect(isPccmIntroCourseAdminDashboardPath('/admin/pccm-intro-course/loma-linda')).toBe(true)
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

  it('allows signed-in learners to open the released thermal and peripheral ablation modules', () => {
    expect(getRequiredEntitlement('/thermal-ablation', params())).toBeNull()
    expect(getRequiredEntitlement('/zh-CN/thermal-ablation', params())).toBeNull()
    expect(getRequiredEntitlement('/thermal-ablation/index.html', params())).toBeNull()
    expect(getRequiredEntitlement('/peripheral-ablation', params())).toBeNull()
    expect(getRequiredEntitlement('/es/peripheral-ablation/index.html', params())).toBeNull()
    expect(isPublicPath('/thermal-ablation')).toBe(false)
    expect(isPublicPath('/thermal-ablation/index.html')).toBe(false)
    expect(isPublicPath('/thermal-ablation/any-asset.js')).toBe(true)
    expect(isPublicPath('/peripheral-ablation/any-asset.js')).toBe(true)
    expect(resolveSiteModuleId('/thermal-ablation')).toBe('thermal-ablation')
    expect(resolveSiteModuleId('/peripheral-ablation')).toBe('peripheral-ablation')
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

  it('tracks tracheostomy section routes as one site module family', () => {
    expect(resolveSiteModuleId('/tracheostomy')).toBe('tracheostomy')
    expect(resolveSiteModuleId('/es/tracheostomy/practice')).toBe('tracheostomy:practice')
  })

  it('tracks localized rigid bronchoscopy section routes as one site module family', () => {
    expect(resolveSiteModuleId('/rigid-bronchoscopy')).toBe('rigid-bronchoscopy')
    expect(resolveSiteModuleId('/en/rigid-bronchoscopy/learn')).toBe('rigid-bronchoscopy:learn')
    expect(resolveSiteModuleId('/es/rigid-bronchoscopy/practice')).toBe(
      'rigid-bronchoscopy:practice',
    )
    expect(resolveSiteModuleId('/zh-CN/rigid-bronchoscopy/assessment')).toBe(
      'rigid-bronchoscopy:assessment',
    )
  })

  it('tracks the therapeutic bronchoscopy hub without replacing child module identities', () => {
    expect(resolveSiteModuleId('/therapeutic-bronchoscopy')).toBe('therapeutic-bronchoscopy')
    expect(resolveSiteModuleId('/es/therapeutic-bronchoscopy')).toBe('therapeutic-bronchoscopy')
    expect(resolveSiteModuleId('/rigid-bronchoscopy')).toBe('rigid-bronchoscopy')
    expect(resolveSiteModuleId('/thermal-ablation')).toBe('thermal-ablation')
  })

  it('excludes the explorer from generic session progress without adding a course entitlement', () => {
    expect(resolveSiteModuleId('/airway-stent-mechanics')).toBeNull()
    expect(resolveSiteModuleId('/es/airway-stent-mechanics')).toBeNull()
    expect(getRequiredEntitlement('/airway-stent-mechanics', params())).toBeNull()
    expect(isPublicPath('/airway-stent-mechanics')).toBe(false)
  })

  it('keeps legacy and unreviewed airway stent model derivatives behind the site-admin gate', () => {
    const modelPath = '/airway-stent-mechanics/models/v1/aero-laser-cut-covered.glb'

    expect(isAdminOnlyAirwayStentMechanicsAssetPath(modelPath)).toBe(true)
    expect(isAdminOnlyAirwayStentMechanicsAssetPath(`/es${modelPath}`)).toBe(true)
    expect(
      isAdminOnlyAirwayStentMechanicsAssetPath('/airway-stent-mechanics/models/v3/unreviewed.glb'),
    ).toBe(true)
    expect(isAdminOnlyAirwayStentMechanicsAssetPath('/airway-stent-mechanics')).toBe(false)
    expect(getRequiredEntitlement(modelPath, params())).toBe('site_admin')
    expect(isPublicPath(modelPath)).toBe(false)
  })

  it('allows signed-in learners to request rights-cleared v2 airway stent assets', () => {
    const modelPath = '/airway-stent-mechanics/models/v2/generic-silicone-tube.abc123.glb'
    const manifestPath = '/airway-stent-mechanics/models/v2/model-manifest.json'

    expect(isAuthenticatedAirwayStentMechanicsAssetPath(modelPath)).toBe(true)
    expect(isAuthenticatedAirwayStentMechanicsAssetPath(`/zh-CN${modelPath}`)).toBe(true)
    expect(isAuthenticatedAirwayStentMechanicsAssetPath(manifestPath)).toBe(true)
    expect(isAdminOnlyAirwayStentMechanicsAssetPath(modelPath)).toBe(false)
    expect(getRequiredEntitlement(modelPath, params())).toBeNull()
    expect(getRequiredEntitlement(manifestPath, params())).toBeNull()
    expect(isPublicPath(modelPath)).toBe(false)
    expect(isPublicPath(manifestPath)).toBe(false)
  })

  it('normalizes unsafe login redirects', () => {
    expect(resolveLoginRedirectPath('/resources', '?topic=rose')).toBe('/resources?topic=rose')
    expect(resolveLoginRedirectPath('//evil.example', '')).toBe('/')
  })
})

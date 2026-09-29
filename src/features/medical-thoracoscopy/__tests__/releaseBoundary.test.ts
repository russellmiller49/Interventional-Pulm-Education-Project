/** @jest-environment node */
import { isDraftModulePath, isUnlistedModulePath } from '@/lib/draft-modules'
import { nonPublicModules } from '@/lib/non-public-modules'
import { isPublicPath, isPublicUnlistedPath, resolveSiteModuleId } from '@/lib/site-auth/access'

import {
  MEDICAL_THORACOSCOPY_MODULE_ID,
  MEDICAL_THORACOSCOPY_RELEASE_STAGE,
} from '../content/release'
import {
  MEDICAL_THORACOSCOPY_CASES_HREF,
  MEDICAL_THORACOSCOPY_LEARN_HREF,
  MEDICAL_THORACOSCOPY_NAV_BASE,
  MEDICAL_THORACOSCOPY_PRACTICE_HREF,
  MEDICAL_THORACOSCOPY_REFERENCE_HREF,
} from '../content/routes'

/**
 * Where the module stands with the rest of the site while it is built: reachable by direct link,
 * never indexed, absent from navigation, listed for admins. The earlier pleuroscopy module is
 * untouched.
 */
const routes = [
  MEDICAL_THORACOSCOPY_NAV_BASE,
  MEDICAL_THORACOSCOPY_LEARN_HREF,
  MEDICAL_THORACOSCOPY_PRACTICE_HREF,
  MEDICAL_THORACOSCOPY_CASES_HREF,
  MEDICAL_THORACOSCOPY_REFERENCE_HREF,
]

describe('medical thoracoscopy release boundary', () => {
  it('is an unlisted preview', () => {
    expect(MEDICAL_THORACOSCOPY_RELEASE_STAGE).toBe('unlisted-preview')
  })

  it.each(routes.flatMap((route) => [route, `/es${route}`, `/zh-CN${route}`]))(
    '%s opens by direct link and is kept out of navigation',
    (route) => {
      expect(isPublicUnlistedPath(route)).toBe(true)
      expect(isUnlistedModulePath(route)).toBe(true)
      expect(isDraftModulePath(route)).toBe(false)
      expect(resolveSiteModuleId(route)).toBe(MEDICAL_THORACOSCOPY_MODULE_ID)
    },
  )

  it('is listed for admins once, under its own path', () => {
    const listed = nonPublicModules.filter((entry) => entry.path === MEDICAL_THORACOSCOPY_NAV_BASE)

    expect(listed).toHaveLength(1)
    expect(listed[0].title).toBe('Medical Thoracoscopy')
  })

  it('leaves the earlier pleuroscopy module where it was', () => {
    const legacy = '/pleural-procedures/pleuroscopy'

    expect(isPublicPath(legacy)).toBe(false)
    expect(isPublicUnlistedPath(legacy)).toBe(false)
    expect(resolveSiteModuleId(legacy)).toBe('pleural-procedures:pleuroscopy')
    expect(nonPublicModules.some((entry) => entry.path === legacy)).toBe(true)
  })

  it('serves its models as static files, whatever the page gate says', () => {
    // A model under /models is fetched without the page gate. That is why the rights register
    // blocks their upload until the owner decides, rather than relying on the gate.
    expect(isPublicPath('/models/medical-thoracoscopy/v1/devices/manifest.json')).toBe(true)
  })
})

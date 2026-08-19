import { isPublicPath, isPublicUnlistedPath } from '@/lib/site-auth/access'
import { isDraftModulePath, isUnlistedModulePath } from '@/lib/draft-modules'

/**
 * The modules that are not part of the public site yet, gathered for the admin index.
 *
 * This file records **what each module is**, not how it is gated. Access mode is derived
 * from the same predicates the proxy uses, so the admin page always shows what the gate
 * actually does — change the gate and this list follows, with no second place to update and
 * no chance of the page claiming an access level the site does not enforce.
 */

export type ModuleAccessMode =
  /** No account needed — share the link with a beta tester. Not indexed by search engines. */
  | 'direct-link'
  /** No account needed and search-indexable. Only expected for sign-in and utility pages. */
  | 'public'
  /** Requires a site account. */
  | 'sign-in'

export interface NonPublicModule {
  path: string
  title: string
  group: string
  summary: string
}

export const nonPublicModuleGroups = [
  'IP tooling',
  'Pleural',
  'Bronchoscopy',
  'Critical care',
] as const

export const nonPublicModules: NonPublicModule[] = [
  {
    path: '/preference-cards',
    title: 'IP Preference Card Builder',
    group: 'IP tooling',
    summary:
      'Build a per-procedure equipment card from a 1,400-product catalog, then print it spatially or chronologically. Browsing and building work without an account; saving a card needs one.',
  },
  {
    path: '/devices',
    title: 'Device Atlas — Device Intelligence beta',
    group: 'IP tooling',
    summary:
      'Read-only device atlas over the inclusion-first verified-source cohort, browsed by a normalized device taxonomy (device class and subtype) with market-status and safety overlays. Public-unlisted and noindex.',
  },
  {
    // A representative role page: the area has no index route (only
    // /clinical-roles/[roleCode] exists), and the admin index links entry paths directly.
    path: '/clinical-roles/EBUS_SCOPE',
    title: 'Clinical Roles — Device Intelligence beta',
    group: 'IP tooling',
    summary:
      'Read-only clinical-role pages: authored selection guidance, atlas-cohort products by manufacturer, and the procedures that request each role. Linked here via a representative role; the area is addressed per role code.',
  },
  {
    path: '/procedures',
    title: 'Procedure Workspaces — Device Intelligence beta',
    group: 'IP tooling',
    summary:
      'Read-only procedure workspaces for the three exemplar procedures, with a demo-data-only readiness view. Draft-watermarked; no writes.',
  },
  {
    path: '/literature',
    title: 'IP Literature Explorer',
    group: 'IP tooling',
    summary: 'Search and triage the interventional pulmonology literature set.',
  },
  {
    path: '/rapid-onsite-cytology',
    title: 'Rapid On-Site Cytology',
    group: 'IP tooling',
    summary: 'ROSE slide review and annotation practice.',
  },
  {
    path: '/socrates-demo',
    title: 'SOCRATES Demo',
    group: 'IP tooling',
    summary: 'Annotated whole-slide viewer demonstration.',
  },
  {
    path: '/pleural-procedures/pleural-ultrasound-simulator',
    title: 'Pleural Ultrasound Simulator',
    group: 'Pleural',
    summary:
      'Interactive thoracic ultrasound simulator with scan-plane rendering and structure identification.',
  },
  {
    path: '/pleural-procedures/pleuroscopy',
    title: 'Pleuroscopy (Medical Thoracoscopy)',
    group: 'Pleural',
    summary: 'Learn / practice / assess module for medical thoracoscopy.',
  },
  {
    path: '/intro-bronchoscopy/airway-anatomy',
    title: 'Airway Anatomy — Synchronized Bronchoscopy',
    group: 'Bronchoscopy',
    summary:
      'Airway anatomy teaching with a synchronized dendrogram, endoscopic survey, quiz, and clickable 3D tree.',
  },
  {
    path: '/critical-care',
    title: 'Critical Care Hub',
    group: 'Critical care',
    summary: 'Entry point for the critical care cases, concepts, labs, and pathways.',
  },
  {
    path: '/cardiohelp-ecmo',
    title: 'Cardiohelp ECMO',
    group: 'Critical care',
    summary: 'ECMO circuit teaching with a bedside 3D circuit and clamp/air-embolism scenarios.',
  },
  {
    path: '/baxter-crrt',
    title: 'Baxter CRRT',
    group: 'Critical care',
    summary: 'Continuous renal replacement therapy console teaching.',
  },
  {
    path: '/icu-hemodynamics',
    title: 'ICU Hemodynamics',
    group: 'Critical care',
    summary: 'Hemodynamic waveform teaching atlas and live simulator.',
  },
  {
    path: '/mechanical-ventilation',
    title: 'Mechanical Ventilation',
    group: 'Critical care',
    summary: 'Ventilator console simulation with per-device display and control profiles.',
  },
  {
    path: '/mechanical-circulatory-support',
    title: 'Mechanical Circulatory Support',
    group: 'Critical care',
    summary: 'Mechanical circulatory support teaching module.',
  },
  {
    path: '/icu-simulation',
    title: 'ICU Simulation',
    group: 'Critical care',
    summary: 'Staged ICU case simulation.',
  },
]

/** What the site's own access gate does with this path right now. */
export function moduleAccessMode(path: string): ModuleAccessMode {
  if (isPublicUnlistedPath(path)) return 'direct-link'
  if (isPublicPath(path)) return 'public'
  return 'sign-in'
}

/** True when the module is kept out of site navigation. */
export function isHiddenFromNavigation(path: string): boolean {
  return isUnlistedModulePath(path) || isDraftModulePath(path)
}

export interface NonPublicModuleStatus extends NonPublicModule {
  accessMode: ModuleAccessMode
  hiddenFromNavigation: boolean
}

export function getNonPublicModuleStatuses(): NonPublicModuleStatus[] {
  return nonPublicModules.map((entry) => ({
    ...entry,
    accessMode: moduleAccessMode(entry.path),
    hiddenFromNavigation: isHiddenFromNavigation(entry.path),
  }))
}

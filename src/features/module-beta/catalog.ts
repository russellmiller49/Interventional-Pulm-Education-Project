import { unlocalizedPathname } from '@/i18n/path'

export const betaModules = [
  { id: 'ebus-guided', title: 'EBUS: Guided Course', path: '/ebus-guided', group: 'Bronchoscopy' },
  {
    id: 'synchronized-anatomy',
    title: 'Airway Anatomy — Synchronized Bronchoscopy',
    path: '/learn/anatomy/airway',
    group: 'Bronchoscopy',
  },
  {
    id: 'branch-tracing',
    title: 'Bronchial Branch Tracing',
    path: '/learn/anatomy/branch-tracing',
    group: 'Bronchoscopy',
  },
  {
    id: 'live-anatomy',
    title: 'Live Bronchoscopy Anatomy',
    path: '/intro-bronchoscopy/airway-anatomy',
    group: 'Bronchoscopy',
  },
  {
    id: 'peripheral-imaging',
    title: 'Peripheral Bronchoscopy Imaging',
    path: '/peripheral-imaging',
    group: 'Bronchoscopy',
  },
  {
    id: 'bronchoscopy-foundations',
    title: 'Bronchoscopy Foundations',
    path: '/bronchoscopy-foundations',
    group: 'Bronchoscopy',
  },
  {
    id: 'devices',
    title: 'Device Atlas — Device Intelligence beta',
    path: '/devices',
    group: 'Devices',
  },
  {
    id: 'cardiohelp-ecmo',
    title: 'Cardiohelp ECMO',
    path: '/cardiohelp-ecmo',
    group: 'Critical care',
  },
  { id: 'baxter-crrt', title: 'Baxter CRRT', path: '/baxter-crrt', group: 'Critical care' },
  {
    id: 'icu-hemodynamics',
    title: 'ICU Hemodynamics',
    path: '/icu-hemodynamics',
    group: 'Critical care',
  },
  {
    id: 'mechanical-ventilation',
    title: 'Mechanical Ventilation',
    path: '/mechanical-ventilation',
    group: 'Critical care',
  },
  {
    id: 'mechanical-circulatory-support',
    title: 'Mechanical Circulatory Support',
    path: '/mechanical-circulatory-support',
    group: 'Critical care',
  },
] as const

// Retired beta modules remain available only when reviewing historical feedback.
export const retiredBetaModules = [
  {
    id: 'therapeutic-bronchoscopy',
    title: 'Therapeutic Bronchoscopy Simulator (in development)',
    path: '/admin/therapeutic-bronchoscopy',
    group: 'Bronchoscopy',
  },
] as const
export const feedbackReviewModules = [...betaModules, ...retiredBetaModules]
export function feedbackReviewModuleById(id: string) {
  return feedbackReviewModules.find((entry) => entry.id === id)
}
export function feedbackReviewModuleForPath(path: string) {
  const pathname = unlocalizedPathname(path)
  return (
    betaModuleForPath(path) ??
    retiredBetaModules.find(
      (entry) => pathname === entry.path || pathname.startsWith(`${entry.path}/`),
    )
  )
}

export type BetaModule = (typeof betaModules)[number]
export function betaModuleById(id: string) {
  return betaModules.find((entry) => entry.id === id)
}

export function betaModuleForPath(path: string) {
  const pathname = unlocalizedPathname(path)
  const match = betaModules.find(
    (entry) => pathname === entry.path || pathname.startsWith(`${entry.path}/`),
  )
  if (match) return match
  if (pathname.startsWith('/branch-tracing/')) return betaModuleById('branch-tracing')
  if (
    pathname.startsWith('/clinical-roles/') ||
    pathname === '/procedures' ||
    pathname.startsWith('/procedures/')
  )
    return betaModuleById('devices')
  return undefined
}

// Keep lesson and simulator state without persisting arbitrary URL values such as auth tokens.
export function feedbackPagePath(url: URL) {
  const safe = new URL(url.pathname, 'https://module.invalid')
  for (const key of [
    'lesson',
    'section',
    'unit',
    'step',
    'tab',
    'mode',
    'case',
    'station',
    'view',
    'device',
    // Audited lesson/stage and simulator selectors; see docs/module-beta-owner-review.md.
    'phase',
    'activity',
    'track',
    'entry',
    'focus',
    'seed',
    'start',
    'nextLearn',
    'scopeProfile',
    'output',
  ]) {
    const value = url.searchParams.get(key)
    if (value && /^[\w.-]{1,100}$/.test(value)) safe.searchParams.set(key, value)
  }
  if (/^#[\w./-]{1,150}$/.test(url.hash)) safe.hash = url.hash
  return `${safe.pathname}${safe.search}${safe.hash}`
}

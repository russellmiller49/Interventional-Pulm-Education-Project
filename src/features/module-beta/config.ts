import { unlocalizedPathname } from '@/i18n/path'
import { betaModuleById } from './catalog'

export type FeedbackMode = 'owner-local' | 'server'

// Deployed feedback must reach the reviewer. Browser-only storage is a local development aid.
// NEXT_PUBLIC values are fixed at build time. Missing/unknown settings keep server behavior.
export function feedbackMode(): FeedbackMode {
  if (process.env.NODE_ENV === 'production') return 'server'
  return process.env.NEXT_PUBLIC_MODULE_FEEDBACK_MODE === 'owner-local' ? 'owner-local' : 'server'
}

// Only browser-local UI shells can skip account access. Never use this for API authorization.
export function isOwnerLocalFeedbackPage(path: string) {
  if (feedbackMode() !== 'owner-local') return false
  const pathname = unlocalizedPathname(path)
  if (pathname === '/development-beta' || pathname === '/admin/module-feedback') return true
  const match = /^\/development-beta\/([^/]+)$/.exec(pathname)
  return Boolean(match && betaModuleById(match[1]))
}

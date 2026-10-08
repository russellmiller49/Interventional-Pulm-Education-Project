import { z } from 'zod'
import { betaModuleForPath, feedbackReviewModuleForPath, feedbackPagePath } from './catalog'

export const feedbackStatuses = ['new', 'in-review', 'resolved'] as const
export const maxScreenshotBytes = 3 * 1024 * 1024
export const feedbackPagePathSchema = z
  .string()
  .max(2000)
  .startsWith('/')
  .refine((path) => !path.startsWith('//') && !path.includes('\\'))
// A report or unsent draft may only name an allowlisted page of the module it belongs to.
export function isFeedbackPageContext(moduleId: string, pagePath: string, includeRetired = false) {
  const url = URL.canParse(pagePath, 'https://module.invalid')
    ? new URL(pagePath, 'https://module.invalid')
    : null
  return Boolean(
    url &&
    (includeRetired ? feedbackReviewModuleForPath(url.pathname) : betaModuleForPath(url.pathname))
      ?.id === moduleId &&
    feedbackPagePath(url) === pagePath,
  )
}
function reportSchema(includeRetired: boolean) {
  return z
    .object({
      id: z.string().uuid(),
      moduleId: z.string(),
      pagePath: feedbackPagePathSchema,
      comment: z.string().trim().min(1, 'Add a comment before sending.').max(10000),
      selectedText: z.string().max(3000).default(''),
    })
    .superRefine((value, context) => {
      if (!isFeedbackPageContext(value.moduleId, value.pagePath, includeRetired)) {
        context.addIssue({
          code: 'custom',
          path: ['pagePath'],
          message: 'Open a module from the beta hub before sending feedback.',
        })
      }
    })
}
export const feedbackSchema = reportSchema(false)
// Reading an old report must never depend on whether its module is still offered in beta.
export const storedFeedbackSchema = reportSchema(true)
export const reviewSchema = z.object({
  status: z.enum(feedbackStatuses),
  reviewerNotes: z.string().trim().max(10000),
})
export type FeedbackEntry = {
  id: string
  module_id: string
  page_path: string
  comment: string
  selected_text: string
  tester_email: string
  created_at: string
  screenshot_path: string | null
  status: (typeof feedbackStatuses)[number]
  reviewer_notes: string
}

export function isPngScreenshot(bytes: Uint8Array) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (
    bytes.length < 33 ||
    bytes.length > maxScreenshotBytes ||
    !signature.every((value, i) => bytes[i] === value)
  )
    return false
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const width = view.getUint32(16),
    height = view.getUint32(20)
  return (
    String.fromCharCode(...bytes.slice(12, 16)) === 'IHDR' &&
    width > 0 &&
    height > 0 &&
    width <= 4096 &&
    height <= 4096
  )
}

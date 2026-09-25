/** @jest-environment node */
import { feedbackMode, isOwnerLocalFeedbackPage } from './config'
const original = process.env.NEXT_PUBLIC_MODULE_FEEDBACK_MODE
afterEach(() => {
  jest.restoreAllMocks()
  if (original === undefined) delete process.env.NEXT_PUBLIC_MODULE_FEEDBACK_MODE
  else process.env.NEXT_PUBLIC_MODULE_FEEDBACK_MODE = original
})
it('always saves deployed feedback to the server, even with a stale owner-local setting', () => {
  jest.replaceProperty(process, 'env', {
    ...process.env,
    NODE_ENV: 'production',
    NEXT_PUBLIC_MODULE_FEEDBACK_MODE: 'owner-local',
  })
  expect(feedbackMode()).toBe('server')
  expect(isOwnerLocalFeedbackPage('/en/development-beta')).toBe(false)
  expect(isOwnerLocalFeedbackPage('/en/admin/module-feedback')).toBe(false)
})
it.each([undefined, '', 'server', 'typo'])('defaults conservatively for %s', (value) => {
  if (value === undefined) delete process.env.NEXT_PUBLIC_MODULE_FEEDBACK_MODE
  else process.env.NEXT_PUBLIC_MODULE_FEEDBACK_MODE = value
  expect(feedbackMode()).toBe('server')
  expect(isOwnerLocalFeedbackPage('/en/admin/module-feedback')).toBe(false)
})
it('allows only local UI shells, never feedback APIs or other admin resources', () => {
  process.env.NEXT_PUBLIC_MODULE_FEEDBACK_MODE = 'owner-local'
  for (const path of [
    '/en/development-beta',
    '/en/development-beta/peripheral-imaging',
    '/es/admin/module-feedback',
  ])
    expect(isOwnerLocalFeedbackPage(path)).toBe(true)
  for (const path of [
    '/api/module-feedback',
    '/api/module-feedback/123/image',
    '/admin',
    '/admin/module-feedback/data',
    '/admin/modules',
    '/development-beta/unknown',
    '/development-beta/devices/extra',
  ])
    expect(isOwnerLocalFeedbackPage(path)).toBe(false)
})

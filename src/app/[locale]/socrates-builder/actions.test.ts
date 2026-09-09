const mockEditorSession = jest.fn()

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/features/socrates-builder/server/access', () => ({
  getSocratesEditorSession: (...args: unknown[]) => mockEditorSession(...args),
}))

import { createInvenioDemoDocument } from '@/features/socrates-builder/content/invenio-demo-document'
import { createStarterSocratesDocument } from '@/features/socrates-builder/content/starter-document'
import { saveSocratesSlideDocument } from './actions'

it('prevents loss of overlay explanations in the legacy protected save function', async () => {
  const legacy = createStarterSocratesDocument()
  legacy.annotations[0].explanation = 'Additional teaching detail.'
  for (const document of [legacy, createInvenioDemoDocument()]) {
    await expect(saveSocratesSlideDocument(document)).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('browser storage'),
    })
  }
  expect(mockEditorSession).not.toHaveBeenCalled()
})

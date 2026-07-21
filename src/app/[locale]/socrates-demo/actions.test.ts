const mockRpc = jest.fn()
const mockRevalidatePath = jest.fn()

jest.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

jest.mock('@/lib/supabase/server', () => ({
  supabaseServer: async () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }),
}))

import { createStarterSocratesDocument } from '@/features/socrates-builder/content/starter-document'

import { deleteSocratesSandboxDocument, saveSocratesSandboxDocument } from './actions'

const editKey = 'a'.repeat(64)

describe('SOCRATES anonymous sandbox actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('validates and saves an isolated draft through the sandbox RPC', async () => {
    const document = createStarterSocratesDocument()
    const saved = {
      ...document,
      recordId: '79aad03f-15e0-4f5f-93e3-7229ff4c96d2',
      revision: 1,
      publishedAt: null,
    }
    mockRpc.mockResolvedValue({ data: saved, error: null })

    await expect(saveSocratesSandboxDocument(document, editKey)).resolves.toEqual({
      ok: true,
      document: saved,
    })
    expect(mockRpc).toHaveBeenCalledWith(
      'save_socrates_sandbox_document',
      expect.objectContaining({
        edit_token: editKey,
        target_document_id: null,
        payload: expect.objectContaining({ workflowStatus: 'draft', publishedAt: null }),
      }),
    )
    expect(mockRevalidatePath).toHaveBeenCalledWith('/[locale]/socrates-demo', 'page')
  })

  it('rejects a save before the database when the edit key is not secure', async () => {
    const result = await saveSocratesSandboxDocument(createStarterSocratesDocument(), 'short')

    expect(result).toEqual({ ok: false, error: 'A secure browser edit key could not be created.' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('deletes only through the edit-key RPC', async () => {
    const recordId = '79aad03f-15e0-4f5f-93e3-7229ff4c96d2'
    mockRpc.mockResolvedValue({ data: true, error: null })

    await expect(deleteSocratesSandboxDocument(recordId, editKey)).resolves.toEqual({
      ok: true,
      recordId,
    })
    expect(mockRpc).toHaveBeenCalledWith('delete_socrates_sandbox_document', {
      target_document_id: recordId,
      edit_token: editKey,
    })
  })
})

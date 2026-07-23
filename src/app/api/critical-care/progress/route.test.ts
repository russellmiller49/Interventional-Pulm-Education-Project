/**
 * @jest-environment node
 */

import { supabaseServer } from '@/lib/supabase/server'

import { GET, POST } from './route'

jest.mock('@/lib/supabase/server', () => ({
  supabaseServer: jest.fn(),
}))

const supabaseServerMock = supabaseServer as jest.Mock

describe('critical-care coarse progress API', () => {
  beforeEach(() => supabaseServerMock.mockReset())

  it('rejects unknown, detailed, free-text, and high-frequency fields before authentication', async () => {
    for (const prohibited of [
      { note: 'real patient note' },
      { resume: { checkpointId: 'local-only' } },
      { waveforms: [1, 2, 3] },
      { commands: ['set-peep'] },
      { score: 92 },
      { attempts: 3 },
    ]) {
      const response = await POST(
        progressRequest({
          schemaVersion: 1,
          modules: [
            {
              moduleId: 'icu-hemodynamics',
              percentComplete: 50,
              completedSections: ['learn'],
              completed: false,
              ...prohibited,
            },
          ],
        }),
      )
      expect(response.status).toBe(400)
    }
    expect(supabaseServerMock).not.toHaveBeenCalled()
  })

  it('requires authentication and never creates an anonymous progress row', async () => {
    const database = progressDatabase({ user: null })
    supabaseServerMock.mockResolvedValue(database.client)

    const response = await POST(progressRequest(validBatch()))

    expect(response.status).toBe(401)
    expect(database.from).not.toHaveBeenCalled()
  })

  it('rejects a request prepared for a different signed-in account', async () => {
    const database = progressDatabase()
    supabaseServerMock.mockResolvedValue(database.client)

    const response = await POST(progressRequest(validBatch(), 'user-2'))

    expect(response.status).toBe(409)
    expect(database.from).not.toHaveBeenCalled()
  })

  it('monotonically merges existing coarse fields with an updated_at compare-and-swap', async () => {
    const database = progressDatabase({
      moduleReads: [storedProgress()],
      updateResults: [{ data: [{ module_id: 'icu-hemodynamics' }], error: null }],
    })
    supabaseServerMock.mockResolvedValue(database.client)

    const response = await POST(progressRequest(validBatch()))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'ok', synced: 1 })
    expect(database.update).toHaveBeenCalledWith(
      expect.objectContaining({
        completed_at: null,
        completed_sections: ['learn', 'practice'],
        percent_complete: 67,
        total_time_seconds: 321,
      }),
    )
    expect(database.updateEq).toHaveBeenCalledWith('updated_at', '2026-07-20T00:00:00.000Z')
    const serializedWrite = JSON.stringify(database.update.mock.calls[0])
    for (const prohibited of ['score', 'attempt', 'resume', 'waveform', 'command', 'patient']) {
      expect(serializedWrite.toLowerCase()).not.toContain(prohibited)
    }
  })

  it('does not regress a newer server percentage or rewrite an unchanged row', async () => {
    const database = progressDatabase({
      moduleReads: [
        storedProgress({
          completed_sections: ['learn', 'practice'],
          percent_complete: 80,
        }),
      ],
    })
    supabaseServerMock.mockResolvedValue(database.client)

    const response = await POST(progressRequest(validBatch()))

    await expect(response.json()).resolves.toEqual({ status: 'ok', synced: 0 })
    expect(database.update).not.toHaveBeenCalled()
    expect(database.upsert).not.toHaveBeenCalled()
  })

  it('re-reads and re-merges after a concurrent update collision without regressing progress', async () => {
    const database = progressDatabase({
      moduleReads: [
        storedProgress(),
        storedProgress({
          completed_sections: ['learn'],
          percent_complete: 85,
          updated_at: '2026-07-22T01:00:00.000Z',
        }),
      ],
      updateResults: [
        { data: [], error: null },
        { data: [{ module_id: 'icu-hemodynamics' }], error: null },
      ],
    })
    supabaseServerMock.mockResolvedValue(database.client)

    const response = await POST(progressRequest(validBatch()))

    await expect(response.json()).resolves.toEqual({ status: 'ok', synced: 1 })
    expect(database.update).toHaveBeenCalledTimes(2)
    expect(database.update.mock.calls[0][0]).toEqual(
      expect.objectContaining({ percent_complete: 67, completed_sections: ['learn', 'practice'] }),
    )
    expect(database.update.mock.calls[1][0]).toEqual(
      expect.objectContaining({ percent_complete: 85, completed_sections: ['learn', 'practice'] }),
    )
    expect(database.updateEq).toHaveBeenLastCalledWith('updated_at', '2026-07-22T01:00:00.000Z')
  })

  it('uses a conflict-safe insert and merges the row that won an insert race', async () => {
    const database = progressDatabase({
      moduleReads: [
        null,
        storedProgress({
          completed_sections: ['learn'],
          percent_complete: 82,
          updated_at: '2026-07-22T02:00:00.000Z',
        }),
      ],
      upsertResults: [{ data: [], error: null }],
      updateResults: [{ data: [{ module_id: 'icu-hemodynamics' }], error: null }],
    })
    supabaseServerMock.mockResolvedValue(database.client)

    const response = await POST(progressRequest(validBatch()))

    await expect(response.json()).resolves.toEqual({ status: 'ok', synced: 1 })
    expect(database.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ percent_complete: 67, completed_sections: ['practice'] })],
      {
        onConflict: 'user_id,module_id',
        ignoreDuplicates: true,
      },
    )
    expect(database.update).toHaveBeenCalledWith(
      expect.objectContaining({ percent_complete: 82, completed_sections: ['learn', 'practice'] }),
    )
  })

  it('returns only bounded coarse account data for authenticated reads', async () => {
    const database = progressDatabase({
      getRows: [
        {
          module_id: 'icu-hemodynamics',
          completed_at: null,
          completed_sections: ['learn', 'unreviewed-free-text'],
          last_visited_at: '2026-07-22T12:00:00.000Z',
          percent_complete: 50,
        },
      ],
    })
    supabaseServerMock.mockResolvedValue(database.client)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      schemaVersion: 1,
      accountId: 'user-1',
      modules: [
        {
          moduleId: 'icu-hemodynamics',
          percentComplete: 50,
          completedSections: ['learn'],
          completedAt: null,
          lastVisitedAt: '2026-07-22T12:00:00.000Z',
        },
      ],
    })
  })
})

function validBatch() {
  return {
    schemaVersion: 1,
    modules: [
      {
        moduleId: 'icu-hemodynamics',
        percentComplete: 67,
        completedSections: ['practice'],
        completed: false,
      },
    ],
  }
}

function progressRequest(body: unknown, accountId = 'user-1') {
  return new Request('http://localhost/api/critical-care/progress', {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'x-critical-care-sync-account': accountId,
    },
    method: 'POST',
  })
}

function storedProgress(overrides: Record<string, unknown> = {}) {
  return {
    module_id: 'icu-hemodynamics',
    first_started_at: '2026-07-01T00:00:00.000Z',
    completed_at: null,
    completed_sections: ['learn'],
    percent_complete: 50,
    total_time_seconds: 321,
    updated_at: '2026-07-20T00:00:00.000Z',
    ...overrides,
  }
}

type QueryResult = { data: unknown; error: { code?: string } | null }

function progressDatabase({
  user = { id: 'user-1' } as { id: string } | null,
  moduleReads = [],
  getRows = [],
  updateResults = [],
  upsertResults = [],
}: {
  user?: { id: string } | null
  moduleReads?: readonly (Record<string, unknown> | null)[]
  getRows?: readonly Record<string, unknown>[]
  updateResults?: readonly QueryResult[]
  upsertResults?: readonly QueryResult[]
} = {}) {
  const readQueue = [...moduleReads]
  const updateQueue = [...updateResults]
  const upsertQueue = [...upsertResults]

  const readBuilder = {
    eq: jest.fn(),
    in: jest.fn().mockResolvedValue({ data: getRows, error: null }),
    maybeSingle: jest.fn().mockImplementation(async () => ({
      data: readQueue.shift() ?? null,
      error: null,
    })),
  }
  readBuilder.eq.mockReturnValue(readBuilder)

  const updateEq = jest.fn()
  const updateBuilder = {
    eq: updateEq,
    select: jest.fn().mockImplementation(
      async () =>
        updateQueue.shift() ?? {
          data: [{ module_id: 'icu-hemodynamics' }],
          error: null,
        },
    ),
  }
  updateEq.mockReturnValue(updateBuilder)

  const upsertBuilder = {
    select: jest.fn().mockImplementation(
      async () =>
        upsertQueue.shift() ?? {
          data: [{ module_id: 'icu-hemodynamics' }],
          error: null,
        },
    ),
  }

  const select = jest.fn().mockReturnValue(readBuilder)
  const update = jest.fn().mockReturnValue(updateBuilder)
  const upsert = jest.fn().mockReturnValue(upsertBuilder)
  const from = jest.fn().mockReturnValue({ select, update, upsert })

  return {
    client: {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from,
    },
    from,
    update,
    updateEq,
    upsert,
  }
}

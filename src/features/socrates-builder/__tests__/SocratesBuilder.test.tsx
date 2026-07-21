import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import type { DeepZoomViewerHandle } from '@/features/socrates-demo/types'

const mockSave = jest.fn()
const mockPublish = jest.fn()
const mockSaveSandbox = jest.fn()
const mockDeleteSandbox = jest.fn()
const mockDeleteSandboxAsAdmin = jest.fn()
const mockLoadDescriptor = jest.fn()

jest.mock('@/app/[locale]/socrates-builder/actions', () => ({
  saveSocratesSlideDocument: (...args: unknown[]) => mockSave(...args),
  publishSocratesSlideDocument: (...args: unknown[]) => mockPublish(...args),
  deleteSocratesSandboxDocumentAsAdmin: (...args: unknown[]) => mockDeleteSandboxAsAdmin(...args),
}))

jest.mock('@/app/[locale]/socrates-demo/actions', () => ({
  saveSocratesSandboxDocument: (...args: unknown[]) => mockSaveSandbox(...args),
  deleteSocratesSandboxDocument: (...args: unknown[]) => mockDeleteSandbox(...args),
}))

jest.mock('@/features/socrates-demo/components/DeepZoomViewer', () => {
  const MockDeepZoomViewer = React.forwardRef(
    (
      props: {
        annotations: Array<{ id: string; label: string }>
        slide: {
          initialImageRect: { x: number; y: number; width: number; height: number }
        }
        interactionMode: 'navigate' | 'draw-rectangle'
        onDrawRectangle: (rect: { x: number; y: number; width: number; height: number }) => void
        onViewportChange: (snapshot: {
          zoomRatio: number
          visibleImageBounds: { x: number; y: number; width: number; height: number }
        }) => void
        onStatusChange: (status: { phase: 'ready' }) => void
      },
      ref: React.ForwardedRef<DeepZoomViewerHandle>,
    ) => {
      const { onStatusChange } = props

      React.useImperativeHandle(ref, () => ({
        fitImageRect: jest.fn(),
        zoomBy: jest.fn(),
        resetToInitialView: jest.fn(),
        retry: jest.fn(),
      }))

      React.useEffect(() => {
        onStatusChange({ phase: 'ready' })
      }, [onStatusChange])

      return (
        <div data-testid="mock-builder-viewer">
          <output data-testid="builder-overlay-labels">
            {props.annotations.map((annotation) => annotation.label).join(',')}
          </output>
          <output data-testid="builder-interaction-mode">{props.interactionMode}</output>
          <output data-testid="builder-initial-rect">
            {JSON.stringify(props.slide.initialImageRect)}
          </output>
          <button
            type="button"
            onClick={() => props.onDrawRectangle({ x: 1700, y: 1800, width: 200, height: 240 })}
          >
            Mock draw rectangle
          </button>
          <button
            type="button"
            onClick={() =>
              props.onViewportChange({
                zoomRatio: 2.1,
                visibleImageBounds: { x: 400, y: 1900, width: 900, height: 700 },
              })
            }
          >
            Mock viewport
          </button>
        </div>
      )
    },
  )
  MockDeepZoomViewer.displayName = 'MockBuilderDeepZoomViewer'
  return { DeepZoomViewer: MockDeepZoomViewer }
})

jest.mock('../descriptor', () => ({
  ...jest.requireActual('../descriptor'),
  loadInvenioDziDescriptor: (...args: unknown[]) => mockLoadDescriptor(...args),
}))

import { createStarterSocratesDocument } from '../content/starter-document'
import { SocratesBuilder } from '../components/SocratesBuilder'

const localAccess = { canPersist: false, canPublish: false, userEmail: null }

describe('SOCRATES companion builder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    mockLoadDescriptor.mockResolvedValue({
      width: 5400,
      height: 5900,
      tileSize: 510,
      overlap: 1,
      format: 'jpg',
    })
  })

  it('opens a usable starter draft when no database records are available', () => {
    render(<SocratesBuilder access={localAccess} initialDocuments={[]} />)

    expect(screen.getByRole('heading', { name: 'SOCRATES slide builder' })).toBeVisible()
    expect(screen.getByText('Local preview')).toBeVisible()
    expect(screen.getByLabelText('Invenio DZI URL')).toHaveValue(
      'https://www.invenio-cloud.com/api/thinslides/PATH_IP31-AC0501-2_7.dzi',
    )
    expect(screen.getByTestId('builder-overlay-labels')).toHaveTextContent('Zone 1')
    expect(screen.getByText('5')).toBeVisible()
  })

  it('draws a source-pixel parent region and supports delete/undo', async () => {
    const user = userEvent.setup()
    render(<SocratesBuilder access={localAccess} initialDocuments={[]} />)

    await user.click(screen.getByRole('button', { name: 'Draw parent region' }))
    expect(screen.getByTestId('builder-interaction-mode')).toHaveTextContent('draw-rectangle')
    await user.click(screen.getByRole('button', { name: 'Mock draw rectangle' }))

    expect(screen.getByRole('heading', { name: 'Zone 6' })).toBeVisible()
    expect(screen.getByLabelText('X')).toHaveValue(1700)
    expect(screen.getByLabelText('Y')).toHaveValue(1800)
    expect(screen.getByLabelText('WIDTH')).toHaveValue(200)
    expect(screen.getByLabelText('HEIGHT')).toHaveValue(240)

    await user.click(screen.getByRole('button', { name: 'Delete Zone 6' }))
    expect(screen.queryByRole('heading', { name: 'Zone 6' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo annotation change' }))
    expect(screen.getByTestId('builder-overlay-labels')).toHaveTextContent('Zone 6')
  })

  it('keeps detail regions inside their selected parent', async () => {
    const user = userEvent.setup()
    render(<SocratesBuilder access={localAccess} initialDocuments={[]} />)

    await user.click(screen.getByRole('button', { name: 'Draw detail region' }))
    await user.click(screen.getByRole('button', { name: 'Mock draw rectangle' }))

    expect(screen.getByRole('alert')).toHaveTextContent('inside its parent')
    expect(screen.queryByRole('heading', { name: 'Detail 6' })).not.toBeInTheDocument()
  })

  it('starts a newly registered descriptor at its full-image bounds', async () => {
    const user = userEvent.setup()
    mockLoadDescriptor.mockResolvedValue({
      width: 10000,
      height: 8000,
      tileSize: 510,
      overlap: 1,
      format: 'jpg',
    })
    render(<SocratesBuilder access={localAccess} initialDocuments={[]} />)

    await user.click(screen.getByRole('button', { name: 'Add slide' }))
    await user.clear(screen.getByLabelText('Invenio DZI URL'))
    await user.type(
      screen.getByLabelText('Invenio DZI URL'),
      'https://www.invenio-cloud.com/api/thinslides/other-slide.dzi',
    )
    await user.click(screen.getByRole('button', { name: 'Load' }))

    await waitFor(() =>
      expect(screen.getByTestId('builder-initial-rect')).toHaveTextContent(
        '{"x":0,"y":0,"width":10000,"height":8000}',
      ),
    )
  })

  it('captures the current viewport as the published starting crop', async () => {
    const user = userEvent.setup()
    render(<SocratesBuilder access={localAccess} initialDocuments={[]} />)

    await user.click(screen.getByRole('button', { name: 'Mock viewport' }))
    await user.click(screen.getByRole('button', { name: 'Use current view as starting crop' }))

    expect(screen.getByText(/Current viewport saved/)).toBeVisible()
  })

  it('saves a validated database draft and leaves publication to a site admin', async () => {
    const user = userEvent.setup()
    const persisted = {
      ...createStarterSocratesDocument(),
      recordId: 'd4f843a9-e280-4df0-a569-988837703cbe',
      revision: 3,
    }
    mockSave.mockImplementation(async (document) => ({
      ok: true,
      document: { ...document, recordId: persisted.recordId, revision: 4 },
    }))

    render(
      <SocratesBuilder
        access={{ canPersist: true, canPublish: false, userEmail: 'editor@example.com' }}
        initialDocuments={[persisted]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1))
    expect(screen.getByText(/Draft revision 4 saved/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
  })

  it('publishes a saved revision for a site administrator', async () => {
    const user = userEvent.setup()
    const persisted = {
      ...createStarterSocratesDocument(),
      recordId: 'd4f843a9-e280-4df0-a569-988837703cbe',
      revision: 3,
    }
    mockPublish.mockResolvedValue({
      ok: true,
      document: {
        ...persisted,
        workflowStatus: 'published',
        revision: 4,
        publishedAt: '2026-07-20T22:00:00.000Z',
      },
    })

    render(
      <SocratesBuilder
        access={{ canPersist: true, canPublish: true, userEmail: 'admin@example.com' }}
        initialDocuments={[persisted]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith(persisted.recordId))
    expect(screen.getByText(/Published revision 4/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open published slide' })).toHaveAttribute(
      'href',
      '/en/socrates-demo?slide=path-ip31-ac0501-2-7',
    )
  })

  it('saves an anonymous sandbox draft without offering review or publish', async () => {
    const user = userEvent.setup()
    mockSaveSandbox.mockImplementation(async (document) => ({
      ok: true,
      document: {
        ...document,
        recordId: '79aad03f-15e0-4f5f-93e3-7229ff4c96d2',
        workflowStatus: 'draft',
        revision: 1,
      },
    }))

    render(
      <SocratesBuilder
        access={{ canPersist: true, canPublish: false, userEmail: null }}
        initialDocuments={[]}
        mode="sandbox"
      />,
    )

    expect(screen.getByRole('heading', { name: 'Build and annotate a slide' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit review' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save to sandbox' }))

    await waitFor(() => expect(mockSaveSandbox).toHaveBeenCalledTimes(1))
    expect(mockSaveSandbox.mock.calls[0][1]).toMatch(/^[a-f0-9]{64}$/)
    expect(screen.getByText(/Sandbox revision 1 saved/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Delete my draft' })).toBeVisible()

    mockDeleteSandbox.mockResolvedValue({
      ok: true,
      recordId: '79aad03f-15e0-4f5f-93e3-7229ff4c96d2',
    })
    await user.click(screen.getByRole('button', { name: 'Delete my draft' }))
    await waitFor(() => expect(mockDeleteSandbox).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Your sandbox draft was deleted.')).toBeVisible()
  })

  it('lets a site administrator delete public sandbox submissions', async () => {
    const user = userEvent.setup()
    const sandboxDocument = {
      ...createStarterSocratesDocument(),
      recordId: '79aad03f-15e0-4f5f-93e3-7229ff4c96d2',
      revision: 1,
    }
    mockDeleteSandboxAsAdmin.mockResolvedValue({
      ok: true,
      recordId: sandboxDocument.recordId,
    })

    render(
      <SocratesBuilder
        access={{ canPersist: true, canPublish: true, userEmail: 'admin@example.com' }}
        initialDocuments={[]}
        sandboxCleanupDocuments={[sandboxDocument]}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: `Delete sandbox submission ${sandboxDocument.title}`,
      }),
    )

    await waitFor(() =>
      expect(mockDeleteSandboxAsAdmin).toHaveBeenCalledWith(sandboxDocument.recordId),
    )
    expect(screen.getByText('No sandbox submissions to clean up.')).toBeVisible()
  })
})

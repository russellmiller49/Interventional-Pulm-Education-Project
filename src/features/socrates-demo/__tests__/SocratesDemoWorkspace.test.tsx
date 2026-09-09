import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import type { DeepZoomSlide, DemoAnnotation } from '../types'

const mockSave = jest.fn()
const mockSaveSandbox = jest.fn()

jest.mock('@/app/[locale]/socrates-builder/actions', () => ({
  saveSocratesSlideDocument: (...args: unknown[]) => mockSave(...args),
}))
jest.mock('@/app/[locale]/socrates-demo/actions', () => ({
  saveSocratesSandboxDocument: (...args: unknown[]) => mockSaveSandbox(...args),
}))
jest.mock('../components/SocratesDemo', () => ({
  SocratesDemo: ({
    slide,
    annotations,
  }: {
    slide: DeepZoomSlide
    annotations: DemoAnnotation[]
  }) => (
    <div data-testid="demo-view">
      {slide.descriptorUrl} {annotations.map((item) => item.explanation).join(' ')}
    </div>
  ),
}))
jest.mock('../components/ComparisonSlideViewer', () => ({
  ComparisonSlideViewer: React.forwardRef(function MockViewer() {
    return <div>Paired viewer</div>
  }),
}))

import { WEB_OVERLAY_STORAGE_KEY } from '@/features/socrates-builder/web-overlay-storage'

import { SocratesDemoWorkspace } from '../components/SocratesDemoWorkspace'

describe('SOCRATES web overlay workspace', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/en/socrates-demo')
    jest.clearAllMocks()
  })

  it('opens an Invenio pair by default and offers a browser-only builder', async () => {
    const user = userEvent.setup()
    render(<SocratesDemoWorkspace />)
    expect(screen.getByTestId('demo-view')).toHaveTextContent(
      '/nio-006-series-4-barcode-ax00631/original.dzi',
    )
    await user.click(screen.getByRole('button', { name: /Build a slide/ }))
    expect(screen.getByText('Browser storage')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Save to sandbox' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
    expect(window.location.hash).toBe('#builder')
  })

  it('retains explanations across view switches and a fresh page mount without database writes', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/en/socrates-demo#builder')
    const first = render(<SocratesDemoWorkspace />)
    expect(screen.queryByTestId('demo-view')).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Detailed explanation'))
    await user.type(screen.getByLabelText('Detailed explanation'), 'Saved teaching explanation.')
    await user.click(screen.getByRole('button', { name: /View demo/ }))
    expect(screen.getByTestId('demo-view')).toHaveTextContent('Saved teaching explanation.')
    await user.click(screen.getByRole('button', { name: /Build a slide/ }))
    expect(screen.getByLabelText('Detailed explanation')).toHaveValue('Saved teaching explanation.')
    first.unmount()
    render(<SocratesDemoWorkspace />)
    expect(screen.getByLabelText('Detailed explanation')).toHaveValue('Saved teaching explanation.')
    expect(screen.getByLabelText('Thinviewer or Invenio URL')).toHaveValue(
      'https://ucsd-slide-viewer-1080580899927.us-central1.run.app/generated/tiles/nio-006-series-4-barcode-ax00631/original.dzi',
    )
    expect(mockSave).not.toHaveBeenCalled()
    expect(mockSaveSandbox).not.toHaveBeenCalled()
  })

  it('restores the selected draft, even when another draft is first in the catalog', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/en/socrates-demo#builder')
    const first = render(<SocratesDemoWorkspace />)
    await user.click(screen.getByRole('button', { name: 'Add slide' }))
    await user.clear(screen.getByLabelText('Title', { exact: true }))
    await user.type(screen.getByLabelText('Title', { exact: true }), 'Second draft')
    await user.click(screen.getByRole('button', { name: /Case 006.*browser draft/ }))
    const saved = JSON.parse(window.localStorage.getItem(WEB_OVERLAY_STORAGE_KEY)!)
    expect(saved.documents[0].title).toBe('Second draft')
    expect(saved.activeDocument.title).toContain('Case 006')
    first.unmount()
    render(<SocratesDemoWorkspace />)
    expect(screen.getByLabelText('Title', { exact: true })).toHaveValue(
      'Case 006 · Series 4 · AX00631',
    )
    expect(screen.getByRole('button', { name: /Second draft.*browser draft/ })).toBeVisible()
  })

  it('keeps edits in memory and reports a failed auto-save instead of claiming success', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/en/socrates-demo#builder')
    render(<SocratesDemoWorkspace />)
    const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    try {
      await user.type(screen.getByLabelText('Title', { exact: true }), ' edited')
      expect(screen.getByText('Not saved')).toBeVisible()
      expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Export JSON')
      expect(screen.getByLabelText('Title', { exact: true })).toHaveValue(
        'Case 006 · Series 4 · AX00631 edited',
      )
    } finally {
      storage.mockRestore()
    }
  })
})

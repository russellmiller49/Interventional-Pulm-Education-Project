import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExpandableViewer } from '@/features/socrates-demo/components/ExpandableViewer'
afterEach(() => {
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false })
  delete (HTMLElement.prototype as Partial<HTMLElement>).requestFullscreen
})
test('rejected fullscreen becomes usable fallback; Escape restores trigger focus without remounting', async () => {
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true })
  HTMLElement.prototype.requestFullscreen = jest.fn().mockRejectedValue(new Error('Denied'))
  render(
    <ExpandableViewer>
      <button>Canvas control</button>
    </ExpandableViewer>,
  )
  const child = screen.getByText('Canvas control')
  const trigger = screen.getByRole('button', { name: 'Expand viewer' })
  fireEvent.click(trigger)
  await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-fallback', 'true'))
  expect(screen.getByText('Canvas control')).toBe(child)
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(trigger).toHaveFocus()
  expect(screen.getByText('Canvas control')).toBe(child)
})
test('native fullscreen uses the same subtree and restores focus after browser exit', async () => {
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true })
  HTMLElement.prototype.requestFullscreen = jest.fn(function (this: HTMLElement) {
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: this })
    document.dispatchEvent(new Event('fullscreenchange'))
    return Promise.resolve()
  })
  document.exitFullscreen = jest.fn(async () => {
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
    document.dispatchEvent(new Event('fullscreenchange'))
  })
  render(
    <ExpandableViewer>
      <span>Viewer mounted</span>
    </ExpandableViewer>,
  )
  const child = screen.getByText('Viewer mounted')
  fireEvent.click(screen.getByRole('button', { name: 'Expand viewer' }))
  await screen.findByRole('dialog')
  expect(screen.getByRole('dialog')).toHaveAttribute('data-fallback', 'false')
  expect(screen.getByText('Viewer mounted')).toBe(child)
  fireEvent.click(screen.getByRole('button', { name: 'Close expanded viewer' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Expand viewer' })).toHaveFocus())
  expect(document.exitFullscreen).toHaveBeenCalled()
})

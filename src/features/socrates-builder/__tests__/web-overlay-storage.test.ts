import {
  createWebOverlayWorkspace,
  readWebOverlayWorkspace,
  saveWebOverlayWorkspace,
  WEB_OVERLAY_STORAGE_KEY,
} from '../web-overlay-storage'

describe('browser overlay persistence', () => {
  beforeEach(() => window.localStorage.clear())

  it('round-trips the source, crop, teaching coordinates, zoom thresholds, and explanations', () => {
    const workspace = createWebOverlayWorkspace()
    workspace.activeDocument.annotations[1].explanation = 'Line one.\n\nLine two.'
    expect(saveWebOverlayWorkspace(workspace)).toBeNull()
    expect(readWebOverlayWorkspace()).toEqual({ workspace, warning: null })
  })

  it('preserves the last valid draft when an incomplete edit cannot be saved', () => {
    const workspace = createWebOverlayWorkspace()
    saveWebOverlayWorkspace(workspace)
    const previous = window.localStorage.getItem(WEB_OVERLAY_STORAGE_KEY)
    workspace.activeDocument.title = ''
    expect(saveWebOverlayWorkspace(workspace)).toContain('Auto-save paused')
    expect(window.localStorage.getItem(WEB_OVERLAY_STORAGE_KEY)).toBe(previous)
  })

  it('does not erase unreadable stored work while displaying a recovery warning', () => {
    window.localStorage.setItem(WEB_OVERLAY_STORAGE_KEY, 'unfinished backup')
    const recovered = readWebOverlayWorkspace()
    expect(recovered.warning).toContain('could not be restored')
    expect(recovered.workspace.activeDocument.slide.descriptorUrl).toContain('/original.dzi')
    expect(window.localStorage.getItem(WEB_OVERLAY_STORAGE_KEY)).toBe('unfinished backup')
  })
})

type CaptureHandleDevices = MediaDevices & {
  setCaptureHandleConfig?: (config: {
    handle?: string
    exposeOrigin?: boolean
    permittedOrigins?: string[]
  }) => void
}
type CaptureHandleTrack = MediaStreamTrack & {
  getCaptureHandle?: () => { handle: string } | null
}

export class SiteTabCaptureError extends Error {}

export function supportsSiteTabCapture() {
  return Boolean(
    typeof navigator.mediaDevices?.getDisplayMedia === 'function' &&
    (navigator.mediaDevices as CaptureHandleDevices).setCaptureHandleConfig &&
    typeof MediaStreamTrack !== 'undefined' &&
    'getCaptureHandle' in MediaStreamTrack.prototype,
  )
}

// Picker preferences cannot enforce a particular tab. A per-capture handle verifies
// this exact top-level page, including when another site tab is open.
export async function captureSiteTab(signal: AbortSignal): Promise<HTMLCanvasElement> {
  if (!supportsSiteTabCapture())
    throw new SiteTabCaptureError(
      'This browser cannot capture just this site tab. Upload or paste a screenshot instead.',
    )
  const devices = navigator.mediaDevices as CaptureHandleDevices
  const handle = crypto.randomUUID()
  let stream: MediaStream | undefined
  const video = document.createElement('video')
  devices.setCaptureHandleConfig!({
    handle,
    exposeOrigin: false,
    permittedOrigins: [window.location.origin],
  })
  try {
    // Keep this call before any await to preserve the click's user activation.
    const options: DisplayMediaStreamOptions & {
      preferCurrentTab: boolean
      selfBrowserSurface: 'include'
      monitorTypeSurfaces: 'exclude'
      surfaceSwitching: 'exclude'
      systemAudio: 'exclude'
    } = {
      video: { displaySurface: 'browser' },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      monitorTypeSurfaces: 'exclude',
      surfaceSwitching: 'exclude',
      systemAudio: 'exclude',
    }
    stream = await devices.getDisplayMedia(options)
    signal.throwIfAborted()
    const track = stream.getVideoTracks()[0] as CaptureHandleTrack | undefined
    const verify = () => {
      if (
        !track ||
        track.readyState === 'ended' ||
        track.getSettings().displaySurface !== 'browser' ||
        track.getCaptureHandle?.()?.handle !== handle
      )
        throw new SiteTabCaptureError(
          'Choose “This Tab” to capture the module. Other tabs, windows, and screens are not attached.',
        )
    }
    verify()
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer)
        signal.removeEventListener('abort', abort)
        video.removeEventListener('error', failed)
        track!.removeEventListener('ended', failed)
        video.cancelVideoFrameCallback(frameId)
        if (error) reject(error)
        else resolve()
      }
      const abort = () => finish(new DOMException('Capture cancelled', 'AbortError'))
      const failed = () =>
        finish(new SiteTabCaptureError('Capture stopped. Try capturing this tab again.'))
      const timer = setTimeout(
        () =>
          finish(
            new SiteTabCaptureError('The screenshot did not load. Try capturing this tab again.'),
          ),
        10000,
      )
      signal.addEventListener('abort', abort, { once: true })
      video.addEventListener('error', failed, { once: true })
      track!.addEventListener('ended', failed, { once: true })
      const frameId = video.requestVideoFrameCallback(() => finish())
      void video.play().catch(() => failed())
    })
    signal.throwIfAborted()
    verify()
    if (!video.videoWidth || !video.videoHeight)
      throw new SiteTabCaptureError('The screenshot is empty. Try capturing this tab again.')
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 2000 / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    stream?.getTracks().forEach((track) => track.stop())
    video.pause()
    video.srcObject = null
    devices.setCaptureHandleConfig!({})
  }
}

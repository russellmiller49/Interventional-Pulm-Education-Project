/** @jest-environment node */
import type { Camera, Scene, WebGLRenderTarget } from 'three'
import { renderOffscreen } from './offscreen'

function fakeRenderer(current: unknown) {
  const calls: string[] = []
  const renderer = {
    xr: { enabled: true },
    target: current,
    getRenderTarget: () => renderer.target as WebGLRenderTarget | null,
    setRenderTarget: (target: unknown) => {
      renderer.target = target
      calls.push(`target:${String((target as { name?: string } | null)?.name ?? null)}`)
    },
    render: () => {
      calls.push(`render:xr=${renderer.xr.enabled}`)
    },
  }
  return { renderer, calls }
}

const scene = {} as Scene
const camera = {} as Camera
const panel = { name: 'panel' } as unknown as WebGLRenderTarget

describe('renderOffscreen', () => {
  it('hands the headset framebuffer back after drawing the scope panel', () => {
    // Inside an XR frame three has already bound the headset's render target.
    const headset = { name: 'headset' }
    const { renderer, calls } = fakeRenderer(headset)
    renderOffscreen(renderer as never, scene, camera, panel)
    expect(calls).toEqual(['target:panel', 'render:xr=false', 'target:headset'])
    expect(renderer.target).toBe(headset)
    expect(renderer.xr.enabled).toBe(true)
  })

  it('restores the page canvas on the desktop preview', () => {
    const { renderer, calls } = fakeRenderer(null)
    renderOffscreen(renderer as never, scene, camera, panel)
    expect(calls.at(-1)).toBe('target:null')
  })

  it('restores the renderer even if the pass throws', () => {
    const headset = { name: 'headset' }
    const { renderer } = fakeRenderer(headset)
    renderer.render = () => {
      throw new Error('context lost')
    }
    expect(() => renderOffscreen(renderer as never, scene, camera, panel)).toThrow('context lost')
    expect(renderer.target).toBe(headset)
    expect(renderer.xr.enabled).toBe(true)
  })
})

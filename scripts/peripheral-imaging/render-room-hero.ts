/** Reproduce the room still with the actual suite entry point, local assets and software WebGL. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { chromium, type Browser } from '@playwright/test'
import sharp from 'sharp'
import { REVISION } from 'three'
import { createServer } from 'vite'
import anatomy from '../../public/peripheral-imaging/anatomy/manifest.json'
import { suiteViewErrors } from '../../src/features/peripheral-imaging/components/suite/suiteViewSpec'
import { ROOM_FIXTURE, ROOM_HERO } from './room-fixture'

const root = process.cwd()
const require = createRequire(path.join(root, 'package.json'))
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')

async function main() {
  assert.deepEqual(suiteViewErrors(ROOM_FIXTURE), [])
  const server = await createServer({
    configFile: false,
    root,
    publicDir: path.join(root, 'public'),
    resolve: {
      alias: { '@fluoroview': path.join(root, 'fluoro-viewer/src'), '@': path.join(root, 'src') },
    },
    esbuild: { jsx: 'automatic' },
    server: { host: '127.0.0.1', port: 0 },
  })
  await server.listen()
  let browser: Browser | undefined
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--force-color-profile=srgb',
      ],
    })
    const page = await browser.newPage({
      viewport: { width: ROOM_HERO.width, height: ROOM_HERO.height + 300 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      colorScheme: 'dark',
    })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('requestfailed', (request) =>
      errors.push(`${request.url()}: ${request.failure()?.errorText}`),
    )
    const url = new URL(
      'scripts/peripheral-imaging/suite-harness.html?mode=room',
      server.resolvedUrls!.local[0],
    )
    await page.goto(url.href)
    // Export the canvas, never a screenshot of DOM chrome. The fixture determines the scene;
    // these dimensions only override the preview harness's responsive display size.
    await page.addStyleTag({
      content: `
      main { max-width: none !important; margin: 0 !important; padding: 0 !important; }
      [data-suite-viewport] { width: ${ROOM_HERO.width}px !important; height: ${ROOM_HERO.height}px !important; }
    `,
    })
    const canvas = page.locator('canvas[data-three-state=ready]')
    await canvas.waitFor({ timeout: 60_000 })
    await page.waitForFunction(({ width, height }) => {
      const canvas = document.querySelector('canvas')
      return canvas?.width === width && canvas.height === height
    }, ROOM_HERO)
    assert.equal(await page.locator('canvas').count(), 1, 'room must not allocate a DRR canvas')
    assert.equal(
      await page.locator('[data-chain-pin], [data-readouts], [data-suite-controls]').count(),
      0,
    )
    const captured = await canvas.evaluate(async (node) => {
      const element = node as HTMLCanvasElement
      const gl = element.getContext('webgl2')!
      // GLTF loading and camera fitting have completed at FrameReady. Require three identical
      // frames as an additional guard against late layout/material effects or a running clock.
      let previous = '',
        stable = 0
      for (let frame = 0; frame < 60; frame++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        gl.finish()
        const current = element.toDataURL('image/png')
        stable = current === previous ? stable + 1 : 0
        previous = current
        if (stable === 3)
          return { png: current.split(',')[1], width: element.width, height: element.height }
      }
      throw new Error('Room did not settle to a still frame')
    })
    assert.deepEqual(errors, [])
    assert.equal(captured.width, ROOM_HERO.width)
    assert.equal(captured.height, ROOM_HERO.height)
    const png = await sharp(Buffer.from(captured.png, 'base64'))
      .removeAlpha()
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer()
    assert(
      png.length < ROOM_HERO.maximumBytes,
      `PNG is ${png.length} bytes; budget is ${ROOM_HERO.maximumBytes}`,
    )
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
    const background = [6, 21, 25]
    // Every outer pixel must sit flush against the module shell, including the floor edge.
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        if (x !== 0 && y !== 0 && x !== info.width - 1 && y !== info.height - 1) continue
        const start = (y * info.width + x) * info.channels
        assert.deepEqual(
          [...data.subarray(start, start + 3)],
          background,
          `Background pixel ${x},${y}`,
        )
      }
    const sources = [
      'package-lock.json',
      'public/peripheral-imaging/anatomy/thorax.glb',
      'scripts/peripheral-imaging/room-fixture.ts',
      'scripts/peripheral-imaging/render-room-hero.ts',
      'scripts/peripheral-imaging/suite-harness.tsx',
      'src/features/peripheral-imaging/lib/physics.ts',
      'src/features/peripheral-imaging/lib/anatomy.ts',
      ...[
        'Anatomy.tsx',
        'CameraRig.tsx',
        'Room.tsx',
        'ParametricCarm.tsx',
        'DetectorImage.tsx',
        'SuiteScene.tsx',
        'SuiteScenePane.tsx',
        'ImagingSuitePane.tsx',
        'LabDock.tsx',
        'suiteModel.ts',
        'suiteViewSpec.ts',
        'types.ts',
        'suite-scene.module.css',
      ].map((name) => `src/features/peripheral-imaging/components/suite/${name}`),
    ].map((file) => ({ path: file, sha256: sha256(readFileSync(path.join(root, file))) }))
    const provenance = {
      schema: 'peripheral-imaging-room-render/v1',
      authoredOn: '2026-09-09',
      source:
        'Repository-authored room and gantry with the Slicer-derived thorax; actual room mode, without DOM overlays or a DRR',
      sourceSha256: sha256(JSON.stringify(sources)),
      ctSourceSha256: anatomy.sourceSha256,
      airwaySourceSha256: anatomy.airwaySourceSha256,
      sources,
      output: {
        path: 'room-hero.png',
        width: info.width,
        height: info.height,
        bytes: png.length,
        sha256: sha256(png),
      },
      render: {
        background: ROOM_HERO.background,
        camera: ROOM_FIXTURE.camera,
        variant: ROOM_FIXTURE.variant,
        defaults: ROOM_FIXTURE.defaults,
        layers: ROOM_FIXTURE.layers,
        deviceScaleFactor: 1,
        antialias: true,
        renderer: 'ANGLE SwiftShader',
        dracoDecoderSha256: sha256(readFileSync('public/fluoroview/draco/draco_decoder.wasm')),
        dracoWrapperSha256: sha256(readFileSync('public/fluoroview/draco/draco_wasm_wrapper.js')),
        threeRevision: REVISION,
        chromium: browser.version(),
        playwright: require('@playwright/test/package.json').version,
        sharp: sharp.versions.sharp,
        vips: sharp.versions.vips,
        png: 'Lossless RGB, compression level 9, adaptive filtering; no resizing or palette quantization',
      },
      command: 'npx tsx scripts/peripheral-imaging/render-room-hero.ts',
      limitations: ROOM_FIXTURE.boundary,
    }
    writeFileSync(path.join(root, ROOM_HERO.output), png)
    writeFileSync(
      path.join(root, 'public/peripheral-imaging/room-hero.json'),
      JSON.stringify(provenance, null, 2) + '\n',
    )
    await import('./write-asset-manifest')
    console.log(
      `${ROOM_HERO.output}: ${info.width} × ${info.height}, ${png.length} bytes, SHA-256 ${sha256(png)}`,
    )
  } finally {
    await browser?.close()
    await server.close()
  }
}
void main()

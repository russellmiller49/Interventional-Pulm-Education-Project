import fs from 'node:fs'
import path from 'node:path'

describe('airway-stent explorer asset publication policy', () => {
  const repositoryRoot = process.cwd()
  const nextConfig = fs.readFileSync(path.join(repositoryRoot, 'next.config.mjs'), 'utf8')

  it('keeps protected v1 assets out of shared caches and v2 assets in private caches', () => {
    expect(nextConfig).not.toMatch(/const moduleAssetPrefixes = \[[^\]]*'\/airway-stent-mechanics'/)
    expect(nextConfig).toMatch(
      /airway-stent-mechanics\/models\/v1\/:path\*[\s\S]*private, no-store, max-age=0/,
    )
    expect(nextConfig).toMatch(
      /airway-stent-mechanics\/models\/v2\/:path\*[\s\S]*private, max-age=31536000, immutable/,
    )
  })

  it('keeps the learner explorer code-native and free of v1 model requests', () => {
    const explorerDirectory = path.join(
      repositoryRoot,
      'src/features/airway-stent-mechanics/components/explorer',
    )
    const explorerSource = fs
      .readdirSync(explorerDirectory)
      .filter((fileName) => fileName.endsWith('.tsx') || fileName.endsWith('.ts'))
      .map((fileName) => fs.readFileSync(path.join(explorerDirectory, fileName), 'utf8'))
      .join('\n')

    expect(explorerSource).not.toMatch(/airway-stent-mechanics\/models\/v1/i)
    expect(explorerSource).not.toMatch(/\.glb(?:\?|['"])/i)
  })
})

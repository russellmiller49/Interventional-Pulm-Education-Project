/**
 * Builds the interactive foundation-workspace fixture.
 *
 * Direct command (nothing is added to package.json for this):
 *
 *   npx esbuild scripts/cardiohelp-ecmo/build-foundation-workspace-preview.mts --bundle \
 *     --platform=node --format=cjs --packages=external --log-level=error \
 *     --outfile=node_modules/.cache/ecmo/workspace-preview.cjs \
 *     && node node_modules/.cache/ecmo/workspace-preview.cjs
 *
 * Output, all inside the already-ignored preview area:
 *
 *   public/ecmo-teaching-preview/workspace.html
 *   public/ecmo-teaching-preview/workspace.js
 *   public/ecmo-teaching-preview/workspace.css
 *
 * Served by the existing `trainer-prod-static` launch config on :8099 at
 * /ecmo-teaching-preview/workspace.html — no production route, no change to authentication.
 *
 * Two build stages, because the app's CSS arrives by two different routes:
 *
 *  1. esbuild bundles the entry and every CSS module it imports (`local-css`), which is what carries
 *     the console's device styling, the shared workspace's grid and this package's own module.
 *  2. postcss/Tailwind compiles `src/styles/globals.css` with the project's real Tailwind config, so
 *     the utility classes the activity is written in — and the `:root` / `.dark` semantic tokens the
 *     readable-theme override has to actually override — are the same ones the app ships.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import autoprefixer from 'autoprefixer'
import { build, type Plugin } from 'esbuild'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'

import tailwindConfig from '../../tailwind.config.ts'

const root = process.cwd()
const scriptDir = join(root, 'scripts', 'cardiohelp-ecmo')
const outputDir = join(root, 'public', 'ecmo-teaching-preview')

/** `@/…` → `src/…`, with the three fixture-only substitutions. */
const moduleOverrides: Readonly<Record<string, string>> = {
  '@/i18n/navigation': join(scriptDir, 'preview-navigation.tsx'),
  '@/i18n/handoff': join(scriptDir, 'preview-static-shims.tsx'),
}

const candidateSuffixes = ['', '.tsx', '.ts', '.jsx', '.js', '.css', '/index.tsx', '/index.ts']

function resolveFromSrc(specifier: string): string {
  const base = join(root, 'src', specifier.slice(2))
  for (const suffix of candidateSuffixes) {
    const candidate = `${base}${suffix}`
    if (existsSync(candidate)) return candidate
  }
  throw new Error(`fixture bundle cannot resolve ${specifier}`)
}

const fixtureResolver: Plugin = {
  name: 'ecmo-foundation-workspace-fixture',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^@\// }, (args) => {
      const override = moduleOverrides[args.path]
      return { path: override ?? resolveFromSrc(args.path) }
    })
    // The bedside 3D scene: real in the app, stubbed here. See preview-static-shims.tsx.
    pluginBuild.onResolve({ filter: /(^|\/)EcmoCircuit3D(\.tsx)?$/ }, () => ({
      path: join(scriptDir, 'preview-static-shims.tsx'),
    }))
  },
}

async function main() {
  const bundle = await build({
    entryPoints: [join(scriptDir, 'foundation-workspace-preview-entry.tsx')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['chrome120', 'safari17'],
    jsx: 'automatic',
    plugins: [fixtureResolver],
    loader: {
      '.module.css': 'local-css',
      '.css': 'css',
      '.svg': 'dataurl',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
    },
    define: { 'process.env.NODE_ENV': '"production"' },
    outfile: join(outputDir, 'workspace.js'),
    logLevel: 'error',
  })

  const scriptOutput = bundle.outputFiles.find((file) => file.path.endsWith('.js'))
  const moduleCssOutput = bundle.outputFiles.find((file) => file.path.endsWith('.css'))
  if (!scriptOutput) throw new Error('esbuild produced no script output')

  const globalsPath = join(root, 'src', 'styles', 'globals.css')
  const configuredContent = Array.isArray(tailwindConfig.content) ? tailwindConfig.content : []
  const tailwindOutput = await postcss([
    tailwindcss({
      ...tailwindConfig,
      content: [...(configuredContent as string[]), './scripts/cardiohelp-ecmo/**/*.{ts,tsx}'],
    }),
    autoprefixer(),
  ]).process(readFileSync(globalsPath, 'utf8'), { from: globalsPath, to: join(outputDir, 'workspace.css') })

  /*
   * Tailwind first, CSS modules second — the order the app loads them in, and the order this package's
   * readable-theme override depends on: every override it makes is either a custom-property
   * declaration or a higher-specificity rule, both of which need the utility layer already present.
   */
  const css = [
    '/* Compiled from src/styles/globals.css with the project Tailwind config. */',
    tailwindOutput.css,
    '/* CSS modules, bundled by esbuild in import order. */',
    moduleCssOutput ? Buffer.from(moduleCssOutput.contents).toString('utf8') : '',
  ].join('\n')

  const html = [
    '<!doctype html>',
    '<html lang="en" class="dark" data-scroll-behavior="smooth">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>ECMO foundation workspace — interactive layout fixture</title>',
    '<link rel="stylesheet" href="./workspace.css">',
    '</head>',
    // class="dark" on <html> is the point of this fixture. next-themes puts it there whenever the
    // visitor prefers a dark colour scheme, and that is the only condition under which the
    // workspace's light surface inherited dark-theme foreground tokens.
    '<body class="min-h-screen bg-background font-sans antialiased">',
    '<div id="root"></div>',
    '<script src="./workspace.js"></script>',
    '</body>',
    '</html>',
    '',
  ].join('\n')

  mkdirSync(outputDir, { recursive: true })
  writeFileSync(join(outputDir, 'workspace.js'), Buffer.from(scriptOutput.contents))
  writeFileSync(join(outputDir, 'workspace.css'), css, 'utf8')
  writeFileSync(join(outputDir, 'workspace.html'), html, 'utf8')

  console.log(`Wrote ${join(outputDir, 'workspace.html')}`)
  console.log(
    `  workspace.js  ${(scriptOutput.contents.byteLength / 1024).toFixed(0)} kB\n` +
      `  workspace.css ${(Buffer.byteLength(css, 'utf8') / 1024).toFixed(0)} kB` +
      ` (tailwind ${(Buffer.byteLength(tailwindOutput.css, 'utf8') / 1024).toFixed(0)} kB)`,
  )
  console.log('Serve with the trainer-prod-static launch config: http://localhost:8099/ecmo-teaching-preview/workspace.html')
}

void main()

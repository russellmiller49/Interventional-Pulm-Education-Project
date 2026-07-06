import path from 'node:path'

import { withContentlayer } from 'next-contentlayer2'
import createNextIntlPlugin from 'next-intl/plugin'

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.ncbi.nlm.nih.gov https://pmc.ncbi.nlm.nih.gov https://upload.wikimedia.org https://*.supabase.co https://*.storage.supabase.co",
  "connect-src 'self' https://api.github.com https://tqnhxlwvkkswuckszlee.supabase.co https://tqnhxlwvkkswuckszlee.storage.supabase.co https://*.supabase.co https://cdn.jsdelivr.net",
  "font-src 'self' https://cdn.scite.ai",
  "frame-src 'self'",
  "media-src 'self' https://*.supabase.co https://*.storage.supabase.co https://ebus2026.s3.us-east-1.amazonaws.com https://pccmintro.s3.us-east-1.amazonaws.com blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'self' blob:",
].join('; ')

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: csp,
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), xr-spatial-tracking=(self)',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const embeddedAppSecurityHeaders = securityHeaders.map((header) => {
  if (header.key === 'Content-Security-Policy') {
    return {
      key: header.key,
      value: csp
        .replace(
          "connect-src 'self' https://api.github.com https://tqnhxlwvkkswuckszlee.supabase.co https://tqnhxlwvkkswuckszlee.storage.supabase.co https://*.supabase.co https://cdn.jsdelivr.net",
          "connect-src 'self' data: https://api.github.com https://tqnhxlwvkkswuckszlee.supabase.co https://tqnhxlwvkkswuckszlee.storage.supabase.co https://*.supabase.co",
        )
        .replace(
          "style-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        )
        .replace(
          "font-src 'self' https://cdn.scite.ai",
          "font-src 'self' https://cdn.scite.ai https://fonts.gstatic.com data:",
        ),
    }
  }

  if (header.key === 'X-Frame-Options') {
    return {
      key: header.key,
      value: 'SAMEORIGIN',
    }
  }

  return header
})

const immutableAssetHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=31536000, immutable',
  },
]

const shortAssetManifestHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=300',
  },
]

const moduleAssetPrefixes = [
  '/airway-anatomy',
  '/models',
  '/draco',
  '/socal-ebus-course/app',
  '/bronch-navigation-trainer/app',
  '/module-assets/v1',
]

const immutableModuleAssetExtensions = [
  'bin',
  'br',
  'css',
  'glb',
  'gltf',
  'gz',
  'jpeg',
  'jpg',
  'js',
  'mp4',
  'nrrd',
  'png',
  'raw',
  'stl',
  'wasm',
  'webp',
  'zst',
]

const moduleAssetHeaderRules = moduleAssetPrefixes.flatMap((prefix) =>
  immutableModuleAssetExtensions.map((extension) => ({
    source: `${prefix}/:path*.${extension}`,
    headers: immutableAssetHeaders,
  })),
)

const moduleManifestHeaderRules = moduleAssetPrefixes.map((prefix) => ({
  source: `${prefix}/:path*.json`,
  headers: shortAssetManifestHeaders,
}))

const moduleAssetOrigin = process.env.MODULE_ASSET_ORIGIN?.trim().replace(/\/+$/, '')

const moduleAssetFallbackRewrites = moduleAssetOrigin
  ? [
      {
        source: '/module-assets/v1/:path*',
        destination: `${moduleAssetOrigin}/:path*`,
      },
      {
        source: '/airway-anatomy/:path*',
        destination: `${moduleAssetOrigin}/airway-anatomy/:path*`,
      },
      {
        source: '/bronch-navigation-trainer/app/cases/:path*',
        destination: `${moduleAssetOrigin}/bronch-navigation-trainer/app/cases/:path*`,
      },
      {
        source: '/draco/:path*',
        destination: `${moduleAssetOrigin}/draco/:path*`,
      },
      {
        source: '/fluoroview/:path*',
        destination: `${moduleAssetOrigin}/fluoroview/:path*`,
      },
      {
        source: '/models/:path*',
        destination: `${moduleAssetOrigin}/models/:path*`,
      },
      {
        source: '/socal-ebus-course/app/assets/:path*',
        destination: `${moduleAssetOrigin}/socal-ebus-course/app/assets/:path*`,
      },
      {
        source: '/socal-ebus-course/app/media/:path*',
        destination: `${moduleAssetOrigin}/socal-ebus-course/app/media/:path*`,
      },
      {
        source: '/socal-ebus-course/app/pipelines/:path*',
        destination: `${moduleAssetOrigin}/socal-ebus-course/app/pipelines/:path*`,
      },
      {
        source: '/socal-ebus-course/app/simulator/:path*',
        destination: `${moduleAssetOrigin}/socal-ebus-course/app/simulator/:path*`,
      },
    ]
  : []

const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  output: 'standalone',
  // @react-three/xr ships modern ESM/JSX that Next's server compile must transpile.
  transpilePackages: ['@react-three/xr'],
  experimental: {
    optimizePackageImports: [
      '@react-three/drei',
      '@react-three/fiber',
      'framer-motion',
      'lucide-react',
    ],
  },
  turbopack: {
    resolveAlias: {
      '@fluoroview': path.resolve(process.cwd(), 'fluoro-viewer/src'),
    },
    resolveExtensions: ['.js', '.ts', '.tsx', '.json'],
  },
  images: {
    maximumDiskCacheSize: 50 * 1024 * 1024,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.ncbi.nlm.nih.gov',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pmc.ncbi.nlm.nih.gov',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply security headers to HTML pages only, not static app assets.
        source:
          '/((?!fluoroview|socal-ebus-course/app|bronch-navigation-trainer/app|thermal-ablation/|peripheral-ablation/).*)',
        headers: securityHeaders,
      },
      {
        // Allow the bundled SoCal EBUS app to render inside the same-site iframe.
        source: '/socal-ebus-course/app/:path*',
        headers: embeddedAppSecurityHeaders,
      },
      {
        // Allow the admin-gated thermal ablation modules to render inside the same-site iframe.
        source: '/thermal-ablation/:path*',
        headers: embeddedAppSecurityHeaders,
      },
      {
        // Allow the admin-gated peripheral ablation module to render inside the same-site iframe.
        source: '/peripheral-ablation/:path*',
        headers: embeddedAppSecurityHeaders,
      },
      {
        // Allow the bundled Bronch Navigation Trainer to render inside the same-site iframe.
        source: '/bronch-navigation-trainer/app/:path*',
        headers: embeddedAppSecurityHeaders,
      },
      {
        // Apply relaxed CSP to fluoroview pages for WebGL/WebAssembly
        source: '/fluoroview/:path*',
        headers: securityHeaders,
      },
      ...moduleAssetHeaderRules,
      ...moduleManifestHeaderRules,
      {
        // Serve proper USDZ MIME for Quick Look
        source: '/:all*(usdz)',
        headers: [
          {
            key: 'Content-Type',
            value: 'model/vnd.usdz+zip',
          },
        ],
      },
      {
        source: '/fluoroview/:path*.glb',
        headers: [
          {
            key: 'Content-Type',
            value: 'model/gltf-binary',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/fluoroview/:path*.wasm',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/wasm',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/fluoroview/:path*.raw',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/octet-stream',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/fluoroview/:path*.bin',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/octet-stream',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/fluoroview/:path*.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=300',
          },
        ],
      },
      {
        source: '/fluoroview/:path*.svg',
        headers: [
          {
            key: 'Content-Type',
            value: 'image/svg+xml; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=300',
          },
        ],
      },
    ]
  },
  async rewrites() {
    return {
      afterFiles: [
        {
          source: '/socal-ebus-course/app',
          destination: '/socal-ebus-course/app/index.html',
        },
        {
          source: '/socal-ebus-course/app/',
          destination: '/socal-ebus-course/app/index.html',
        },
        {
          source: '/bronch-navigation-trainer/app',
          destination: '/bronch-navigation-trainer/app/index.html',
        },
        {
          source: '/bronch-navigation-trainer/app/',
          destination: '/bronch-navigation-trainer/app/index.html',
        },
      ],
      fallback: moduleAssetFallbackRewrites,
    }
  },
  // Ensure static files are served correctly
  trailingSlash: false,
  generateEtags: false,
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@fluoroview': path.resolve(process.cwd(), 'fluoro-viewer/src'),
    }
    // Ensure .js files from three.js examples can be imported
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.js', '.ts', '.tsx'],
    }
    return config
  },
}

const withNextIntl = createNextIntlPlugin()

export default withNextIntl(withContentlayer(nextConfig))

import path from 'node:path'

import { withContentlayer } from 'next-contentlayer2'

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://api.github.com https://tqnhxlwvkkswuckszlee.supabase.co https://tqnhxlwvkkswuckszlee.storage.supabase.co https://*.supabase.co",
  "font-src 'self' https://cdn.scite.ai",
  "frame-src 'self'",
  "media-src 'self'",
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
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    optimizePackageImports: [
      '@react-three/drei',
      '@react-three/fiber',
      'framer-motion',
      'lucide-react',
    ],
  },
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        // Apply security headers to HTML pages only, not static assets
        source: '/((?!fluoroview).*)',
        headers: securityHeaders,
      },
      {
        // Apply relaxed CSP to fluoroview pages for WebGL/WebAssembly
        source: '/fluoroview/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Content-Type',
            value: 'text/html; charset=utf-8',
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
    ]
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

export default withContentlayer(nextConfig)

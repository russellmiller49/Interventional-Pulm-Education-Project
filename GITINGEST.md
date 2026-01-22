# Repository Gitingest: Interventional Pulmonology Education Platform

## Overview

This is a comprehensive Next.js-based educational platform for interventional pulmonology. The website serves as a learning resource, board review tool, and interactive educational hub for medical professionals specializing in interventional pulmonology procedures.

**Repository Name:** `IP_website` / `interventionalpulm`  
**Primary Domain:** interventionalpulm.com  
**Framework:** Next.js 14.2+ with React 18.2  
**Language:** TypeScript  
**Package Manager:** npm 10.8.2+  
**Node Version:** >=20.0.0

## Purpose & Core Functionality

The platform provides:

1. **Board Review Materials** - Structured educational content for interventional pulmonology board exams
2. **3D Visualization** - Interactive 3D models and fluoroscopy viewers using Three.js
3. **XR Support** - Extended reality (AR/VR) capabilities for medical visualization
4. **QA Sandbox** - Integration with Procedure Suite backend for procedure note analysis
5. **Content Management** - MDX-based content system with Contentlayer2
6. **Community Features** - User authentication, dashboards, and resource sharing
7. **Learning Modules** - Structured educational pathways and training materials

## Technology Stack

### Core Framework

- **Next.js 14.2.35** - React framework with App Router
- **React 18.2.0** - UI library
- **TypeScript 5.5.4** - Type safety

### UI & Styling

- **Tailwind CSS 3.4.13** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives (accordion, dialog, tabs, toast, tooltip, etc.)
- **Framer Motion 12.23.22** - Animation library
- **Lucide React** - Icon library
- **shadcn/ui** - Component library (inferred from Radix UI usage)

### 3D & Visualization

- **Three.js 0.180.0** - 3D graphics library
- **@react-three/fiber 8.15.13** - React renderer for Three.js
- **@react-three/drei 9.92.6** - Useful helpers for react-three-fiber
- **three-mesh-bvh** - Bounding Volume Hierarchy for raycasting
- **three-stdlib** - Standard library utilities

### Content & Documentation

- **Contentlayer2 0.5.8** - Content management system
- **react-markdown 10.1.0** - Markdown rendering
- **Mermaid 11.12.0** - Diagram generation
- **MDX** - Markdown with JSX support

### Backend & Database

- **Supabase** - Backend-as-a-Service
  - `@supabase/supabase-js 2.76.1` - JavaScript client
  - `@supabase/ssr 0.7.0` - Server-side rendering support
- **Express 5.1.0** - Custom server (server.js)

### Forms & Validation

- **react-hook-form 7.52.1** - Form management
- **Zod 3.23.8** - Schema validation

### Data Visualization

- **Recharts 2.9.0** - Chart library
- **@react-pdf/renderer 3.2.0** - PDF generation

### Search & Utilities

- **Fuse.js 6.6.2** - Fuzzy search
- **next-themes 0.3.0** - Theme management (dark/light mode)

### Development Tools

- **Jest 29.7.0** - Testing framework
- **Testing Library** - React component testing
- **Storybook 8.6.14** - Component development environment
- **ESLint** - Linting
- **Prettier** - Code formatting
- **Husky** - Git hooks
- **Commitlint** - Commit message linting

## Project Structure

```
IP_website/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (marketing)/        # Marketing pages group
│   │   ├── admin/              # Admin dashboard
│   │   ├── api/                # API routes
│   │   │   ├── analytics/       # Analytics endpoints
│   │   │   ├── auth/           # Authentication endpoints
│   │   │   ├── download/       # File download endpoints
│   │   │   ├── image-proxy/    # Image proxying
│   │   │   ├── qa/             # QA sandbox API (run, feedback, sessions, delete)
│   │   │   └── storage/        # Storage endpoints
│   │   ├── auth/               # Authentication pages
│   │   ├── board-prep/         # Board preparation materials
│   │   ├── coming-soon/        # Coming soon pages
│   │   ├── community/          # Community features
│   │   ├── dashboard/          # User dashboard
│   │   ├── fluoroview/         # Fluoroscopy viewer (3D)
│   │   ├── learn/              # Learning modules
│   │   ├── pocus/              # Point-of-care ultrasound
│   │   ├── qa-admin/           # QA admin dashboard
│   │   ├── qa-sandbox/         # QA sandbox interface
│   │   ├── resources/          # Resource library
│   │   ├── xr/                 # Extended reality pages
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   └── globals.css         # Global styles
│   ├── components/             # React components
│   │   ├── 3d/                 # 3D-related components
│   │   ├── auth/               # Authentication components
│   │   ├── board-review/       # Board review components
│   │   ├── fluoroview/         # Fluoroscopy viewer components
│   │   ├── github/             # GitHub integration components
│   │   ├── home/               # Home page components
│   │   ├── layout/             # Layout components
│   │   ├── make/               # Maker/tool components
│   │   ├── mdx/                # MDX rendering components
│   │   ├── training/           # Training components
│   │   ├── ui/                 # Reusable UI components (shadcn/ui)
│   │   └── XRViewer.tsx        # XR viewer component
│   ├── lib/                    # Utility libraries
│   │   ├── supabase/           # Supabase client configuration
│   │   │   └── admin.ts        # Server-side Supabase admin client
│   │   ├── 3d-utils.ts         # 3D utility functions
│   │   ├── analytics.ts            # Analytics utilities
│   │   ├── board-review-loader.ts # Board review data loader
│   │   ├── cn.ts               # Class name utility (clsx + tailwind-merge)
│   │   ├── env.ts              # Environment variable validation
│   │   ├── format-duration.ts  # Duration formatting
│   │   ├── github-api.ts       # GitHub API integration
│   │   ├── mdx-utils.ts        # MDX processing utilities
│   │   ├── metadata.ts         # Metadata generation
│   │   ├── slugify.ts          # URL slug generation
│   │   ├── types.ts            # TypeScript type definitions
│   │   └── xrSupport.ts        # XR capability detection
│   ├── data/                   # Static data files
│   ├── hooks/                  # Custom React hooks
│   ├── styles/                 # Additional styles
│   └── types/                  # TypeScript type definitions
├── content/                    # MDX content files
│   └── modules/                # Content modules
│       └── board/              # Board review modules
├── public/                     # Static assets
│   ├── models/                 # 3D model files (.glb, .usdz)
│   └── draco/                  # Draco compression files
├── fluoro-viewer/              # Fluoroscopy viewer submodule
├── Imports/                    # Imported content (not in git)
│   ├── Board_Review_Book/      # Board review book markdown files
│   └── Journal_Club_Podcasts/  # Podcast content
├── in-development/             # Work in progress (excluded from build)
├── stories/                    # Storybook stories
├── scripts/                    # Build and utility scripts
├── .contentlayer/              # Generated contentlayer files (gitignored)
├── .next/                       # Next.js build output (gitignored)
├── node_modules/               # Dependencies (gitignored)
├── next.config.mjs             # Next.js configuration
├── contentlayer.config.ts     # Contentlayer configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
├── jest.config.ts              # Jest test configuration
├── server.js                  # Custom Express server
├── package.json                # Dependencies and scripts
└── .gitignore                  # Git ignore rules
```

## Key Features & Modules

### 1. Board Review System

- Structured educational modules for board exam preparation
- MDX-based content with metadata (categories, tags, exam domains)
- Estimated reading time and learning objectives
- Located in: `content/modules/board/` and `src/app/board-prep/`

### 2. QA Sandbox Integration

- Integration with external Procedure Suite Python backend
- Procedure note analysis and coding
- Feedback collection system
- Admin dashboard for session management
- API routes: `/api/qa/run`, `/api/qa/feedback`, `/api/qa/sessions`, `/api/qa/delete`
- Pages: `/qa-sandbox`, `/qa-admin`
- Requires: `PROC_API_URL` environment variable

### 3. 3D Visualization (Fluoroview)

- Interactive 3D medical models
- WebGL-based rendering with Three.js
- Support for .glb and .usdz formats
- Custom webpack alias: `@fluoroview`
- Located in: `fluoro-viewer/` and `src/app/fluoroview/`
- Special CSP headers for WebGL/WebAssembly

### 4. Extended Reality (XR)

- AR/VR support for medical visualization
- WebXR API integration
- Located in: `src/app/xr/` and `src/components/XRViewer.tsx`

### 5. Content Management

- Contentlayer2 for MDX processing
- Automatic heading linking and slug generation
- Board review chapter metadata mapping
- Content directory: `content/modules/board/`

### 6. Authentication & User Management

- Supabase authentication
- User dashboards
- Admin features
- API routes: `/api/auth/*`

### 7. Analytics

- Custom analytics implementation
- API routes: `/api/analytics/*`

## Configuration Files

### next.config.mjs

- React strict mode enabled
- Content Security Policy (CSP) headers
- Security headers (HSTS, X-Frame-Options, etc.)
- Image optimization with remote patterns (NCBI CDN)
- Webpack configuration for Three.js and fluoroview
- Contentlayer integration
- Typed routes (experimental)

### tailwind.config.ts

- Dark mode support (class-based)
- Custom color palette with CSS variables
- Typography plugin for prose styling
- Custom animations and keyframes
- Container configuration

### tsconfig.json

- Strict TypeScript settings
- Path aliases: `@/*` → `./src/*`, `@fluoroview/*` → `./fluoro-viewer/src/*`
- Contentlayer generated types included
- Excludes: `node_modules`, `in-development`

### contentlayer.config.ts

- BoardModule document type definition
- MDX processing with rehype plugins
- Automatic heading slugs and links
- Metadata mapping from `src/data/board-review`

## Environment Variables

Required environment variables (create `.env.local`):

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx          # Server-side only
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# Procedure Suite API (for QA Sandbox)
PROC_API_URL=http://localhost:8000     # Or production URL

# Other
NODE_ENV=development|production
```

## Build & Development Scripts

```bash
# Development
npm run dev              # Start dev server on port 3001

# Build
npm run build:content   # Build contentlayer content
npm run build           # Full production build
npm run build:static    # Static export build

# Production
npm start               # Start production server (uses server.js)

# Testing
npm test                # Run Jest tests
npm run test:watch      # Watch mode
npm run type-check      # TypeScript type checking

# Code Quality
npm run lint            # ESLint
npm run storybook       # Start Storybook on port 6006

# Deployment
npm run deploy:cloud     # Cloud deployment build
npm run deploy:static   # Static site deployment
```

## Deployment

### Platforms Supported

- **Railway** - Configuration in `railway.toml`
- **Hostinger Cloud** - Configuration in `hostinger.config.js`
- **Static Export** - Via `next export`

### Custom Server

- Uses Express.js (`server.js`) for production
- Handles custom routing and middleware
- Port configuration via environment variable

### Build Process

1. Contentlayer builds MDX content
2. Next.js builds React application
3. Static assets optimized
4. Custom server started for production

## Security Features

- Content Security Policy (CSP) headers
- Strict Transport Security (HSTS)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy restrictions
- Relaxed CSP for fluoroview pages (WebGL/WebAssembly needs)

## Content Sources

### Board Review Book

- Location: `Imports/Board_Review_Book/`
- Format: Markdown files
- Topics include:
  - Rigid Bronchoscopy
  - EBUS and Lung Cancer Staging
  - Airway Stents
  - Thermal Ablative Therapies
  - Pleural Interventions
  - And many more...

### Journal Club Podcasts

- Location: `Imports/Journal_Club_Podcasts/`
- Episode references and content

## Integration Points

### External Services

1. **Supabase** - Database, authentication, storage
2. **Procedure Suite Backend** - QA analysis (Python FastAPI)
3. **GitHub API** - Repository integration
4. **NCBI CDN** - Medical images and publications

### API Endpoints

#### QA Sandbox

- `POST /api/qa/run` - Run QA analysis on procedure notes
- `POST /api/qa/feedback` - Submit feedback
- `GET /api/qa/sessions` - List QA sessions
- `DELETE /api/qa/delete` - Delete QA session

#### Other APIs

- `/api/auth/*` - Authentication
- `/api/analytics/*` - Analytics tracking
- `/api/download/*` - File downloads
- `/api/image-proxy/*` - Image proxying
- `/api/storage/*` - Storage operations

## Development Workflow

1. **Content Updates**: Add MDX files to `content/modules/board/`
2. **Component Development**: Use Storybook for isolated component work
3. **Testing**: Jest + Testing Library for unit/integration tests
4. **Code Quality**: ESLint + Prettier + Husky hooks
5. **Type Safety**: TypeScript strict mode enabled

## Important Notes

- **Port**: Development server runs on port 3001 (not default 3000)
- **Contentlayer**: Must run `build:content` before main build
- **3D Models**: Large .glb files should be optimized (Draco compression available)
- **Temporary Files**: Files in `in-development/` are excluded from builds
- **Imports Directory**: Contains source materials, may not be in git

## Testing Strategy

- **Unit Tests**: Jest with jsdom environment
- **Component Tests**: Testing Library for React components
- **E2E**: Not explicitly configured (consider adding Playwright/Cypress)
- **Type Checking**: Separate `type-check` script

## Performance Optimizations

- Next.js Image optimization
- Package import optimization (framer-motion, lucide-react, etc.)
- Webpack bundle optimization
- Static asset caching headers
- Contentlayer for efficient content processing

## Accessibility

- Radix UI components (ARIA-compliant)
- Storybook accessibility addon
- Semantic HTML structure
- Keyboard navigation support

## Browser Support

- Modern browsers with WebGL support
- WebXR support for XR features
- WebAssembly for advanced 3D features

## Future Considerations

- Consider adding Playwright for E2E testing
- Evaluate migration to Next.js 15 when stable
- Consider optimizing large 3D model loading
- Potential migration to Turbopack for faster builds

---

**Last Updated**: Generated automatically - update as repository evolves  
**Maintainer**: Review and update this document when making significant architectural changes

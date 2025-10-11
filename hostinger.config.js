// Hostinger deployment configuration
// This file helps configure your project for different Hostinger hosting options

const hostingerConfig = {
  // Deployment type: 'static' for shared hosting, 'vps' for VPS hosting
  deploymentType: 'static', // Change to 'vps' if using VPS hosting
  
  // Domain configuration
  domain: 'interventionalpulm.org',
  
  // Build settings
  build: {
    // For static export (shared hosting)
    static: {
      output: 'export',
      trailingSlash: true,
      images: {
        unoptimized: true,
      },
    },
    // For VPS hosting
    vps: {
      output: undefined, // Keep default Next.js build
      trailingSlash: false,
      images: {
        unoptimized: false,
      },
    },
  },
  
  // Environment variables for production
  env: {
    NEXT_PUBLIC_APP_URL: 'https://interventionalpulm.org',
  },
};

module.exports = hostingerConfig;





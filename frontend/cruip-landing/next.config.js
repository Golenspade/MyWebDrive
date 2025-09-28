const { default: nextra } = require('nextra');
const withNextra = nextra({
  // Nextra v4: theme and contentDir are not set here anymore
  contentDirBasePath: '/docs',
});

/** @type {import('next').NextConfig} */
const nextBase = {
  async rewrites() {
    const apiBase = process.env.API_BASE_URL || 'http://localhost:9080'
    return {
      beforeFiles: [
        // Proxy API to real backend gateway in dev
        { source: '/api/v1/:path*', destination: `${apiBase}/api/v1/:path*` },
        // Optional: serve assets from gateway (assetsReal -> /assets)
        { source: '/assets/:path*', destination: `${apiBase}/assets/:path*` },
      ],
    }
  },
  // For Next.js < 15.3 use experimental.turbopack.resolveAlias
  experimental: {
    turbopack: {
      resolveAlias: {
        // map virtual import used by Nextra to our mdx-components file
        'next-mdx-import-source-file': './mdx-components.ts',
      },
    },
  },
  // For Next.js >= 15.3, turbopack config moved to top-level
  turbopack: {
    resolveAlias: {
      'next-mdx-import-source-file': './mdx-components.ts',
    },
  },
};

module.exports = withNextra(nextBase);

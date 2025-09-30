const withNextra = require('nextra').default({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.jsx',
  defaultShowCopyCode: true,
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
};

module.exports = withNextra(nextBase);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  async rewrites() {
    const apiBase = process.env.API_BASE_URL || 'http://localhost:9080'
    const viteDev = process.env.VITE_DEV_SERVER || 'http://localhost:3000'
    return {
      beforeFiles: [
        // API first: proxy /api/v1 to API gateway
        {
          source: '/api/v1/:path*',
          destination: `${apiBase}/api/v1/:path*`,
        },
      ],
      // Any route not matched by Next (pages/assets) falls back to Vite dev server
      fallback: [
        {
          source: '/:path*',
          destination: `${viteDev}/:path*`,
        },
      ],
    }
  },
}

module.exports = nextConfig

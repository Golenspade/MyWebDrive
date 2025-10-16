// Nextra temporarily disabled for admin panel dev
const withNextra = (_opts) => (cfg) => cfg;

/** @type {import('next').NextConfig} */
const nextBase = {
  eslint: { ignoreDuringBuilds: true },

  // FIXME: 注释掉静态导出以支持 rewrites 和 middleware (2025-10-14)
  // 问题: output: 'export' 与 rewrites/middleware 冲突，导致无法代理API请求
  // 解决方案: 开发环境注释掉 output，生产环境根据部署方式决定是否启用
  // output: 'export',

  images: { unoptimized: true },

  // Ensure both MD/MDX (docs) and TS/TSX (app router pages) are recognized
  pageExtensions: ["md", "mdx", "tsx", "ts", "jsx", "js"],


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

  // Make root path non-404 when using Nextra v3 (Pages Router)
  // Redirect '/' -> '/docs' so users don't land on a 404 in dev/prod
  async redirects() {
    return [
      { source: '/', destination: '/admin/overview', permanent: false },
    ]
  },
};

// Temporarily disable Nextra wrapper to bring up admin panel quickly
module.exports = nextBase;

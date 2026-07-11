const path = require('node:path')

// Nextra temporarily disabled for admin panel dev
const withNextra = (_opts) => (cfg) => cfg;

/** @type {import('next').NextConfig} */
const nextBase = {
  eslint: { ignoreDuringBuilds: true },

  // 生产容器运行使用 Next standalone 运行时，避免运行时依赖 pnpm 符号链接
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),

  images: { unoptimized: true },

  // Ensure both MD/MDX (docs) and TS/TSX (app router pages) are recognized
  pageExtensions: ["md", "mdx", "tsx", "ts", "jsx", "js"],

  // Root stays on marketing landing page; no default redirect
  async redirects() {
    return []
  },
};

// Temporarily disable Nextra wrapper to bring up admin panel quickly
module.exports = nextBase;

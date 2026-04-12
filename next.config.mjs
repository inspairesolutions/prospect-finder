/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      { source: '/sites/:slug', destination: '/sites/:slug/index.html' },
      { source: '/sites/:slug/', destination: '/sites/:slug/index.html' },
    ]
  },
}

export default nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals = [...(config.externals || []), 'better-sqlite3']
    return config
  },
  // Include compliance.db in serverless function bundles
  outputFileTracingIncludes: {
    '/api/**': ['./compliance.db'],
  },
}

export default nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals = [...(config.externals || []), 'better-sqlite3']
    return config
  },
  experimental: {
    // Include compliance.db in serverless function bundles
    outputFileTracingIncludes: {
      '/api/*': ['./compliance.db'],
      '/api/obligations/*': ['./compliance.db'],
      '/api/analytics/*': ['./compliance.db'],
      '/api/alerts/*': ['./compliance.db'],
      '/api/cron/*': ['./compliance.db'],
    },
  },
}

export default nextConfig

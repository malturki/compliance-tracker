import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  webpack: (config: any) => {
    config.externals = [...(config.externals || []), 'better-sqlite3']
    return config
  },
}

export default nextConfig

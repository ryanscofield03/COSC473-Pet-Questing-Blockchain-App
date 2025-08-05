/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['rc-util'],
  experimental: {
    esmExternals: 'loose'
  },
  reactStrictMode: true,
}

module.exports = nextConfig

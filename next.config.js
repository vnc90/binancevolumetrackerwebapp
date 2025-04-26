/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Vô hiệu hóa ESLint trong quá trình build sản phẩm (production)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Vô hiệu hóa kiểm tra TypeScript trong quá trình build 
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['bin.bnbstatic.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'bin.bnbstatic.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig 
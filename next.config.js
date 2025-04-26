/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Vô hiệu hóa ESLint trong quá trình build sản phẩm (production)
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig 
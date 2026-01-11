/** @type {import('next').NextConfig} */
const nextConfig = {
  // Reduce bundle size and memory usage for Railway
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  
  // Compress images and assets
  images: {
    minimumCacheTTL: 3600, // Cache images for 1 hour
  },
  
  // Optimize build for production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Reduce server load
  poweredByHeader: false,
  
  // Enable compression
  compress: true,
}

module.exports = nextConfig
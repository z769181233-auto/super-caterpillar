/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:4310/api/:path*'
      },
      {
        source: '/health',
        destination: 'http://127.0.0.1:4310/health'
      }
    ];
  }
};

export default nextConfig;

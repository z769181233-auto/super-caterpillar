const withNextIntl = require('next-intl/plugin')();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['database', '@scu/shared-types'],
  output: 'standalone',

};

module.exports = withNextIntl(nextConfig);












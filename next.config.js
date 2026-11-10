/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    // pdf-fonts: read from disk by lib/pdf-styles.ts when rendering invoice/dobropis PDFs.
    '/**': ['./node_modules/@img/sharp-linuxmusl-x64/**/*', './src/lib/pdf-fonts/**/*'],
  },
  // Default Server Action body size limit is 1MB - too small for uploading several
  // full-resolution product photos in one submit (sharp resizes them, but only
  // after they've already been uploaded).
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["pdfkit", "docx"],
  },
  transpilePackages: ["mongodb"],
};

export default nextConfig;

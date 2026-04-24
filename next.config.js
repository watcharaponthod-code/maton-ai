/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  // Include the SQLite DB file in Vercel deployment
  outputFileTracingIncludes: {
    "/api/**": ["./data/**"],
  },
}
module.exports = nextConfig

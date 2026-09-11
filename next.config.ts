import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Não gerar AGENTS.md/CLAUDE.md automaticamente — o projeto já tem sua
  // própria documentação em README.md.
  agentRules: false,
  async headers() {
    return [
      {
        // O service worker precisa poder controlar todo o escopo do app.
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        // Dado de saúde: nada daqui deve ser indexado ou vazar por referrer.
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },
}

export default nextConfig

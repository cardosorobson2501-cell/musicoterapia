import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
import { AuthProvider } from '@/lib/auth/AuthProvider'

export const metadata: Metadata = {
  title: 'Musicoterapia',
  description: 'Registro clínico e desempenho em atividades estruturadas.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Musicoterapia',
    statusBarStyle: 'default',
  },
  // Dado de saúde não deve ser indexado em hipótese alguma.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Não travamos o zoom: ampliar o texto é recurso de acessibilidade.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fb' },
    { media: '(prefers-color-scheme: dark)', color: '#191c24' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>
        <ServiceWorkerRegistrar />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}

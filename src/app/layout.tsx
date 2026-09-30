import type { Metadata, Viewport } from 'next'
import '../index.css'
import { AppQueryProvider } from '@/lib/react-query'
import { ClientLayout } from './ClientLayout'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#4f46e5',
}

export const metadata: Metadata = {
  title: 'RAM Finance — Field & Operations',
  description: 'RAM Finance Loan Management Platform',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RAM Finance',
  },
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased select-none md:select-auto">
        <AppQueryProvider>
          <ClientLayout>{children}</ClientLayout>
        </AppQueryProvider>
      </body>
    </html>
  )
}
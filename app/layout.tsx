import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bridge Health Dashboard',
  description: 'Bridge Health Dashboard, SPCRC',
  generator: 'Nagesh and BHM Team',
}

// Initialize email scheduler on server startup
if (typeof window === 'undefined') {
  // Server-side only
  import('@/lib/email-scheduler').then((module) => {
    console.log('📧 Email scheduler initialized on server startup')
  }).catch((error) => {
    console.error('❌ Failed to initialize email scheduler:', error)
  })
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

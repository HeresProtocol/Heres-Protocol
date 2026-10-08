import type { Metadata, Viewport } from 'next'
import { Noto_Sans_KR, Oswald, Newsreader, Hanken_Grotesk } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '@/components/Navbar'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteChrome } from '@/components/SiteChrome'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sans',
  display: 'swap',
  // Used only by app chrome/admin, not the landing first paint: load on use instead of preloading on every page.
  preload: false,
})

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-display',
  display: 'swap',
  // Used only by app chrome/admin, not the landing first paint: load on use instead of preloading on every page.
  preload: false,
})

// Marketing landing typefaces (Design 04 "Elevated"): editorial serif + grotesk.
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['300', '400', '500'],
  variable: '--font-serif',
  display: 'swap',
  // Used only by app chrome/admin, not the landing first paint: load on use instead of preloading on every page.
  preload: false,
})

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-grotesk',
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#fbf9f4',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: { default: 'Heres Protocol', template: '%s — Heres Protocol' },
  description: 'Set your intents: who gets it and when. Non-custodial digital inheritance and asset continuity on Solana.',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/logo-white-icon.png', type: 'image/png' }],
  },
  openGraph: {
    title: 'Heres Protocol',
    description: 'Set your intents: who gets it and when. Non-custodial digital inheritance and asset continuity on Solana.',
    siteName: 'Heres Protocol',
    url: 'https://heresprotocol.com',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${notoSansKR.variable} ${oswald.variable} ${newsreader.variable} ${hankenGrotesk.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: 'Heres Protocol',
                url: 'https://heresprotocol.com',
              },
              {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'Heres Protocol',
                url: 'https://heresprotocol.com',
                logo: 'https://heresprotocol.com/logo-white-icon.png',
              },
            ]),
          }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          <ServiceWorkerRegister />
          <SiteChrome nav={<Navbar />} footer={<SiteFooter />}>
            {children}
          </SiteChrome>
        </Providers>
      </body>
    </html>
  )
}
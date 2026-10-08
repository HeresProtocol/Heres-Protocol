import Image from 'next/image'
import Link from 'next/link'
import '@/components/landing/landing-v2.css'

export const metadata = { title: 'Page not found' }

export default function NotFound() {
  return (
    <div className="hr-site hr-notfound">
      <main className="hr-notfound-main">
        <Link href="/" className="hr-brand" aria-label="Heres home">
          <Image src="/figma/logo.png" alt="" width={36} height={36} priority />
        </Link>
        <p className="hr-eyebrow">Page not found</p>
        <h1>This page doesn’t exist.</h1>
        <p className="hr-notfound-copy">The link may be old or mistyped. Everything you need is on the home page.</p>
        <Link href="/" className="hr-button hr-button-red">Back to Heres</Link>
      </main>
    </div>
  )
}

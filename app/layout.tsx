import type { Metadata } from 'next'
import './globals.css'
import { SyntheticBanner } from '@/components/SyntheticBanner'
import { MainNav } from '@/components/MainNav'

export const metadata: Metadata = {
  title: 'AoC Control Line',
  description: 'Automation of Compliance demonstrator — DORA Article 12',
}

// Total nav height: 52px brand row + 40px nav row + 1px border = 93px
const NAV_HEIGHT = 93

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: 'var(--color-bg)', color: 'var(--color-text-primary)', minHeight: '100vh' }}>
        {/* Fixed top navigation */}
        <MainNav />

        {/* Page content shifted below the fixed nav */}
        <div style={{ paddingTop: `${NAV_HEIGHT}px` }}>
          {/* Subtle banner sits just below the nav */}
          <SyntheticBanner />

          {/* Main content */}
          <main className="p-8 max-w-6xl mx-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

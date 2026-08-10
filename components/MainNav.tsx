'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings } from 'lucide-react'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { href: '/compliance-hub', label: 'Compliance Hub' },
  { href: '/product-hub', label: 'Product Hub' },
  { href: '/ddcr', label: 'DDCR' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/evidence-centre', label: 'Evidence Centre' },
]

export function MainNav() {
  const pathname = usePathname()

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 bg-white"
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      {/* Brand row */}
      <div
        className="flex items-center justify-between px-6"
        style={{ height: '52px', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="mr-logo-placeholder">
            <span>MR</span>
          </div>
          <span
            className="font-bold"
            style={{ color: 'var(--mr-midnight-blue)', fontSize: '0.9375rem' }}
          >
            Automation of Compliance
          </span>
        </div>
        <button
          title="Settings"
          className="p-1.5 rounded transition-colors text-[#4a5568] hover:bg-[#f4f4f4]"
          style={{ border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
        >
          <Settings size={15} />
        </button>
      </div>

      {/* Navigation links row */}
      <nav className="flex items-stretch px-6" style={{ height: '40px' }}>
        {NAV_ITEMS.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center px-4 text-sm transition-colors border-b-2',
                active
                  ? 'text-[#0f1e32] font-semibold border-[#3350b8]'
                  : 'text-[#4a5568] border-transparent hover:bg-[#d7ddf2] hover:text-[#0f1e32]'
              )}
              style={{ textDecoration: 'none' }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}

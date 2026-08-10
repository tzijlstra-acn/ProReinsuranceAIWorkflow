'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings } from 'lucide-react'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/workflow', label: 'Workflow' },
  { href: '/compliance-hub', label: 'Compliance Hub' },
  { href: '/product-hub', label: 'Product Hub' },
  { href: '/ddcr', label: 'DDCR' },
  { href: '/remediation', label: 'Remediation' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/evidence-centre', label: 'Evidence Centre' },
]

export function MainNav() {
  const pathname = usePathname()

  const handleReset = async () => {
    try {
      await fetch('/api/demo/reset', { method: 'POST' })
      window.location.href = '/'
    } catch {
      // silently ignore reset errors
    }
  }

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
        {/* Left: logo placeholder + title */}
        <div className="flex items-center gap-3">
          <div className="mr-logo-placeholder">
            <span>MR</span>
            {/* TODO: Replace with approved client logo asset when available */}
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className="font-bold"
              style={{ color: 'var(--mr-midnight-blue)', fontSize: '0.9375rem' }}
            >
              Automation of Compliance
            </span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              · IT App X
            </span>
          </div>
        </div>

        {/* Right: Board Demo chip + settings */}
        <div className="flex items-center gap-2">
          <Link
            href="/demo"
            className={clsx(
              'px-3 py-1 text-xs font-semibold rounded transition-colors',
              pathname === '/demo'
                ? 'bg-[#0f1e32] text-white'
                : 'bg-[#d7ddf2] text-[#0f1e32] hover:bg-[#c5cde8]'
            )}
            style={{ border: '1px solid var(--color-border)', textDecoration: 'none' }}
          >
            Board Demo
          </Link>
          <button
            title="Settings"
            className="p-1.5 rounded transition-colors text-[#4a5568] hover:bg-[#f4f4f4]"
            style={{ border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* Navigation links row */}
      <nav className="flex items-stretch px-6" style={{ height: '40px' }}>
        {NAV_ITEMS.map(item => {
          const active =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Reset button */}
        <button
          onClick={handleReset}
          className="px-4 text-xs border-b-2 border-transparent transition-colors text-[#8a96a8] hover:text-[#4a5568]"
          style={{ background: 'transparent', cursor: 'pointer' }}
        >
          Reset
        </button>
      </nav>
    </header>
  )
}

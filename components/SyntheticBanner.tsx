export function SyntheticBanner() {
  return (
    <div style={{
      background: 'var(--mr-light-blue)',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <div style={{
        maxWidth: '1536px',
        margin: '0 auto',
        padding: '0.3125rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        color: 'var(--mr-midnight-blue)',
        fontSize: '0.8125rem',
      }}>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.7, flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span style={{ opacity: 0.6, fontWeight: 600 }}>DEMO</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ opacity: 0.8 }}>
          Synthetic demonstration data — no client data is used · All identifiers are fictional
        </span>
      </div>
    </div>
  )
}

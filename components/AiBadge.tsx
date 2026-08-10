export function AiBadge({ small }: { small?: boolean } = {}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        fontSize: small ? '9px' : '10px',
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: '#5b21b6',
        background: 'rgba(91, 33, 182, 0.07)',
        border: '1px solid rgba(91, 33, 182, 0.22)',
        borderRadius: '3px',
        padding: small ? '0px 4px' : '1px 6px',
        verticalAlign: 'middle',
        lineHeight: '1.5',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      ✦ AI
    </span>
  )
}

export interface ProvenanceStripProps {
  pulledFrom: readonly { system: string; artifact?: string }[]
  processedBy: { system: string; simulationStatus: 'live' | 'simulated' }
  writtenTo: readonly { system: string; artifact?: string }[]
  proof: string
}

function SimBadge() {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0 4px',
        marginLeft: '4px',
        fontSize: '0.625rem',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: 'var(--mr-light-grey)',
        color: 'var(--color-text-muted)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        verticalAlign: 'middle',
      }}
    >
      Simulated
    </span>
  )
}

function LiveBadge() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '0 5px',
        marginLeft: '4px',
        fontSize: '0.625rem',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: '#e8f5ee',
        color: 'var(--color-success)',
        border: '1px solid rgba(26,124,89,0.25)',
        borderRadius: 'var(--radius)',
        verticalAlign: 'middle',
      }}
    >
      <span
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: 'var(--color-success)',
          display: 'inline-block',
        }}
      />
      Live
    </span>
  )
}

export function ProvenanceStrip({ pulledFrom, processedBy, writtenTo, proof }: ProvenanceStripProps) {
  return (
    <div
      style={{
        background: 'var(--mr-light-grey)',
        borderLeft: '3px solid var(--mr-vibrant-blue)',
        borderRadius: '0 var(--radius-md) var(--radius-md) 0',
        padding: '0.625rem 1rem',
        marginBottom: '1.25rem',
        fontSize: '0.8rem',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '1rem',
          marginBottom: '0.5rem',
        }}
      >
        {/* Pulled From */}
        <div>
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--mr-vibrant-blue)',
              marginBottom: '0.25rem',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Pulled From
          </div>
          {pulledFrom.map((item, i) => (
            <div key={i} style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              {item.system}
              {item.artifact && (
                <span style={{ color: 'var(--color-text-muted)', marginLeft: '0.25rem' }}>
                  ({item.artifact})
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Processed By */}
        <div>
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--mr-vibrant-blue)',
              marginBottom: '0.25rem',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Processed By
          </div>
          <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            {processedBy.system}
            {processedBy.simulationStatus === 'simulated' ? <SimBadge /> : <LiveBadge />}
          </div>
        </div>

        {/* Written To */}
        <div>
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--mr-vibrant-blue)',
              marginBottom: '0.25rem',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Written To
          </div>
          {writtenTo.map((item, i) => (
            <div key={i} style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              {item.system}
              {item.artifact && (
                <span style={{ color: 'var(--color-text-muted)', marginLeft: '0.25rem' }}>
                  ({item.artifact})
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Proof row */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          paddingTop: '0.375rem',
          color: 'var(--color-text-muted)',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span
          style={{
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-secondary)',
            marginRight: '0.5rem',
            fontSize: '0.65rem',
          }}
        >
          Proof:
        </span>
        {proof}
      </div>
    </div>
  )
}

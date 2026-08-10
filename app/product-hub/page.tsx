'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  type: string
  criticality: string
  owner: string | null
  status: string
  description: string | null
}

interface InboxItem {
  controlChange: { id: string; requirementId: string }
  affectedProducts: Array<{ product: { id: string }; stage: string }>
}

const CRIT: Record<string, { color: string; bg: string }> = {
  CRITICAL: { color: '#E4002B', bg: 'rgba(228,0,43,0.08)' },
  HIGH:     { color: '#B45309', bg: 'rgba(180,83,9,0.08)' },
  MEDIUM:   { color: '#003781', bg: 'rgba(0,55,129,0.08)' },
  LOW:      { color: '#4A5568', bg: 'rgba(74,85,104,0.08)' },
}

export default function ProductHubPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [pendingByProduct, setPendingByProduct] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/product-hub/products').then(r => r.json()),
      fetch('/api/product-hub/inbox').then(r => r.json()),
    ]).then(([prods, inbox]: [Product[], InboxItem[]]) => {
      setProducts(Array.isArray(prods) ? prods : [])
      // count pending changes per product
      const counts: Record<string, number> = {}
      for (const item of (Array.isArray(inbox) ? inbox : [])) {
        for (const ap of item.affectedProducts) {
          if (ap.stage !== 'FULFILLED') {
            counts[ap.product.id] = (counts[ap.product.id] ?? 0) + 1
          }
        }
      }
      setPendingByProduct(counts)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 24px 48px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: '#003781' }}>Product Hub</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#9AA3AF' }}>Loading products…</p>
      </div>
    )
  }

  const activeProducts = products.filter(p => p.status !== 'DECOMMISSIONED')

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 24px 48px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: '#003781' }}>Product Hub</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#9AA3AF' }}>
          {activeProducts.length} products · click to see compliance status and apply AI-generated changes
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {activeProducts.map(p => {
          const crit = CRIT[p.criticality] ?? CRIT.LOW
          const pending = pendingByProduct[p.id] ?? 0

          return (
            <Link
              key={p.id}
              href={`/product-hub/products/${p.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                background: '#fff', border: `1px solid ${pending > 0 ? 'rgba(180,83,9,0.3)' : '#E8EDF4'}`,
                borderRadius: 10, cursor: 'pointer',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: '0 1px 3px rgba(0,56,129,0.05)',
              }}>
                {/* Status dot */}
                <span style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: pending > 0 ? '#B45309' : '#0A7C59',
                }} />

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#003781' }}>{p.name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: crit.color,
                      background: crit.bg, borderRadius: 4, padding: '2px 6px',
                    }}>{p.criticality}</span>
                    <span style={{ fontSize: 11, color: '#9AA3AF' }}>
                      {p.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {p.owner && (
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9AA3AF' }}>Owner: {p.owner}</p>
                  )}
                </div>

                {/* Pending changes badge */}
                {pending > 0 ? (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: '#B45309',
                    background: '#FEF3C7', border: '1px solid rgba(180,83,9,0.25)',
                    borderRadius: 10, padding: '3px 10px', flexShrink: 0, whiteSpace: 'nowrap',
                  }}>
                    {pending} change{pending !== 1 ? 's' : ''} pending
                  </span>
                ) : (
                  <span style={{
                    fontSize: 11, color: '#9AA3AF', flexShrink: 0,
                  }}>Up to date</span>
                )}

                <span style={{ fontSize: 13, color: '#C8D0DB', flexShrink: 0 }}>›</span>
              </div>
            </Link>
          )
        })}

        {activeProducts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 24px', color: '#9AA3AF' }}>
            <p style={{ fontSize: 14 }}>No products found. Seed the database to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}

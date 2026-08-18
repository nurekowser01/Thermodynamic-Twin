// hooks/useGTApi.js
// Centralised API calls to the FastAPI backend

const BASE = import.meta.env.VITE_API_BASE || '/api'

export async function fetchStaticData() {
  const r = await fetch(`${BASE}/static-data`)
  if (!r.ok) throw new Error('Failed to fetch static data')
  return r.json()
}

export async function solveMode1(payload) {
  const r = await fetch(`${BASE}/solve/mode1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail || 'Mode 1 solve failed')
  }
  return r.json()
}

export async function solveMode2(payload) {
  const r = await fetch(`${BASE}/solve/mode2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail || 'Mode 2 solve failed')
  }
  return r.json()
}

export function fmt(v, dp = 2, fallback = '—') {
  if (v === null || v === undefined || isNaN(v)) return fallback
  return Number(v).toFixed(dp)
}

export function fmtDelta(v, dp = 2) {
  if (v === null || v === undefined || isNaN(v)) return { text: '—', cls: 'neu' }
  const text = (v >= 0 ? '+' : '') + Number(v).toFixed(dp)
  const cls  = Math.abs(v) < 0.01 ? 'neu' : v > 0 ? 'pos' : 'neg'
  return { text, cls }
}

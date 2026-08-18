const BASE = import.meta.env.VITE_LLM_BASE || '/api/llm'

export async function checkAdvisorHealth() {
  const r = await fetch(`${BASE}/health`)
  if (!r.ok) throw new Error('Advisor health check failed')
  return r.json()
}

export async function sendMessage({ message, messages = [], context, signal }) {
  const r = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, messages, context }),
    signal,
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail || 'Chat request failed')
  }
  return r.json()
}

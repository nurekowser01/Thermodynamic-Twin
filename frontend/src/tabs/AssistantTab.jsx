// tabs/AssistantTab.jsx
import { useState, useEffect, useRef } from 'react'
import { checkAdvisorHealth, sendMessage } from '../hooks/useAdvisorApi'

const GT_KEYS = [
  'P_GT_actual_MW', 'P_GT_expected_MW', 'P_GTM_design_MW',
  'HR_LHV_kJ_kWh', 'HR_HHV_kJ_kWh', 'eta_LHV_pct', 'eta_HHV_pct',
  'delta_P_MW', 'delta_P_pct', 'm_fuel_actual', 'm_exh_estimated_kgs',
  'T5_TII_oem_C', 'T4_TIT_C', 'P_eff_hPa', 'P_compressor_MW',
]

function pick(obj, keys) {
  if (!obj) return null
  const out = {}
  for (const k of keys) {
    if (obj[k] != null) out[k] = obj[k]
  }
  return Object.keys(out).length ? out : null
}

function slimResult(result) {
  if (!result) return null
  const gt = result.gt || {}
  const balance = result.balance || {}
  const slimGt = pick(gt, GT_KEYS) || {}
  const comp = pick(gt.compressor, ['T1_C', 'T3_C', 'P3_hPa', 'eta_c_pct'])
  if (comp) slimGt.compressor = comp
  const net = pick(balance.net_output, ['P_net_MW', 'P_GT_MW', 'P_aux_total_MW'])
  const hb = pick(balance.heat_balance, ['Q_fuel_MW', 'Q_exhaust_MW', 'eta_th_pct'])
  const slimBalance = {}
  if (net) slimBalance.net_output = net
  if (hb) slimBalance.heat_balance = hb
  const out = {}
  if (Object.keys(slimGt).length) out.gt = slimGt
  if (Object.keys(slimBalance).length) out.balance = slimBalance
  return Object.keys(out).length ? out : null
}

function buildContext({ mode, fuel, inputs, result }) {
  const parsedInputs = {}
  if (inputs) {
    for (const [k, v] of Object.entries(inputs)) {
      const n = parseFloat(v)
      parsedInputs[k] = Number.isNaN(n) ? v : n
    }
  }
  return {
    mode,
    fuel,
    inputs: parsedInputs,
    result: slimResult(result),
  }
}

function AnalysingIndicator() {
  return (
    <div className="advisor-spinner" role="status" aria-live="polite">
      <span className="advisor-spinner__icon" aria-hidden="true" />
      <span>Analysing…</span>
    </div>
  )
}

export default function AssistantTab({ mode, fuel, inputs, result }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [healthLine, setHealthLine] = useState('Checking advisor…')
  const bottomRef = useRef(null)

  useEffect(() => {
    checkAdvisorHealth()
      .then(h => {
        if (h.status === 'healthy') {
          setHealthLine(`Advisor: healthy (${h.model})`)
        } else if (!h.ollama_reachable) {
          setHealthLine('Advisor: degraded — Ollama not reachable')
        } else if (!h.model_ready) {
          setHealthLine(`Advisor: degraded — run ollama pull ${h.model}`)
        } else {
          setHealthLine('Advisor: degraded')
        }
      })
      .catch(() => setHealthLine('Advisor: unavailable'))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setError(null)
    setLoading(true)

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { role: 'user', content: text }])

    try {
      const res = await sendMessage({
        message: text,
        messages: history,
        context: buildContext({ mode, fuel, inputs, result }),
      })
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{healthLine}</div>
      {!result && (
        <div style={{ fontSize: 11, color: 'var(--orange)' }}>
          Run Calculate first for data-grounded answers.
        </div>
      )}

      <div style={{
        flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10,
        padding: 12, background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
      }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text2)', fontSize: 12 }}>
            Ask about efficiency, heat rate, filter maintenance, or operating conditions.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            padding: '8px 12px',
            borderRadius: 'var(--r)',
            background: m.role === 'user' ? 'var(--accent2)' : 'var(--bg3)',
            border: `1px solid ${m.role === 'user' ? 'var(--accent)' : 'var(--border)'}`,
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}>
            {m.content}
          </div>
        ))}
        {loading && <AnalysingIndicator />}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask the advisor…"
          rows={2}
          disabled={loading}
          style={{
            flex: 1, resize: 'none', padding: '8px 10px',
            background: 'var(--input-bg)', border: '1px solid var(--input-border)',
            borderRadius: 'var(--r)', color: 'var(--text0)', fontFamily: 'var(--font)', fontSize: 12,
          }}
        />
        <button
          className={`calc-btn${loading ? ' loading' : ''}`}
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{ alignSelf: 'flex-end', minWidth: 88 }}
        >
          {loading ? 'Analysing…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

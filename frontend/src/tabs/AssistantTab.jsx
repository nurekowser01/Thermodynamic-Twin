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

const ANALYSIS_TIMEOUT_MS = 120_000

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function AnalysingIndicator({ startTime, timeoutMs = ANALYSIS_TIMEOUT_MS }) {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    if (!startTime) return

    const tick = () => {
      const elapsed = Date.now() - startTime
      setPct(Math.min(100, Math.round((elapsed / timeoutMs) * 100)))
    }

    tick()
    const id = setInterval(tick, 150)
    return () => clearInterval(id)
  }, [startTime, timeoutMs])

  const atLimit = pct >= 100

  return (
    <div
      className="advisor-progress"
      role="progressbar"
      aria-live="polite"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Analysing, ${pct} percent`}
    >
      <div className="advisor-progress__header">
        <span className="advisor-progress__label">Analysing…</span>
        <span className="advisor-progress__pct">{pct}%</span>
      </div>
      <div className="advisor-progress__track">
        <div
          className={`advisor-progress__fill${atLimit ? ' advisor-progress__fill--pulse' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {atLimit && (
        <div className="advisor-progress__note">
          Still working — large models may need more time.
        </div>
      )}
    </div>
  )
}

export default function AssistantTab({ mode, fuel, inputs, result }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [analysisStart, setAnalysisStart] = useState(null)
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
    setAnalysisStart(Date.now())
    setLoading(true)

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    const sentAt = Date.now()
    setMessages(prev => [...prev, { role: 'user', content: text, ts: sentAt }])

    try {
      const res = await sendMessage({
        message: text,
        messages: history,
        context: buildContext({ mode, fuel, inputs, result }),
      })
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply, ts: Date.now() }])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      setAnalysisStart(null)
    }
  }

  const onKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="assistant-tab">
      <div className="assistant-meta">{healthLine}</div>
      {!result && (
        <div className="assistant-hint">
          Run Calculate first for data-grounded answers.
        </div>
      )}

      <div className="assistant-messages">
        {messages.length === 0 && (
          <div className="assistant-empty">
            Ask about efficiency, heat rate, filter maintenance, or operating conditions.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={m.ts ?? i}
            className={`assistant-bubble assistant-bubble--${m.role}`}
          >
            <div className="assistant-bubble__time">{formatTime(m.ts)}</div>
            <div className="assistant-bubble__text">{m.content}</div>
          </div>
        ))}
        {loading && analysisStart && (
          <AnalysingIndicator startTime={analysisStart} />
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="assistant-error">{error}</div>}

      <div className="assistant-input-row">
        <textarea
          className="assistant-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask the advisor…"
          rows={2}
          disabled={loading}
        />
        <button
          className={`calc-btn assistant-send${loading ? ' loading' : ''}`}
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          {loading ? 'Analysing…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

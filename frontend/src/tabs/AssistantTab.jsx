// tabs/AssistantTab.jsx
import { useState, useEffect, useRef } from 'react'
import { checkAdvisorHealth, sendMessage } from '../hooks/useAdvisorApi'

const GT_KEYS = [
  'P_GT_actual_MW', 'P_GT_expected_MW', 'P_GTM_design_MW',
  'HR_LHV_kJ_kWh', 'HR_HHV_kJ_kWh', 'eta_LHV_pct', 'eta_HHV_pct',
  'delta_P_MW', 'delta_P_pct', 'm_fuel_actual', 'm_exh_estimated_kgs',
  'T5_TII_oem_C', 'T4_TIT_C', 'P_eff_hPa', 'P_compressor_MW',
]

const LOADING_PHASES = [
  'Analysing plant data…',
  'Checking operating conditions…',
  'Calculating thermodynamics…',
  'Reviewing heat rate and efficiency…',
  'Evaluating compressor performance…',
  'Preparing response…',
]

const PHASE_INTERVAL_MS = 3000

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

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDurationSec(sec) {
  if (sec < 10) return `${sec.toFixed(1)}s`
  return `${Math.round(sec)}s`
}

function formatMessageMeta(message) {
  const time = formatTime(message.ts)
  if (message.role === 'assistant' && message.durationSec != null) {
    return `${time} · ${formatDurationSec(message.durationSec)}`
  }
  return time
}

function AnalysingIndicator() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const id = setInterval(
      () => setPhase(p => (p + 1) % LOADING_PHASES.length),
      PHASE_INTERVAL_MS,
    )
    return () => clearInterval(id)
  }, [])

  return (
    <div className="advisor-status" role="status" aria-live="polite">
      <span className="advisor-status__spinner" aria-hidden="true" />
      <span className="advisor-status__text" key={phase}>
        {LOADING_PHASES[phase]}
      </span>
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
  const abortRef = useRef(null)

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

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleCancel = () => {
    abortRef.current?.abort()
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setError(null)
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    const sentAt = Date.now()
    setMessages(prev => [...prev, { role: 'user', content: text, ts: sentAt }])

    const requestStart = Date.now()

    try {
      const res = await sendMessage({
        message: text,
        messages: history,
        context: buildContext({ mode, fuel, inputs, result }),
        signal: controller.signal,
      })
      const durationSec = (Date.now() - requestStart) / 1000
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          ts: Date.now(),
          durationSec,
        },
      ])
    } catch (e) {
      if (e.name === 'AbortError') {
        setError('Request cancelled.')
      } else {
        setError(e.message)
      }
    } finally {
      abortRef.current = null
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
    <div className="assistant-tab">
      <div className="assistant-meta">{healthLine}</div>
      {!result && (
        <div className="assistant-hint">
          Run Calculate first for data-grounded answers.
        </div>
      )}

      <div className="assistant-messages">
        {messages.length === 0 && !loading && (
          <div className="assistant-empty">
            Ask about efficiency, heat rate, filter maintenance, or operating conditions.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={m.ts ?? i}
            className={`assistant-bubble assistant-bubble--${m.role}`}
          >
            <div className="assistant-bubble__time">{formatMessageMeta(m)}</div>
            <div className="assistant-bubble__text">{m.content}</div>
          </div>
        ))}
        {loading && <AnalysingIndicator />}
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
        {loading ? (
          <button
            type="button"
            className="calc-btn assistant-cancel"
            onClick={handleCancel}
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            className="calc-btn assistant-send"
            onClick={handleSend}
            disabled={!input.trim()}
          >
            Send
          </button>
        )}
      </div>
    </div>
  )
}

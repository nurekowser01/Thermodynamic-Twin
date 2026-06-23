// tabs/AssistantTab.jsx
import { useState, useEffect, useRef } from 'react'
import { checkAdvisorHealth, sendMessage } from '../hooks/useAdvisorApi'

function buildContext({ mode, fuel, inputs, result, staticData }) {
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
    result: result ? { gt: result.gt, balance: result.balance, thermo: result.thermo } : null,
    static_data: staticData ? { design_point: staticData.design_point } : null,
  }
}

export default function AssistantTab({ mode, fuel, inputs, result, staticData }) {
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
        context: buildContext({ mode, fuel, inputs, result, staticData }),
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
        {loading && (
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Sending…</div>
        )}
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
          className="calc-btn"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{ alignSelf: 'flex-end', minWidth: 72 }}
        >
          {loading ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

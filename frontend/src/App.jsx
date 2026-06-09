// App.jsx
import { useState, useEffect, useCallback } from 'react'
import { fetchStaticData, solveMode1, solveMode2 } from './hooks/useGTApi'
import CanvasTab       from './tabs/CanvasTab'
import PerformanceTab  from './tabs/PerformanceTab'
import ThermodynamicsTab from './tabs/ThermodynamicsTab'
import EnergyTab       from './tabs/EnergyTab'
import FilterTab       from './tabs/FilterTab'

const TABS = [
  { id: 'canvas',  label: 'P&ID Canvas',    icon: '⬡' },
  { id: 'perf',    label: 'Performance',    icon: '📈' },
  { id: 'thermo',  label: 'Thermodynamics', icon: '⚗' },
  { id: 'energy',  label: 'Energy Balance', icon: '⚡' },
  { id: 'filter',  label: 'Filter ΔP',     icon: '🔽' },
]

const DEFAULT_INPUTS = {
  // Ambient
  T_CI:          '35.0',
  P_amb:         '1013.0',
  RH_pct:        '97.88',
  // Mode 1
  P_GT_actual_MW: '142.2',
  m_fuel_actual:  '8.6',
  // Mode 2
  m_fuel_kgs:    '8.6',
  LHV:           '48982',
  // Filter hours
  hours_coalescer: '0',
  hours_prefilter:  '0',
  hours_finefilter: '0',
  // GBC
  n_gbc_units:   '1',
  P_rms_bar:     '9.5',
}

export default function App() {
  const [tab,        setTab]        = useState('canvas')
  const [mode,       setMode]       = useState(1)          // 1 or 2
  const [fuel,       setFuel]       = useState('gas')
  const [inputs,     setInputs]     = useState(DEFAULT_INPUTS)
  const [result,     setResult]     = useState(null)
  const [staticData, setStaticData] = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [apiStatus,  setApiStatus]  = useState('connecting') // 'ok' | 'error' | 'connecting'

  // Load static data on mount
  useEffect(() => {
    fetchStaticData()
      .then(d => { setStaticData(d); setApiStatus('ok') })
      .catch(() => setApiStatus('error'))
  }, [])

  const handleInputChange = useCallback((key, value) => {
    setInputs(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSolve = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const base = {
        T_CI:             parseFloat(inputs.T_CI),
        P_amb:            parseFloat(inputs.P_amb),
        RH_pct:           parseFloat(inputs.RH_pct),
        fuel,
        hours_coalescer:  parseFloat(inputs.hours_coalescer) || 0,
        hours_prefilter:  parseFloat(inputs.hours_prefilter)  || 0,
        hours_finefilter: parseFloat(inputs.hours_finefilter) || 0,
        n_gbc_units:      parseInt(inputs.n_gbc_units)        || 1,
        P_rms_bar:        parseFloat(inputs.P_rms_bar)       || 9.5,
      }
      let res
      if (mode === 1) {
        res = await solveMode1({
          ...base,
          P_GT_actual_MW: parseFloat(inputs.P_GT_actual_MW),
          m_fuel_actual:  inputs.m_fuel_actual ? parseFloat(inputs.m_fuel_actual) : undefined,
        })
      } else {
        res = await solveMode2({
          ...base,
          m_fuel_kgs: parseFloat(inputs.m_fuel_kgs),
          LHV:        inputs.LHV ? parseFloat(inputs.LHV) : undefined,
        })
      }
      setResult({ ...res, _mode: mode })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [inputs, mode, fuel])

  // Keyboard shortcut: Enter to calculate
  useEffect(() => {
    const handler = e => { if (e.key === 'Enter' && e.ctrlKey) handleSolve() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSolve])

  return (
    <div className="app-shell">
      {/* ── Title bar ── */}
      <div className="title-bar">
        <span className="plant-name">Sirajganj 150 MW Peaking Power Plant</span>
        <span className="gt-tag">SGT5-2000E · S/N 800849</span>
        <span className="gt-tag" style={{ color: 'var(--text2)' }}>GT Digital Twin v1.0</span>
        {error && (
          <span style={{ fontSize: 11, color: 'var(--red)', marginLeft: 8 }}>⚠ {error}</span>
        )}
        <span className="status-dot" style={{
          background: apiStatus === 'ok' ? 'var(--green)' : apiStatus === 'error' ? 'var(--red)' : 'var(--yellow)',
          boxShadow: `0 0 6px ${apiStatus === 'ok' ? 'var(--green)' : apiStatus === 'error' ? 'var(--red)' : 'var(--yellow)'}`,
        }} />
        <span className="status-label">
          {apiStatus === 'ok' ? 'API connected' : apiStatus === 'error' ? 'API offline' : 'Connecting…'}
        </span>
      </div>

      {/* ── Tab bar ── */}
      <div className="tab-bar">
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}

        {/* Mode + fuel toggles in tab bar */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="mode-toggle">
            <button className={`mode-btn ${mode === 1 ? 'active' : ''}`} onClick={() => setMode(1)}>
              Mode 1 — Output→HR
            </button>
            <button className={`mode-btn ${mode === 2 ? 'active' : ''}`} onClick={() => setMode(2)}>
              Mode 2 — Fuel→Output
            </button>
          </div>
          <div className="fuel-toggle">
            <button className={`fuel-btn ${fuel === 'gas' ? 'active' : ''}`} onClick={() => setFuel('gas')}>
              Gas
            </button>
            <button className={`fuel-btn ${fuel === 'oil' ? 'active' : ''}`} onClick={() => setFuel('oil')}>
              Oil
            </button>
          </div>
          <button className={`calc-btn ${loading ? 'loading' : ''}`}
            onClick={handleSolve} disabled={loading || apiStatus !== 'ok'}>
            {loading ? 'Calculating…' : '▶  Calculate'}
          </button>
          <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 2 }}>Ctrl+Enter</span>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="tab-content">
        {tab === 'canvas' && (
          <CanvasTab
            mode={mode}
            fuel={fuel}
            inputs={inputs}
            onInputChange={handleInputChange}
            result={result}
            loading={loading}
          />
        )}
        {tab === 'perf' && (
          <PerformanceTab
            staticData={staticData}
            result={result}
            inputs={inputs}
            fuel={fuel}
          />
        )}
        {tab === 'thermo' && (
          <ThermodynamicsTab result={result} />
        )}
        {tab === 'energy' && (
          <EnergyTab result={result} />
        )}
        {tab === 'filter' && (
          <FilterTab
            staticData={staticData}
            inputs={inputs}
            onInputChange={handleInputChange}
          />
        )}
      </div>
    </div>
  )
}

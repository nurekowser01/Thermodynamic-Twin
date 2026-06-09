// tabs/PerformanceTab.jsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceDot, ReferenceLine,
} from 'recharts'
import { fmt, fmtDelta } from '../hooks/useGTApi'

const C = {
  gas:    '#4a7fe8',
  oil:    '#e8883a',
  tii:    '#8b6fe8',
  design: '#2db87a',
  e82:    '#7a6fd4',
  e84:    '#6b8fd4',
  e86:    '#4a7fe8',
  e875:   '#2db87a',
  e89:    '#e8883a',
  e91:    '#e8c43a',
}

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 4, padding: '8px 12px', fontSize: 11 }}>
      <div style={{ color: 'var(--text2)', marginBottom: 4 }}>T_CI = {label} °C</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {fmt(p.value, 2)} {p.unit || ''}
        </div>
      ))}
    </div>
  )
}

export default function PerformanceTab({ staticData, result, inputs, fuel }) {
  const oem     = staticData?.oem_curves
  const compEff = staticData?.comp_eff_curves
  const gt      = result?.gt
  const hb      = result?.balance?.heat_balance

  // OEM curve data — merge gas + oil by T_CI
  const oemData = oem
    ? oem.gas.map((g, i) => ({
        T_CI:     g.T_CI,
        P_gas:    g.P_GT,
        T_gas:    g.T_TII,
        P_oil:    oem.oil[i]?.P_GT,
        T_oil:    oem.oil[i]?.T_TII,
      }))
    : []

  // Compressor efficiency curves
  const etas = compEff ? compEff.map(e => e.eta) : []
  const compT3Data = compEff
    ? compEff[0].points.map((pt, i) => {
        const row = { T_CI: pt.T_CI }
        compEff.forEach(e => { row[`eta_${e.eta}`] = e.points[i]?.T3 })
        return row
      })
    : []
  const compWcData = compEff
    ? compEff[0].points.map((pt, i) => {
        const row = { T_CI: pt.T_CI }
        compEff.forEach(e => { row[`eta_${e.eta}`] = e.points[i]?.Wc })
        return row
      })
    : []

  const currentTCI = gt?.compressor?.T1_C ?? parseFloat(inputs?.T_CI ?? 35)
  const oem_P = oem ? (fuel === 'gas' ? oem.gas.find(p => p.T_CI === 35)?.P_GT : oem.oil.find(p => p.T_CI === 35)?.P_GT) : null
  const deltaP = gt ? fmtDelta(gt.delta_P_MW, 2) : null
  const deltaHR = gt?.delta_HR_pct != null ? fmtDelta(gt.delta_HR_pct, 2) : null

  const etaColors = { 0.82: C.e82, 0.84: C.e84, 0.86: C.e86, 0.875: C.e875, 0.89: C.e89, 0.91: C.e91 }
  const etaWidths = { 0.82: 1, 0.84: 1, 0.86: 1.2, 0.875: 2, 0.89: 1, 0.91: 1 }

  return (
    <div className="chart-tab">
      <div className="chart-tab-header">
        <h2>Performance — OEM Curves & Compressor Map</h2>
        <p>SGT5-2000E · S/N 800849 · ISO ref: 1013 hPa, 98% RH, ΔpC=ΔpE=8 hPa</p>
      </div>
      <div className="chart-body">

        {/* KPI strip */}
        <div className="kpi-strip kpi-strip-5">
          {[
            { label: 'OEM Ref P_GT', val: gt ? fmt(gt.P_GT_oem_MW, 1) : '—', unit: 'MW' },
            { label: 'P_GTM design', val: gt ? fmt(gt.P_GTM_design_MW, 2) : '—', unit: 'MW' },
            { label: 'ΔP vs OEM', val: deltaP?.text ?? '—', unit: 'MW', cls: deltaP?.cls },
            { label: 'η LHV', val: hb ? fmt(hb.eta_LHV_pct, 3) : '—', unit: '%' },
            { label: 'ΔHR vs design', val: deltaHR?.text ?? '—', unit: '%', cls: deltaHR?.cls },
          ].map((k, i) => (
            <div key={i} className="kpi-card">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-val" style={{ color: k.cls === 'pos' ? 'var(--green)' : k.cls === 'neg' ? 'var(--red)' : 'var(--text0)' }}>
                {k.val}<span className="kpi-unit"> {k.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* OEM Curves row */}
        <div className="chart-row chart-row-2">
          <div className="chart-card">
            <div className="chart-card-title">GT Output vs T_CI (OEM)</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={oemData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="T_CI" stroke="var(--text2)" tick={{ fontSize: 11 }} label={{ value: 'T_CI (°C)', position: 'insideBottom', offset: -2, fill: 'var(--text2)', fontSize: 11 }} />
                <YAxis stroke="var(--text2)" tick={{ fontSize: 11 }} domain={[130, 180]} label={{ value: 'P_GT (MW)', angle: -90, position: 'insideLeft', fill: 'var(--text2)', fontSize: 11 }} />
                <Tooltip content={<TT />} />
                <Line type="monotone" dataKey="P_gas" stroke={C.gas} strokeWidth={2} dot={false} name="Gas" unit=" MW" />
                <Line type="monotone" dataKey="P_oil" stroke={C.oil} strokeWidth={2} dot={false} name="Oil" unit=" MW" />
                {gt && <ReferenceDot x={Math.round(currentTCI / 5) * 5} y={gt.P_GT_oem_MW} r={5} fill={C.design} stroke="#fff" strokeWidth={1} />}
                {gt && <ReferenceLine x={currentTCI} stroke={C.design} strokeDasharray="4 3" strokeWidth={1} />}
              </LineChart>
            </ResponsiveContainer>
            <div className="legend" style={{ marginTop: 8 }}>
              <span className="legend-item"><span className="legend-line" style={{ background: C.gas }} />Natural Gas</span>
              <span className="legend-item"><span className="legend-line" style={{ background: C.oil }} />Fuel Oil</span>
              {gt && <span className="legend-item"><span className="legend-line" style={{ background: C.design }} />Operating point</span>}
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-card-title">ϑTII (Exhaust Temp) vs T_CI (OEM)</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={oemData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="T_CI" stroke="var(--text2)" tick={{ fontSize: 11 }} label={{ value: 'T_CI (°C)', position: 'insideBottom', offset: -2, fill: 'var(--text2)', fontSize: 11 }} />
                <YAxis stroke="var(--text2)" tick={{ fontSize: 11 }} domain={[535, 590]} label={{ value: 'ϑTII (°C)', angle: -90, position: 'insideLeft', fill: 'var(--text2)', fontSize: 11 }} />
                <Tooltip content={<TT />} />
                <Line type="monotone" dataKey="T_gas" stroke={C.gas} strokeWidth={2} dot={false} name="Gas ϑTII" unit=" °C" />
                <Line type="monotone" dataKey="T_oil" stroke={C.oil} strokeWidth={2} dot={false} name="Oil ϑTII" unit=" °C" />
                {gt && <ReferenceDot x={Math.round(currentTCI / 5) * 5} y={gt.T5_TII_oem_C} r={5} fill={C.design} stroke="#fff" strokeWidth={1} />}
              </LineChart>
            </ResponsiveContainer>
            <div className="legend" style={{ marginTop: 8 }}>
              <span className="legend-item"><span className="legend-line" style={{ background: C.gas }} />Natural Gas</span>
              <span className="legend-item"><span className="legend-line" style={{ background: C.oil }} />Fuel Oil</span>
            </div>
          </div>
        </div>

        {/* Compressor efficiency map */}
        <div className="chart-row chart-row-2">
          <div className="chart-card">
            <div className="chart-card-title">Compressor Outlet Temp T3 vs η_c,is</div>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={compT3Data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="T_CI" stroke="var(--text2)" tick={{ fontSize: 11 }} label={{ value: 'T_CI (°C)', position: 'insideBottom', offset: -2, fill: 'var(--text2)', fontSize: 11 }} />
                <YAxis stroke="var(--text2)" tick={{ fontSize: 11 }} domain={[300, 450]} label={{ value: 'T3 (°C)', angle: -90, position: 'insideLeft', fill: 'var(--text2)', fontSize: 11 }} />
                <Tooltip content={<TT />} />
                {etas.map(e => (
                  <Line key={e} type="monotone" dataKey={`eta_${e}`} stroke={etaColors[e]}
                    strokeWidth={etaWidths[e]} dot={false} name={`η=${(e * 100).toFixed(1)}%`} unit=" °C" />
                ))}
                {gt && <ReferenceDot x={Math.round(currentTCI / 5) * 5} y={gt.compressor?.T3_C} r={5} fill={C.design} stroke="#fff" strokeWidth={1} />}
                {gt && <ReferenceLine x={currentTCI} stroke={C.design} strokeDasharray="4 3" strokeWidth={1} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-card">
            <div className="chart-card-title">Specific Compressor Work W_c vs η_c,is</div>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={compWcData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="T_CI" stroke="var(--text2)" tick={{ fontSize: 11 }} label={{ value: 'T_CI (°C)', position: 'insideBottom', offset: -2, fill: 'var(--text2)', fontSize: 11 }} />
                <YAxis stroke="var(--text2)" tick={{ fontSize: 11 }} domain={[300, 410]} label={{ value: 'W_c (kJ/kg)', angle: -90, position: 'insideLeft', fill: 'var(--text2)', fontSize: 11 }} />
                <Tooltip content={<TT />} />
                {etas.map(e => (
                  <Line key={e} type="monotone" dataKey={`eta_${e}`} stroke={etaColors[e]}
                    strokeWidth={etaWidths[e]} dot={false} name={`η=${(e * 100).toFixed(1)}%`} unit=" kJ/kg" />
                ))}
                {gt && <ReferenceLine x={currentTCI} stroke={C.design} strokeDasharray="4 3" strokeWidth={1} />}
              </LineChart>
            </ResponsiveContainer>
            <div className="legend" style={{ marginTop: 6, fontSize: 11 }}>
              {etas.map(e => (
                <span key={e} className="legend-item">
                  <span className="legend-line" style={{ background: etaColors[e], height: etaWidths[e] * 1.2 }} />
                  {e === 0.875 ? `η=${(e*100).toFixed(1)}% ← design` : `η=${(e*100).toFixed(1)}%`}
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

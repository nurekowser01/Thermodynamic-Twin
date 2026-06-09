// tabs/FilterTab.jsx
import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot,
} from 'recharts'
import { fmt } from '../hooks/useGTApi'

const STAGES = {
  coalescer: { color: '#4a7fe8', label: 'Coalescer',   life: 4000,  dp0: 0.65, dpF: 4.50 },
  prefilter:  { color: '#2db87a', label: 'Pre-filter',  life: 5000,  dp0: 0.65, dpF: 2.50 },
  finefilter: { color: '#e85050', label: 'Fine filter', life: 10000, dp0: 0.95, dpF: 6.00 },
}

function dpAt(stage, hours) {
  const s = STAGES[stage]
  return s.dp0 + (s.dpF - s.dp0) * Math.min(hours / s.life, 1)
}

export default function FilterTab({ staticData, inputs, onInputChange }) {
  const filterCurves = staticData?.filter_curves

  // Build chart data from static curves
  const chartData = filterCurves
    ? filterCurves.coalescer.hours.map((h, i) => ({
        hours: h,
        coalescer: filterCurves.coalescer.dp_hPa[i],
        prefilter:  filterCurves.prefilter.dp_hPa[i],
        finefilter: filterCurves.finefilter.dp_hPa[i],
        total: filterCurves.coalescer.dp_hPa[i]
               + filterCurves.prefilter.dp_hPa[i]
               + filterCurves.finefilter.dp_hPa[i],
      }))
    : []

  const hCoal = parseFloat(inputs?.hours_coalescer || 0)
  const hPre  = parseFloat(inputs?.hours_prefilter  || 0)
  const hFine = parseFloat(inputs?.hours_finefilter || 0)

  const dpCoal  = dpAt('coalescer', hCoal)
  const dpPre   = dpAt('prefilter',  hPre)
  const dpFine  = dpAt('finefilter', hFine)
  const dpTotal = dpCoal + dpPre + dpFine

  const ISO_REF = 8.0

  const TT = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 4, padding: '8px 12px', fontSize: 11 }}>
        <div style={{ color: 'var(--text2)', marginBottom: 4 }}>{Math.round(label).toLocaleString()} hr</div>
        {payload.filter(p => p.dataKey !== 'total').map((p, i) => (
          <div key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value, 2)} hPa</div>
        ))}
        <div style={{ color: '#888', marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
          Total: {fmt(payload.find(p=>p.dataKey==='total')?.value, 2)} hPa
        </div>
      </div>
    )
  }

  return (
    <div className="chart-tab">
      <div className="chart-tab-header">
        <h2>Inlet Filter Train — ΔP Degradation</h2>
        <p>FAIST filter train · ISO reference ΔP = 8.0 hPa · Linear degradation model</p>
      </div>
      <div className="chart-body">

        {/* Current operating hours inputs */}
        <div className="filter-inputs">
          {Object.entries(STAGES).map(([key, s]) => {
            const hrs = parseFloat(inputs?.[`hours_${key}`] || 0)
            const dp  = dpAt(key, hrs)
            const pct = Math.min(hrs / s.life * 100, 100)
            return (
              <div key={key} className="filter-input-card">
                <label style={{ color: s.color }}>{s.label}</label>
                <input
                  type="number"
                  min={0} max={s.life * 1.1} step={100}
                  value={inputs?.[`hours_${key}`] ?? 0}
                  onChange={e => onInputChange(`hours_${key}`, e.target.value)}
                />
                <div style={{ marginTop: 6 }}>
                  {/* Progress bar */}
                  <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct > 85 ? 'var(--red)' : pct > 60 ? 'var(--orange)' : s.color, transition: 'width 0.3s', borderRadius: 2 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 10, color: 'var(--text2)' }}>
                    <span>ΔP = {dp.toFixed(2)} hPa</span>
                    <span>{pct.toFixed(0)}% life</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* KPI strip */}
        <div className="kpi-strip kpi-strip-4">
          {[
            { label: 'Coalescer ΔP',  val: dpCoal.toFixed(2),  unit: 'hPa', color: STAGES.coalescer.color },
            { label: 'Pre-filter ΔP', val: dpPre.toFixed(2),   unit: 'hPa', color: STAGES.prefilter.color },
            { label: 'Fine filter ΔP',val: dpFine.toFixed(2),  unit: 'hPa', color: STAGES.finefilter.color },
            { label: 'Total ΔP',      val: dpTotal.toFixed(2), unit: 'hPa',
              color: dpTotal > ISO_REF ? 'var(--red)' : dpTotal > ISO_REF * 0.75 ? 'var(--orange)' : 'var(--green)' },
          ].map((k, i) => (
            <div key={i} className="kpi-card" style={{ borderLeft: `3px solid ${k.color}` }}>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-val" style={{ color: k.color, fontSize: 16 }}>
                {k.val}<span className="kpi-unit"> {k.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Main degradation chart */}
        <div className="chart-card" style={{ flex: 1 }}>
          <div className="chart-card-title">ΔP vs Operating Hours — All Stages + Total</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="hours" type="number" domain={[0, 10000]}
                stroke="var(--text2)" tick={{ fontSize: 10 }}
                tickFormatter={v => v.toLocaleString()}
                label={{ value: 'Operating hours', position: 'insideBottom', offset: -4, fill: 'var(--text2)', fontSize: 11 }}
              />
              <YAxis
                stroke="var(--text2)" tick={{ fontSize: 10 }} domain={[0, 14]}
                label={{ value: 'ΔP (hPa)', angle: -90, position: 'insideLeft', fill: 'var(--text2)', fontSize: 11 }}
              />
              <Tooltip content={<TT />} />

              {/* ISO 8 hPa reference band */}
              <ReferenceLine y={ISO_REF} stroke="var(--orange)" strokeDasharray="6 3" strokeWidth={1.2}
                label={{ value: 'ISO 8 hPa', position: 'right', fill: 'var(--orange)', fontSize: 10 }} />

              <Line type="monotone" dataKey="coalescer" stroke={STAGES.coalescer.color} strokeWidth={2} dot={false} name="Coalescer" />
              <Line type="monotone" dataKey="prefilter"  stroke={STAGES.prefilter.color}  strokeWidth={2} dot={false} name="Pre-filter" />
              <Line type="monotone" dataKey="finefilter" stroke={STAGES.finefilter.color} strokeWidth={2} dot={false} name="Fine filter" />
              <Line type="monotone" dataKey="total" stroke="#888" strokeWidth={1.5}
                strokeDasharray="5 3" dot={false} name="Total" />

              {/* Current operating point markers */}
              {hCoal > 0 && <ReferenceDot x={hCoal} y={dpCoal} r={5} fill={STAGES.coalescer.color} stroke="#fff" strokeWidth={1.5} />}
              {hPre  > 0 && <ReferenceDot x={hPre}  y={dpPre}  r={5} fill={STAGES.prefilter.color}  stroke="#fff" strokeWidth={1.5} />}
              {hFine > 0 && <ReferenceDot x={hFine} y={dpFine} r={5} fill={STAGES.finefilter.color} stroke="#fff" strokeWidth={1.5} />}
            </LineChart>
          </ResponsiveContainer>
          <div className="legend" style={{ marginTop: 8 }}>
            {Object.values(STAGES).map(s => (
              <span key={s.label} className="legend-item">
                <span className="legend-line" style={{ background: s.color }} />{s.label} (0–{s.life.toLocaleString()} hr)
              </span>
            ))}
            <span className="legend-item">
              <span className="legend-line" style={{ background: '#888', border: '1px dashed #888', height: 0 }} />Total ΔP
            </span>
          </div>
        </div>

        {/* Design point note */}
        <div style={{ fontSize: 11, color: 'var(--text2)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, padding: '8px 12px' }}>
          <strong style={{ color: 'var(--orange)' }}>Note — ISO design-point consistency:</strong> The OEM design comparison
          in 3.1-0100-00849 uses ΔP_filter = 8 hPa (mid-life equivalent). Current total ΔP = <strong style={{ color: dpTotal > ISO_REF ? 'var(--red)' : 'var(--green)' }}>{dpTotal.toFixed(2)} hPa</strong>.
          {dpTotal < ISO_REF * 0.5 && ' Filters are near-clean — actual inlet pressure is higher than the OEM design reference, so the model will show a slightly optimistic output.'}
          {dpTotal > ISO_REF && ' ⚠ Total ΔP exceeds ISO reference — consider filter inspection or replacement.'}
        </div>

      </div>
    </div>
  )
}

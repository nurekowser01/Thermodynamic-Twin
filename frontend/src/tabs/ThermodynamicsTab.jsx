// tabs/ThermodynamicsTab.jsx
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Line, LineChart,
} from 'recharts'
import { fmt } from '../hooks/useGTApi'

const COLORS = {
  compIs:   '#4a7fe8',
  compAct:  '#2db87a',
  comb:     '#e85050',
  expIs:    '#888',
  expAct:   '#8b6fe8',
}

const StatePill = ({ id, data, color }) => (
  <div style={{ background: 'var(--bg3)', border: `1px solid ${color}`, borderRadius: 4, padding: '5px 10px', minWidth: 110 }}>
    <div style={{ fontSize: 10, color, fontWeight: 700, fontFamily: 'var(--mono)', marginBottom: 2 }}>State {id}</div>
    <div style={{ fontSize: 11, color: 'var(--text1)', fontFamily: 'var(--mono)' }}>
      T = {fmt(data?.T, 1)} °C<br />
      P = {fmt(data?.P, 3)} bar<br />
      h = {fmt(data?.h, 1)} kJ/kg<br />
      s = {fmt(data?.s, 4)} kJ/kgK
    </div>
  </div>
)

const TTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 4, padding: '6px 10px', fontSize: 11 }}>
      <div style={{ color: 'var(--text2)' }}>T = {fmt(d.T, 1)} °C</div>
      <div style={{ color: 'var(--text2)' }}>s = {fmt(d.s, 4)} kJ/kg·K</div>
      <div style={{ color: 'var(--text2)' }}>h = {fmt(d.h, 1)} kJ/kg</div>
      <div style={{ color: 'var(--text2)' }}>P = {fmt(d.P, 2)} bar</div>
    </div>
  )
}

function CycleChart({ title, xKey, yKey, xLabel, yLabel, curves, states, xDomain, yDomain, yScale }) {
  // Flatten all curves for ScatterChart
  const datasets = [
    { key: 'compIs',  label: 'Compress. isentropic', data: curves?.compress_is,  color: COLORS.compIs,  dash: '5 3' },
    { key: 'compAct', label: 'Compress. actual',      data: curves?.compress_act, color: COLORS.compAct, dash: null },
    { key: 'comb',    label: 'Combustion',             data: curves?.combustion,   color: COLORS.comb,    dash: null },
    { key: 'expIs',   label: 'Expand. isentropic',    data: curves?.expand_is,    color: COLORS.expIs,   dash: '5 3' },
    { key: 'expAct',  label: 'Expand. actual',         data: curves?.expand_act,   color: COLORS.expAct,  dash: null },
  ]

  return (
    <div className="chart-card" style={{ flex: 1 }}>
      <div className="chart-card-title">{title}</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey={xKey} type="number" domain={xDomain}
            stroke="var(--text2)" tick={{ fontSize: 10 }}
            label={{ value: xLabel, position: 'insideBottom', offset: -4, fill: 'var(--text2)', fontSize: 11 }}
            tickFormatter={v => Number(v).toFixed(xKey === 's' ? 2 : 0)}
          />
          <YAxis
            dataKey={yKey} type="number" domain={yDomain}
            scale={yScale || 'linear'}
            stroke="var(--text2)" tick={{ fontSize: 10 }}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--text2)', fontSize: 11 }}
            tickFormatter={v => yScale === 'log' ? [10, 20, 50, 100, 120].includes(Math.round(v)) ? v : '' : v}
          />
          <Tooltip content={<TTip />} />
          {datasets.map(ds => ds.data && (
            <Line
              key={ds.key}
              data={ds.data.map(pt => ({ ...pt }))}
              dataKey={yKey}
              type="monotone"
              stroke={ds.color}
              strokeWidth={ds.dash ? 1.2 : 2}
              strokeDasharray={ds.dash}
              dot={false}
              name={ds.label}
              isAnimationActive={false}
            />
          ))}
          {/* State point overlays */}
          {states && Object.entries(states).map(([id, st]) => (
            <Line
              key={`st_${id}`}
              data={[{ ...st, [xKey]: st[xKey], [yKey]: st[yKey] }]}
              dataKey={yKey}
              dot={{ fill: 'var(--text0)', stroke: 'var(--bg0)', r: 4, strokeWidth: 1.5 }}
              isAnimationActive={false}
              strokeWidth={0}
              name={`State ${id}`}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="legend" style={{ marginTop: 6 }}>
        {datasets.map(ds => (
          <span key={ds.key} className="legend-item">
            <span className="legend-line" style={{
              background: ds.dash ? 'transparent' : ds.color,
              border: ds.dash ? `1.5px dashed ${ds.color}` : 'none',
              height: ds.dash ? 0 : 2
            }} />
            {ds.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ThermodynamicsTab({ result }) {
  const thermo = result?.thermo
  const states = thermo?.states
  const curves = thermo?.curves

  const stateOrder = ['1', '3is', '3', '4', '5is', '5']
  const stateColors = {
    '1':   '#4a7fe8', '3is': '#2db87a', '3': '#2db87a',
    '4':   '#e85050', '5is': '#888',    '5': '#8b6fe8',
  }

  return (
    <div className="chart-tab">
      <div className="chart-tab-header">
        <h2>Thermodynamics — Brayton Cycle T-s & P-h Diagrams</h2>
        <p>Design point: T1=35°C · PR=12 · η_c=87.5% · η_t=88% · TIT≈1 189°C · ϑTII=567°C</p>
      </div>
      <div className="chart-body">

        {!result ? (
          <div className="no-result">
            <div className="icon">⚗️</div>
            <div>Run a calculation on the Canvas tab to populate thermodynamic diagrams</div>
          </div>
        ) : (
          <>
            {/* State point pills */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {stateOrder.map(id => states?.[id] && (
                <StatePill key={id} id={id} data={states[id]} color={stateColors[id]} />
              ))}
            </div>

            {/* T-s and P-h side by side */}
            <div style={{ display: 'flex', gap: 12, flex: 1 }}>
              <CycleChart
                title="T–s Diagram"
                xKey="s" yKey="T"
                xLabel="s (kJ/kg·K)" yLabel="T (°C)"
                curves={curves} states={states}
                xDomain={[3.85, 4.95]}
                yDomain={[0, 1300]}
              />
              <CycleChart
                title="P–h Diagram"
                xKey="h" yKey="P"
                xLabel="h (kJ/kg)" yLabel="P (bar)"
                curves={curves} states={states}
                xDomain={[380, 1800]}
                yDomain={[8, 140]}
              />
            </div>

            {/* Work & heat summary */}
            <div className="kpi-strip kpi-strip-4">
              {[
                { label: 'Compressor work (W_c)',   val: fmt(result?.gt?.compressor?.W_c_kJ_kg, 1), unit: 'kJ/kg' },
                { label: 'TIT (est.)',               val: fmt(result?.gt?.T4_TIT_C, 0),             unit: '°C' },
                { label: 'Isentropic T3',            val: fmt(result?.gt?.compressor?.T3_is_C, 1),  unit: '°C' },
                { label: 'Actual T3',                val: fmt(result?.gt?.compressor?.T3_C, 1),     unit: '°C' },
              ].map((k, i) => (
                <div key={i} className="kpi-card">
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-val">{k.val}<span className="kpi-unit"> {k.unit}</span></div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

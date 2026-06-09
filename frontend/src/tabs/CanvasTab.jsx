// tabs/CanvasTab.jsx
import { useState } from 'react'
import { fmt, fmtDelta } from '../hooks/useGTApi'

// ── Small reusable components ──────────────────────────────────────────────

function Input({ label, value, onChange, unit, readOnly = false, color }) {
  const cls = readOnly
    ? `field-input result${color === 'warn' ? ' warn' : color === 'alert' ? ' alert' : ''}`
    : 'field-input'
  return (
    <div className="field-group">
      <span className="field-label">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <input
          className={cls}
          value={value}
          onChange={e => onChange && onChange(e.target.value)}
          readOnly={readOnly}
          style={{ width: 84 }}
        />
        {unit && <span style={{ fontSize: 10, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{unit}</span>}
      </div>
    </div>
  )
}

function Tag({ label, value, unit, color = 'var(--text0)' }) {
  return (
    <g>
      <text style={{ fill: 'var(--text2)', fontSize: 9, fontFamily: 'var(--mono)' }}>{label}</text>
      <text dy={12} style={{ fill: color, fontSize: 11, fontWeight: 600, fontFamily: 'var(--mono)' }}>
        {value} <tspan style={{ fontSize: 9, fontWeight: 400, fill: 'var(--text2)' }}>{unit}</tspan>
      </text>
    </g>
  )
}

// ── Instrument circle tag ──────────────────────────────────────────────────
function ITag({ cx, cy, label }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill="var(--bg2)" stroke="var(--border2)" strokeWidth={0.8} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        style={{ fill: 'var(--text2)', fontSize: 8, fontFamily: 'var(--mono)' }}>{label}</text>
    </g>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function CanvasTab({ mode, fuel, inputs, onInputChange, result, loading }) {
  const gt  = result?.gt
  const bal = result?.balance
  const net = bal?.net_output
  const hb  = bal?.heat_balance
  const comp = gt?.compressor

  const r = (key, dp = 1, fallback = '—') =>
    gt ? fmt(gt[key] ?? comp?.[key], dp, fallback) : fallback
  const rb = (key, dp = 1) => bal ? fmt(net?.[key] ?? hb?.[key], dp) : '—'

  const deltaP  = gt ? fmtDelta(gt.delta_P_MW, 2) : null
  const deltaHR = gt?.delta_HR_pct != null ? fmtDelta(gt.delta_HR_pct, 2) : null

  // SVG layout constants
  const W = 960, H = 520

  return (
    <div className="canvas-tab">
      <div className="canvas-area">
        <svg viewBox={`0 0 ${W} ${H}`} className="pid-canvas"
          style={{ display: 'block', minHeight: 440 }}>

          {/* ── Grid background ── */}
          <defs>
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M30 0H0V30" fill="none" stroke="var(--border)" strokeWidth="0.3" opacity="0.4" />
            </pattern>
            <marker id="arr" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M1 1L7 4L1 7" fill="none" stroke="context-stroke" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="arrO" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M1 1L7 4L1 7" fill="none" stroke="#e8883a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="arrG" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M1 1L7 4L1 7" fill="none" stroke="var(--green)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          <rect width={W} height={H} fill="url(#grid)" />
          <rect width={W} height={H} fill="none" stroke="var(--border)" strokeWidth="0.8" rx="6" />

          {/* ══ FUEL SYSTEM ═══════════════════════════════════════════ */}
          {/* Pipeline supply box */}
          <rect x={28} y={32} width={108} height={48} rx={4}
            fill="var(--bg2)" stroke="var(--border2)" strokeWidth={0.8} strokeDasharray="5 3" />
          <text x={82} y={52} textAnchor="middle" style={{ fill: 'var(--text1)', fontSize: 11, fontWeight: 600 }}>Pipeline Gas</text>
          <text x={82} y={66} textAnchor="middle" style={{ fill: 'var(--text2)', fontSize: 10, fontFamily: 'var(--mono)' }}>~9.5 bar</text>

          {/* Pipeline → GBC */}
          <line x1={136} y1={56} x2={186} y2={56} stroke="#e8883a" strokeWidth={2} markerEnd="url(#arrO)" />

          {/* GBC box */}
          <rect x={188} y={36} width={100} height={40} rx={4}
            fill="var(--bg2)" stroke="var(--border2)" strokeWidth={1} />
          <text x={238} y={53} textAnchor="middle" style={{ fill: 'var(--text1)', fontSize: 11, fontWeight: 600 }}>GBC ×2</text>
          <text x={238} y={67} textAnchor="middle" style={{ fill: 'var(--text2)', fontSize: 10, fontFamily: 'var(--mono)' }}>
            {net ? `${fmt(net.P_GBC_MW, 2)} MW` : '~4.0 MW'}
          </text>

          {/* GBC → combustor (fuel line, vertical drop) */}
          <path d={`M290 56 L330 56 L330 218`}
            stroke="#e8883a" strokeWidth={2} fill="none" markerEnd="url(#arrO)" />
          <text x={336} y={140} style={{ fill: '#e8883a', fontSize: 10, fontFamily: 'var(--mono)' }}>NG ~22 bar</text>

          {/* FCV symbol on fuel line */}
          <polygon points="321,138 339,144 339,152 321,158"
            fill="var(--bg2)" stroke="var(--border2)" strokeWidth={0.8} />
          <polygon points="339,138 321,144 321,152 339,158"
            fill="var(--bg2)" stroke="var(--border2)" strokeWidth={0.8} />
          <line x1={330} y1={128} x2={330} y2={138} stroke="var(--border2)" strokeWidth={0.8} />
          <rect x={318} y={118} width={24} height={12} rx={6}
            fill="var(--bg2)" stroke="var(--border2)" strokeWidth={0.6} />
          <text x={330} y={127} textAnchor="middle" dominantBaseline="central"
            style={{ fill: 'var(--text2)', fontSize: 8, fontFamily: 'var(--mono)' }}>FCV</text>

          {/* FT-301 */}
          <ITag cx={306} cy={56} label="FT" />

          {/* ══ AIR INTAKE ════════════════════════════════════════════ */}
          {/* Atmosphere label + arrow */}
          <text x={36} y={220} style={{ fill: 'var(--text2)', fontSize: 10 }}>Atmosphere</text>
          <path d={`M36 228 L80 228`} stroke="#4a7fe8" strokeWidth={2} markerEnd="url(#arr)" />
          <text x={58} y={222} textAnchor="middle" style={{ fill: '#4a7fe8', fontSize: 9, fontFamily: 'var(--mono)' }}>Air</text>

          {/* ── FILTER TRAIN ── */}
          <rect x={82} y={206} width={96} height={44} rx={4}
            fill="var(--bg2)" stroke="var(--border2)" strokeWidth={1} />
          <text x={130} y={224} textAnchor="middle" style={{ fill: 'var(--text1)', fontSize: 11, fontWeight: 600 }}>Filters</text>
          <text x={130} y={238} textAnchor="middle" style={{ fill: 'var(--text2)', fontSize: 9, fontFamily: 'var(--mono)' }}>Coal+Pre+Fine</text>
          {/* PDT */}
          <ITag cx={112} cy={196} label="PDT" />
          <line x1={112} y1={202} x2={112} y2={206} stroke="var(--border2)" strokeWidth={0.6} />
          {/* ΔP display */}
          <text x={130} y={256} textAnchor="middle"
            style={{ fill: gt ? 'var(--green)' : 'var(--text2)', fontSize: 10, fontFamily: 'var(--mono)' }}>
            ΔP {gt ? `${fmt(gt.filter?.dp_total_hPa, 2)}` : '—'} hPa
          </text>

          {/* Stream 1: filter → compressor */}
          <path d={`M178 228 L222 228`} stroke="#4a7fe8" strokeWidth={2} markerEnd="url(#arr)" />
          <text x={200} y={220} textAnchor="middle" style={{ fill: '#4a7fe8', fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600 }}>①</text>

          {/* ── COMPRESSOR ── */}
          <polygon points="224,206 262,214 262,242 224,250"
            fill="var(--bg2)" stroke="var(--border2)" strokeWidth={1.2} />
          <text x={243} y={226} textAnchor="middle" style={{ fill: 'var(--text1)', fontSize: 13, fontWeight: 700 }}>C</text>
          <text x={243} y={240} textAnchor="middle" style={{ fill: 'var(--text2)', fontSize: 9, fontFamily: 'var(--mono)' }}>PR 12</text>



          {/* Stream 3: compressor → combustor */}
          <path d={`M262 228 L318 228`} stroke="#4a7fe8" strokeWidth={2} markerEnd="url(#arr)" />
          <text x={290} y={220} textAnchor="middle" style={{ fill: '#4a7fe8', fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600 }}>③</text>
          {/* TE-102 on stream 3 */}
          <ITag cx={284} cy={242} label="TE" />
          <line x1={284} y1={236} x2={284} y2={230} stroke="var(--border2)" strokeWidth={0.6} />
          {/* T3 value */}
          <text x={290} y={258} textAnchor="middle"
            style={{ fill: comp ? '#4a7fe8' : 'var(--text2)', fontSize: 10, fontFamily: 'var(--mono)' }}>
            {comp ? `${fmt(comp.T3_C, 1)} °C` : '— °C'}
          </text>

          {/* ── COMBUSTOR ── */}
          <ellipse cx={356} cy={228} rx={36} ry={28}
            fill="var(--bg2)" stroke="var(--border2)" strokeWidth={1.2} />
          <text x={356} y={224} textAnchor="middle" style={{ fill: 'var(--text1)', fontSize: 12, fontWeight: 700 }}>CC</text>
          <text x={356} y={238} textAnchor="middle" style={{ fill: 'var(--text2)', fontSize: 9, fontFamily: 'var(--mono)' }}>Combustor</text>

          {/* Stream 4: combustor → turbine */}
          <path d={`M392 228 L448 228`} stroke="#e85050" strokeWidth={2.5} markerEnd="url(#arr)" />
          <text x={420} y={220} textAnchor="middle" style={{ fill: '#e85050', fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600 }}>④</text>
          {/* TE-201 */}
          <ITag cx={414} cy={244} label="TE" />
          <line x1={414} y1={238} x2={414} y2={232} stroke="var(--border2)" strokeWidth={0.6} />
          <text x={420} y={260} textAnchor="middle"
            style={{ fill: gt ? '#e85050' : 'var(--text2)', fontSize: 10, fontFamily: 'var(--mono)' }}>
            {gt ? `${fmt(gt.T4_TIT_C, 0)} °C` : '— °C'}
          </text>

          {/* ── TURBINE ── */}
          <polygon points="450,214 488,206 488,250 450,242"
            fill="var(--bg2)" stroke="var(--border2)" strokeWidth={1.2} />
          <text x={469} y={226} textAnchor="middle" style={{ fill: 'var(--text1)', fontSize: 13, fontWeight: 700 }}>T</text>
          <text x={469} y={240} textAnchor="middle" style={{ fill: 'var(--text2)', fontSize: 9, fontFamily: 'var(--mono)' }}>η 88%</text>


          {/* ── GENERATOR ── */}
          <line x1={488} y1={228} x2={530} y2={228}
            stroke="var(--border2)" strokeWidth={1.5} strokeDasharray="5 3" />
          <circle cx={554} cy={228} r={28}
            fill="var(--bg2)" stroke="var(--border2)" strokeWidth={1.2} />
          <text x={554} y={225} textAnchor="middle" style={{ fill: 'var(--text1)', fontSize: 14, fontWeight: 700 }}>G</text>
          <text x={554} y={240} textAnchor="middle"
            style={{ fill: gt ? 'var(--green)' : 'var(--text2)', fontSize: 10, fontFamily: 'var(--mono)' }}>
            {gt
              ? (mode === 1
                  ? `${fmt(gt.P_GT_actual_MW || inputs.P_GT_actual_MW, 1)} MW`
                  : `${fmt(gt.P_GT_expected_MW, 1)} MW`)
              : '— MW'}
          </text>

          {/* Power out → busbar */}
          <path d={`M582 228 L640 228`} stroke="var(--green)" strokeWidth={2} markerEnd="url(#arrG)" />
          <rect x={642} y={208} width={88} height={40} rx={4}
            fill="var(--bg2)" stroke="var(--green)" strokeWidth={0.8} />
          <text x={686} y={224} textAnchor="middle" style={{ fill: 'var(--green)', fontSize: 11, fontWeight: 600 }}>Busbar</text>
          <text x={686} y={238} textAnchor="middle"
            style={{ fill: net ? 'var(--green)' : 'var(--text2)', fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600 }}>
            {net ? `${fmt(net.P_net_MW, 1)} MW` : '— MW'}
          </text>

          {/* Excitation line */}
          <line x1={554} y1={256} x2={554} y2={290} stroke="var(--border2)" strokeWidth={0.8} strokeDasharray="3 2" />
          <rect x={514} y={292} width={80} height={28} rx={4}
            fill="var(--bg2)" stroke="var(--border)" strokeWidth={0.6} />
          <text x={554} y={302} textAnchor="middle" style={{ fill: 'var(--text2)', fontSize: 9 }}>Excitation</text>
          <text x={554} y={314} textAnchor="middle" style={{ fill: 'var(--text2)', fontSize: 9, fontFamily: 'var(--mono)' }}>0.5 MW</text>

          {/* ── EXHAUST ── */}
          {/* Stream 5: turbine outlet → stack */}
          <path d={`M469 250 L469 360 L560 360`}
            stroke="#888" strokeWidth={2} fill="none" markerEnd="url(#arr)" />
          <text x={510} y={354} style={{ fill: 'var(--text2)', fontSize: 9, fontFamily: 'var(--mono)' }}>⑤ Exhaust</text>
          {/* TE-501 */}
          <ITag cx={490} cy={376} label="TE" />
          <line x1={490} y1={370} x2={490} y2={362} stroke="var(--border2)" strokeWidth={0.6} />
          <text x={490} y={392} textAnchor="middle"
            style={{ fill: gt ? '#888' : 'var(--text2)', fontSize: 10, fontFamily: 'var(--mono)' }}>
            {gt ? `${fmt(gt.T5_TII_oem_C, 0)} °C` : '— °C'}
          </text>

          {/* Stack symbol */}
          <rect x={562} y={334} width={34} height={56} rx={2}
            fill="var(--bg2)" stroke="var(--border2)" strokeWidth={1} />
          <rect x={566} y={330} width={26} height={8} rx={1}
            fill="var(--bg2)" stroke="var(--border2)" strokeWidth={0.6} />
          <text x={579} y={396} textAnchor="middle" style={{ fill: 'var(--text2)', fontSize: 9 }}>Stack</text>
          {/* Plume */}
          {[574, 579, 584].map((x, i) => (
            <path key={i} d={`M${x} 330 Q${x - 3} 314 ${x} 300 Q${x + 3} 288 ${x} 274`}
              fill="none" stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3 2" />
          ))}

          {/* ══ RESULTS PANEL (right side) ════════════════════════════ */}
          <rect x={750} y={24} width={196} height={H - 44} rx={5}
            fill="var(--bg2)" stroke="var(--border2)" strokeWidth={0.8} />
          <text x={848} y={44} textAnchor="middle"
            style={{ fill: 'var(--text2)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            Results
          </text>
          <line x1={762} y1={50} x2={934} y2={50} stroke="var(--border)" strokeWidth={0.5} />

          {/* KPI rows */}
          {[
            { label: 'GT Output',   val: mode === 1 ? fmt(inputs.P_GT_actual_MW, 1) : (gt ? fmt(gt.P_GT_expected_MW, 1) : '—'), unit: 'MW' },
            { label: 'Net Busbar',  val: net ? fmt(net.P_net_MW, 2) : '—', unit: 'MW' },
            { label: 'η LHV',       val: hb  ? fmt(hb.eta_LHV_pct, 3) : '—', unit: '%' },
            { label: 'η HHV',       val: hb  ? fmt(hb.eta_HHV_pct, 3) : '—', unit: '%' },
            { label: 'HR LHV',      val: hb  ? fmt(hb.HR_LHV_kJ_kWh, 0) : '—', unit: 'kJ/kWh' },
            { label: 'HR HHV',      val: hb  ? fmt(hb.HR_HHV_kJ_kWh, 0) : '—', unit: 'kJ/kWh' },
            { label: 'T3 (comp out)', val: comp ? fmt(comp.T3_C, 1) : '—', unit: '°C' },
            { label: 'T4 (TIT est)', val: gt ? fmt(gt.T4_TIT_C, 0) : '—', unit: '°C' },
            { label: 'ϑTII (OEM)',  val: gt ? fmt(gt.T5_TII_oem_C, 0) : '—', unit: '°C' },
            { label: 'Q in (LHV)',  val: hb ? fmt(hb.Q_in_LHV_MW, 1) : '—', unit: 'MW' },
            { label: 'Q exhaust',   val: hb ? fmt(hb.Q_exhaust_MW, 1) : '—', unit: 'MW' },
            { label: 'Exh fraction',val: hb ? fmt(hb.exhaust_fraction_pct, 1) : '—', unit: '%' },
            { label: 'Density ratio',val:gt  ? fmt(gt.density_ratio, 4) : '—', unit: '' },
          ].map((row, i) => (
            <g key={i} transform={`translate(762, ${60 + i * 28})`}>
              <text y={10} style={{ fill: 'var(--text2)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</text>
              <text y={23} style={{ fill: 'var(--green)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--mono)' }}>
                {row.val} <tspan style={{ fill: 'var(--text2)', fontSize: 9, fontWeight: 400 }}>{row.unit}</tspan>
              </text>
              <line x1={0} y1={28} x2={172} y2={28} stroke="var(--border)" strokeWidth={0.4} />
            </g>
          ))}

          {/* Δ deviation badges */}
          {deltaP && (
            <g transform={`translate(762, ${60 + 13 * 28 + 4})`}>
              <text y={10} style={{ fill: 'var(--text2)', fontSize: 9, textTransform: 'uppercase' }}>ΔP vs OEM</text>
              <text y={23} style={{ fill: deltaP.cls === 'pos' ? 'var(--green)' : 'var(--red)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--mono)' }}>
                {deltaP.text} MW
              </text>
            </g>
          )}

          {/* ══ INPUT PANEL (bottom) ══════════════════════════════════ */}
          {/* Ambient inputs positioned near filter/compressor */}
          <g transform="translate(28, 340)">
            <text style={{ fill: 'var(--text2)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ambient Conditions</text>
            <line x1={0} y1={6} x2={200} y2={6} stroke="var(--border)" strokeWidth={0.4} />
          </g>
          <foreignObject x={28} y={354} width={220} height={140}>
            <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input label="T_CI" unit="°C" value={inputs.T_CI} onChange={v => onInputChange('T_CI', v)} />
                <Input label="P_amb" unit="hPa" value={inputs.P_amb} onChange={v => onInputChange('P_amb', v)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input label="RH" unit="%" value={inputs.RH_pct} onChange={v => onInputChange('RH_pct', v)} />
                <Input label="P_eff" unit="hPa" value={gt ? fmt(gt.P_eff_hPa, 1) : '—'} readOnly />
              </div>
            </div>
          </foreignObject>

          {/* Mode-specific primary input */}
          <g transform="translate(270, 340)">
            <text style={{ fill: 'var(--text2)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {mode === 1 ? 'GT Measurement' : 'Fuel Input'}
            </text>
            <line x1={0} y1={6} x2={220} y2={6} stroke="var(--border)" strokeWidth={0.4} />
          </g>
          <foreignObject x={270} y={354} width={220} height={140}>
            <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {mode === 1 ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input label="P_GT" unit="MW" value={inputs.P_GT_actual_MW} onChange={v => onInputChange('P_GT_actual_MW', v)} />
                  <Input label="ṁ_fuel" unit="kg/s" value={inputs.m_fuel_actual} onChange={v => onInputChange('m_fuel_actual', v)} />
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input label="ṁ_fuel" unit="kg/s" value={inputs.m_fuel_kgs} onChange={v => onInputChange('m_fuel_kgs', v)} />
                  <Input label="LHV" unit="kJ/kg" value={inputs.LHV} onChange={v => onInputChange('LHV', v)} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <Input label="GBC units" unit="" value={inputs.n_gbc_units} onChange={v => onInputChange('n_gbc_units', v)} />
                <Input label="P_RMS" unit="bar" value={inputs.P_rms_bar} onChange={v => onInputChange('P_rms_bar', v)} />
              </div>
            </div>
          </foreignObject>

          {/* Filter hours inputs */}
          <g transform="translate(520, 340)">
            <text style={{ fill: 'var(--text2)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Filter Hours</text>
            <line x1={0} y1={6} x2={210} y2={6} stroke="var(--border)" strokeWidth={0.4} />
          </g>
          <foreignObject x={520} y={354} width={216} height={140}>
            <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input label="Coalescer" unit="hr" value={inputs.hours_coalescer} onChange={v => onInputChange('hours_coalescer', v)} />
                <Input label="Pre-filter" unit="hr" value={inputs.hours_prefilter} onChange={v => onInputChange('hours_prefilter', v)} />
              </div>
              <Input label="Fine filter" unit="hr" value={inputs.hours_finefilter} onChange={v => onInputChange('hours_finefilter', v)} />
            </div>
          </foreignObject>

        </svg>
      </div>
    </div>
  )
}

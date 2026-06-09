// tabs/EnergyTab.jsx
import { useEffect, useRef } from 'react'
import { fmt } from '../hooks/useGTApi'

function SankeyCanvas({ data }) {
  const ref = useRef()

  useEffect(() => {
    if (!ref.current || !data) return
    const canvas = ref.current
    const dpr = window.devicePixelRatio || 1
    const W = canvas.parentElement.offsetWidth
    const H = 340
    canvas.width  = W * dpr
    canvas.height = H * dpr
    canvas.style.width  = W + 'px'
    canvas.style.height = H + 'px'
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const { Q_in, P_GT, Q_exh, Q_rad, P_net, P_EXC, P_GBC, P_aux } = data

    const avail  = H - 60
    const scale  = avail / Q_in
    const nW     = 20
    const pad    = 6
    const x0     = 48
    const x1     = W * 0.36
    const x2     = W * 0.68

    const h = {
      fuel:  Q_in  * scale,
      gross: P_GT  * scale,
      exh:   Q_exh * scale,
      rad:   Q_rad * scale,
      net:   P_net * scale,
      exc:   P_EXC * scale,
      gbc:   P_GBC * scale,
      aux:   P_aux * scale,
    }

    const y0f = 30
    const y1g = 30
    const y1e = y1g + h.gross + pad
    const y1r = y1e + h.exh   + pad
    const y2n = 30
    const y2x = y2n + h.net   + pad
    const y2b = y2x + h.exc   + pad
    const y2a = y2b + h.gbc   + pad

    const cols = {
      fuel:  '#BA7517', gross: '#4a7fe8', exh: '#555e70',
      rad:   '#e85050', net:   '#2db87a', exc: '#8b6fe8',
      gbc:   '#6b8fd4', aux:   '#4a5568',
    }

    function link(xs, ys, hs, xt, yt, ht, col) {
      const cp = (xt - xs) * 0.5
      ctx.beginPath()
      ctx.moveTo(xs + nW, ys)
      ctx.bezierCurveTo(xs+nW+cp, ys, xt-cp, yt, xt, yt)
      ctx.lineTo(xt, yt + ht)
      ctx.bezierCurveTo(xt-cp, yt+ht, xs+nW+cp, ys+hs, xs+nW, ys+hs)
      ctx.closePath()
      ctx.fillStyle = col
      ctx.globalAlpha = 0.18
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = col
      ctx.lineWidth = 0.6
      ctx.stroke()
    }

    function node(x, y, ht, col, label, val) {
      ctx.fillStyle = col
      ctx.globalAlpha = 0.9
      ctx.fillRect(x, y, nW, ht)
      ctx.globalAlpha = 1

      ctx.font = `500 11px "Segoe UI",sans-serif`
      ctx.fillStyle = '#b0bcd4'
      ctx.textAlign = 'left'
      ctx.fillText(label, x + nW + 6, y + Math.min(ht / 2, 13))

      ctx.font = `600 12px "Cascadia Code","Consolas",monospace`
      ctx.fillStyle = col
      ctx.fillText(val, x + nW + 6, y + Math.min(ht / 2, 13) + 14)
    }

    // Draw links
    link(x0, y0f,              h.gross, x1, y1g, h.gross, cols.gross)
    link(x0, y0f+h.gross,      h.exh,  x1, y1e, h.exh,   cols.exh)
    link(x0, y0f+h.gross+h.exh, h.rad, x1, y1r, h.rad,   cols.rad)
    link(x1, y1g,              h.net,  x2, y2n, h.net,   cols.net)
    link(x1, y1g+h.net,        h.exc,  x2, y2x, h.exc,   cols.exc)
    link(x1, y1g+h.net+h.exc,  h.gbc,  x2, y2b, h.gbc,   cols.gbc)
    link(x1, y1g+h.net+h.exc+h.gbc, h.aux, x2, y2a, h.aux, cols.aux)

    // Draw nodes
    node(x0, y0f, h.fuel,  cols.fuel,  'Fuel (LHV)', `${fmt(Q_in, 1)} MW`)
    node(x1, y1g, h.gross, cols.gross, 'GT gross',   `${fmt(P_GT, 1)} MW`)
    node(x1, y1e, h.exh,   cols.exh,   'Exhaust',    `${fmt(Q_exh, 1)} MW`)
    node(x1, y1r, h.rad,   cols.rad,   'Radiation',  `${fmt(Q_rad, 2)} MW`)
    node(x2, y2n, h.net,   cols.net,   'Net export', `${fmt(P_net, 1)} MW`)
    node(x2, y2x, h.exc,   cols.exc,   'Excitation', `${fmt(P_EXC, 2)} MW`)
    node(x2, y2b, h.gbc,   cols.gbc,   'GBC ×2',     `${fmt(P_GBC, 2)} MW`)
    node(x2, y2a, h.aux,   cols.aux,   'Other aux',  `${fmt(P_aux, 2)} MW`)

    // Efficiency annotation
    const eta = (P_GT / Q_in * 100).toFixed(2)
    const netEta = (P_net / Q_in * 100).toFixed(2)
    ctx.font = `10px "Segoe UI",sans-serif`
    ctx.fillStyle = '#6e7e9e'
    ctx.textAlign = 'right'
    ctx.fillText(`η_LHV = ${eta}%`, x1 - 8, y1g + h.gross / 2)
    ctx.fillText(`Net η = ${netEta}%`, x2 - 8, y2n + h.net / 2)

  }, [data, ref])

  return <canvas ref={ref} style={{ width: '100%', height: 340 }} />
}

export default function EnergyTab({ result }) {
  const hb  = result?.balance?.heat_balance
  const net = result?.balance?.net_output
  const gbc = result?.balance?.gbc

  const sankeyData = hb && net ? {
    Q_in:  hb.Q_in_LHV_MW,
    P_GT:  hb.P_GT_MW,
    Q_exh: hb.Q_exhaust_MW,
    Q_rad: hb.Q_radiation_MW,
    P_net: net.P_net_MW,
    P_EXC: net.P_EXC_MW,
    P_GBC: net.P_GBC_MW,
    P_aux: net.P_other_aux_MW,
  } : null

  return (
    <div className="chart-tab">
      <div className="chart-tab-header">
        <h2>Energy Balance — Sankey Flow Diagram</h2>
        <p>All values in MW · LHV basis · Simple cycle</p>
      </div>
      <div className="chart-body">
        {!result ? (
          <div className="no-result">
            <div className="icon">⚡</div>
            <div>Run a calculation on the Canvas tab to populate the energy balance</div>
          </div>
        ) : (
          <>
            <div className="kpi-strip kpi-strip-4">
              {[
                { label: 'Fuel input (LHV)',  val: fmt(hb?.Q_in_LHV_MW, 1),       unit: 'MW' },
                { label: 'GT gross output',   val: fmt(hb?.P_GT_MW, 2),            unit: 'MW' },
                { label: 'Exhaust stack',     val: fmt(hb?.Q_exhaust_MW, 1),       unit: 'MW' },
                { label: 'Net export',        val: fmt(net?.P_net_MW, 2),           unit: 'MW' },
              ].map((k, i) => (
                <div key={i} className="kpi-card">
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-val">{k.val}<span className="kpi-unit"> {k.unit}</span></div>
                </div>
              ))}
            </div>

            <div className="chart-card">
              <div className="chart-card-title">Energy Flow — Sankey</div>
              <SankeyCanvas data={sankeyData} />
            </div>

            <div className="chart-row chart-row-2">
              <div className="chart-card">
                <div className="chart-card-title">Heat Balance Breakdown</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Stream', 'MW', '% of Q_in'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text2)', fontWeight: 500, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Fuel input (LHV)',     hb?.Q_in_LHV_MW,   100],
                      ['GT electrical output', hb?.P_GT_MW,        hb ? hb.electrical_fraction_pct : null],
                      ['Exhaust stack',        hb?.Q_exhaust_MW,   hb ? hb.exhaust_fraction_pct    : null],
                      ['Radiation / mech.',    hb?.Q_radiation_MW, hb ? hb.Q_radiation_MW / hb.Q_in_LHV_MW * 100 : null],
                    ].map(([label, val, pct], i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '5px 8px', color: 'var(--text1)' }}>{label}</td>
                        <td style={{ padding: '5px 8px', color: 'var(--green)', fontFamily: 'var(--mono)' }}>{fmt(val, 2)}</td>
                        <td style={{ padding: '5px 8px', color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{fmt(pct, 1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">Auxiliary Load Breakdown</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Consumer', 'MW'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text2)', fontWeight: 500, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['GT Gross Output', net?.P_gross_MW],
                      ['Excitation loss', net?.P_EXC_MW],
                      [`GBC ×${gbc?.n_units_running ?? 2}`, net?.P_GBC_MW],
                      ['Other auxiliaries', net?.P_other_aux_MW],
                      ['Net Busbar Export', net?.P_net_MW],
                    ].map(([label, val], i) => (
                      <tr key={i} style={{
                        borderBottom: '1px solid var(--border)',
                        fontWeight: i === 0 || i === 4 ? 600 : 400,
                        borderTop: i === 4 ? '1px solid var(--border2)' : undefined,
                      }}>
                        <td style={{ padding: '5px 8px', color: i === 4 ? 'var(--green)' : 'var(--text1)' }}>{label}</td>
                        <td style={{ padding: '5px 8px', color: i === 4 ? 'var(--green)' : 'var(--text2)', fontFamily: 'var(--mono)' }}>
                          {i > 0 && i < 4 ? '− ' : ''}{fmt(val, 3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

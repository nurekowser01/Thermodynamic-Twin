# Sirajganj GT Digital Twin
### SGT5-2000E · Serial No. 800849 · 150 MW Peaking Power Plant

A full thermodynamic digital twin for the Sirajganj gas turbine — built as a
desktop-first web application with a FastAPI Python backend and React frontend.

---

## Architecture

```
sirajganj_app/
├── backend/
│   ├── api.py                  ← FastAPI REST server (port 8749)
│   ├── config/
│   │   └── sirajganj.py        ← OEM constants (unchanged from model)
│   └── core/
│       ├── properties.py       ← CoolProp thermodynamic wrappers
│       ├── gt_model.py         ← Mode 1 / Mode 2 solvers
│       ├── auxiliaries.py      ← GBC + excitation models
│       └── plant_balance.py    ← Net output + heat balance + Sankey data
├── frontend/
│   └── src/
│       ├── App.jsx             ← Shell, tab routing, global state
│       ├── hooks/useGTApi.js   ← All API calls centralised
│       └── tabs/
│           ├── CanvasTab.jsx       ← P&ID canvas with embedded inputs
│           ├── PerformanceTab.jsx  ← OEM curves + compressor efficiency map
│           ├── ThermodynamicsTab.jsx ← T-s and P-h Brayton cycle diagrams
│           ├── EnergyTab.jsx       ← Sankey energy flow + heat balance table
│           └── FilterTab.jsx       ← ΔP degradation curves + live hour inputs
├── run_dev.sh      ← Linux/macOS launcher
├── run_dev.bat     ← Windows launcher
└── README.md
```

---

## Prerequisites

**Python** (3.10+)
```bash
pip install fastapi uvicorn pydantic CoolProp scipy numpy
```

**Node.js** (18+)
```bash
cd frontend && npm install
```

---

## Running (Development)

### Linux / macOS
```bash
bash run_dev.sh
```

### Windows
Double-click `run_dev.bat` — opens two terminal windows.

### Manual
```bash
# Terminal 1 — Backend
cd backend
uvicorn api:app --port 8749 --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Application Tabs

| Tab | Description |
|-----|-------------|
| **P&ID Canvas** | Static engineering schematic with embedded input fields. Enter ambient conditions, GT output (Mode 1) or fuel flow (Mode 2), filter hours. Click **Calculate** or press `Ctrl+Enter`. Results populate in-place on the drawing. |
| **Performance** | OEM P_GT and ϑTII curves (gas + oil) vs T_CI. Compressor efficiency map: T3 and W_c iso-efficiency lines (η = 82–91%). Operating point highlighted on all charts. |
| **Thermodynamics** | T-s and P-h Brayton cycle diagrams. Isentropic vs actual compression and expansion paths. Six state points with full property table. |
| **Energy Balance** | Sankey energy flow (MW proportional). Heat balance table. Auxiliary load breakdown table. |
| **Filter ΔP** | Degradation curves for coalescer, pre-filter, and fine filter. Life-fraction progress bars. ISO 8 hPa reference line. Design-point consistency note. |

---

## Solver Modes

**Mode 1** — Known measured GT gross output → heat rate, efficiency, fuel flow deviation
- Primary input: P_GT actual [MW] + optional measured fuel flow [kg/s]
- Outputs: design efficiency, expected vs actual heat rate, ΔHR vs design

**Mode 2** — Known fuel flow → expected GT output
- Primary input: fuel mass flow [kg/s] + LHV [kJ/kg]
- Outputs: expected P_GT, deviation from OEM curve, efficiency

Both modes: Mode/Fuel toggle in the toolbar. `Ctrl+Enter` to calculate from any tab.

---

## Desktop Packaging (Tauri)

For offline plant use, wrap the app with Tauri:

```bash
# Install Tauri CLI
npm install -g @tauri-apps/cli

# In frontend/
npm run tauri init
npm run tauri build
```

The FastAPI backend runs as a Python sidecar process — configure in `tauri.conf.json`:
```json
{
  "bundle": {
    "externalBin": ["../backend/api_sidecar"]
  }
}
```

Package the backend with PyInstaller:
```bash
pip install pyinstaller
cd backend
pyinstaller --onefile api.py -n api_sidecar
```

---

## Data Sources

| Document | Content |
|----------|---------|
| 3.1-0100-00849 | Design Data — GT Technical Data |
| 3.1-0124-0849  | Generator Output & ϑTII vs T_CI — Natural Gas |
| 3.1-0125-0849  | Generator Output & ϑTII vs T_CI — Fuel Oil |
| 3.1-0118-6432  | Temperature Limits at Turbine Outlet |
| 3.1-0164-9421  | Natural Gas Fuel Specification |

---

## Known Gaps / Future Work

- `K_FACTOR` for OTC control limits not yet set (requires List of Settings)
- Combined cycle HRSG consumers (CW pumps, CEP, CT fans) out of scope
- HHV/LHV ratio uses default — refine with gas chromatograph data
- Filter model is linear — replace with actual FAIST pressure drop data if available
- Tauri desktop packaging (run_dev targets browser for now)

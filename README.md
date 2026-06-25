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
│           ├── FilterTab.jsx       ← ΔP degradation curves + live hour inputs
│           └── AssistantTab.jsx    ← LLM advisor chat (Docker only)
├── llm-service/    ← Independent LLM advisor API (port 11435)
├── scripts/
│   ├── preload-model.sh   ← Pull and warm Ollama model (Docker)
│   └── preload-model.bat
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

## Running with Docker

```bash
docker compose up -d --build
```

Pull and warm the Ollama model (first time only, ~91 MB for `smollm:135m`):

```bash
bash scripts/preload-model.sh
```

On Windows:

```bat
scripts\preload-model.bat
```

Open **http://localhost:8080** in your browser.

- `docker compose up -d --build` — first run or rebuild images
- `docker compose down` — stop containers
- Solver API docs — **http://localhost:8080/api/docs**
- Advisor API docs — **http://localhost:8080/api/llm/docs**
- Local dev without Docker — use `run_dev.sh` / `run_dev.bat` (Assistant tab requires Docker)

### Troubleshooting Docker

**CoolProp build fails**: If you see compilation errors, try:
```bash
docker compose build --no-cache backend
```

**Healthcheck fails**: Verify backend is responding:
```bash
docker compose exec backend curl http://localhost:8749/health
```

**Port already in use**: Change host port mapping in `docker-compose.yml`:
```yaml
ports:
  - "8081:80"
```

---

## LLM Advisor

Independent chat service for plant operations guidance. Runs in its own container (`llm-advisor`) and uses Ollama for local inference. The thermodynamic solver backend is unchanged.

### Architecture

| Service | Port (internal) | Role |
|---------|-----------------|------|
| frontend (nginx) | 8080 (host) | SPA + proxies `/api/*` and `/api/llm/*` |
| backend | 8749 | Thermodynamic solver |
| llm-advisor | 11435 | Chat API |
| ollama | 11434 | Local LLM inference |

### Health check

```bash
curl http://localhost:8080/api/llm/health
```

- `"status": "healthy"` — Ollama reachable and model loaded
- `"status": "degraded"` — Ollama down or model not pulled (`model_ready: false`)

### Example chat

```bash
curl -X POST http://localhost:8080/api/llm/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "What affects heat rate at high ambient temperature?"}'
```

Send plant context from the **Assistant** tab (inputs + solver results after Calculate).

### Configuration

Edit `environment:` under `llm-advisor` in [`docker-compose.yml`](docker-compose.yml). See [`.env.example`](.env.example) for reference.

| Variable | Default | Purpose |
|----------|---------|---------|
| `OLLAMA_MODEL` | `smollm:135m` | Model tag |
| `TEMPERATURE` | `0.0` | Response creativity (0 = deterministic) |
| `MAX_TOKENS` | `256` | Max output tokens (`num_predict`) |
| `NUM_CTX` | `2048` | Context window per request |
| `OLLAMA_REQUEST_TIMEOUT` | `30` | Seconds |
| Ollama `mem_limit` | `800m` | Ollama container memory |
| LLM `mem_limit` | `512m` | Advisor container memory |

### Speed optimization (local dev)

The default Docker stack is tuned for **low RAM** and **fast responses** on limited hardware. Accuracy is secondary.

**Model comparison**

| Model | Pull size | RAM (approx) | Speed | Quality |
|-------|-----------|--------------|-------|---------|
| **smollm:135m** (default) | ~91 MB | ~150–250 MB | Fastest | Minimal — generic answers |
| qwen2.5:0.5b | ~400 MB | ~350–500 MB | Very fast | Better instruction-following |
| qwen2.5:1.5b | ~1 GB | ~1 GB | Fast | Better if 0.5b is too weak |
| tinyllama | ~637 MB | ~500 MB | Very fast | Basic fallback |
| llama3.2:1b | ~1.3 GB | ~1.2 GB | Fast | Higher RAM |
| phi3:mini | ~2 GB | ~2 GB | Medium | Avoid — breaks RAM budget |

**Memory budget (container caps)**

| Service | mem_limit |
|---------|-----------|
| ollama | 800m |
| llm-advisor | 512m |
| backend | 768m |
| frontend | 128m |

Expect **~2.0–2.5 GB host RAM** total including Docker overhead with `smollm:135m`.

**Quick start**

```bash
docker compose up -d --build
bash scripts/preload-model.sh
curl http://localhost:8080/api/llm/health
```

**Verification**

```bash
docker stats --no-stream
time curl -s -X POST http://localhost:8080/api/llm/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"What affects heat rate?"}'
```

First chat after cold start may take 3–5 s (model load). Subsequent chats should be under ~2 s on modest CPU hardware.

**Fallback models**

- Quality too poor → set `OLLAMA_MODEL: qwen2.5:0.5b` and raise ollama `mem_limit` to `1.2g`
- Need better answers → `qwen2.5:1.5b` with ollama `mem_limit: 1.5g`
- Still need more → `llama3.2:1b` with ollama `mem_limit: 1.5g`

**Settings that do not work** (do not use): `OLLAMA_LOAD_IN_4BIT` (not an Ollama env var — models are already quantized), `OLLAMA_NUM_GPU=0` (CPU is default without GPU devices).

### Troubleshooting LLM Advisor

**Advisor degraded / model not ready**:

```bash
bash scripts/preload-model.sh
```

**Chat returns 503**: Check Ollama is running: `docker compose ps`

**Out of memory**: Step up to `qwen2.5:1.5b` or increase `mem_limit` in compose; avoid `phi3:mini` on low-RAM hosts.

**GPU (optional)**: Add NVIDIA device reservation to the `ollama` service in `docker-compose.yml` (see `.env.example` comment).

---

## Application Tabs

| Tab | Description |
|-----|-------------|
| **P&ID Canvas** | Static engineering schematic with embedded input fields. Enter ambient conditions, GT output (Mode 1) or fuel flow (Mode 2), filter hours. Click **Calculate** or press `Ctrl+Enter`. Results populate in-place on the drawing. |
| **Performance** | OEM P_GT and ϑTII curves (gas + oil) vs T_CI. Compressor efficiency map: T3 and W_c iso-efficiency lines (η = 82–91%). Operating point highlighted on all charts. |
| **Thermodynamics** | T-s and P-h Brayton cycle diagrams. Isentropic vs actual compression and expansion paths. Six state points with full property table. |
| **Energy Balance** | Sankey energy flow (MW proportional). Heat balance table. Auxiliary load breakdown table. |
| **Filter ΔP** | Degradation curves for coalescer, pre-filter, and fine filter. Life-fraction progress bars. ISO 8 hPa reference line. Design-point consistency note. |
| **Assistant** | Chat with local LLM advisor. Uses current inputs and solver results as context. Requires Docker stack with Ollama model pulled. |

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

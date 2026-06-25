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
│   ├── preload-model.bat
│   ├── select-model.sh    ← Interactive model picker + compose update
│   ├── select-model.bat
│   ├── switch-model.sh    ← Quick model switch (CLI arg)
│   └── switch-model.bat
├── run_dev.sh      ← Linux/macOS launcher
├── run_dev.bat     ← Windows launcher
└── README.md
```

---

## Prerequisites

**Docker (recommended — full app + LLM Advisor)**

- Docker Engine + Docker Compose v2
- ~2–2.5 GB free RAM for default stack (`smollm:135m`)

**Local development only (no Assistant tab)**

| Tool | Version |
|------|---------|
| Python | 3.10+ |
| Node.js | 18+ |

```bash
pip install fastapi uvicorn pydantic CoolProp scipy numpy
cd frontend && npm install
```

---

## Quick start (Docker — full stack)

From the project root:

```bash
# 1. Build images and start all services (backend, frontend, llm-advisor, ollama)
docker compose up -d --build

# 2. Choose and pull an Ollama model (interactive menu)
bash scripts/select-model.sh

# 3. Open the app
# http://localhost:8080
```

**Windows** — use `scripts\select-model.bat` in step 2.

### What step 1 starts

| Service | Host URL | Role |
|---------|----------|------|
| frontend | http://localhost:8080 | React UI + nginx proxy |
| backend | via `/api/*` | Thermodynamic solver |
| llm-advisor | via `/api/llm/*` | Chat API |
| ollama | internal only | Local LLM inference |

### What step 2 does (`select-model.sh`)

The model selector script **only** manages Ollama + the advisor — it does **not** rebuild backend/frontend:

1. Starts Ollama (`docker compose up -d ollama`)
2. Pulls the chosen model (skips if already local)
3. Updates `OLLAMA_MODEL` in `docker-compose.yml`
4. Restarts `llm-advisor` with the new model
5. Warms the model and prints health status

Run step 1 first. Use `select-model` when you want to pick or change models.

### Verify everything is up

```bash
# Solver
curl http://localhost:8080/api/health

# LLM advisor (healthy = model loaded)
curl http://localhost:8080/api/llm/health

# All containers
docker compose ps
```

---

## Running with Docker

### First-time setup

```bash
docker compose up -d --build
bash scripts/select-model.sh          # pick model from menu
# or: bash scripts/switch-model.sh smollm:135m   # skip menu, use default
```

### Everyday use (already built)

```bash
docker compose up -d
```

Only needed if you changed code or `docker-compose.yml` images:

```bash
docker compose up -d --build
```

### Stop

```bash
docker compose down
```

### Rebuild a single service

```bash
docker compose build backend && docker compose up -d backend
docker compose build frontend && docker compose up -d frontend
docker compose build llm-advisor && docker compose up -d llm-advisor
```

### Useful URLs

| URL | Description |
|-----|-------------|
| http://localhost:8080 | Main app |
| http://localhost:8080/api/docs | Solver API (Swagger) |
| http://localhost:8080/api/llm/docs | Advisor API (Swagger) |

---

## Ollama model scripts

All scripts live in [`scripts/`](scripts/). Run from the **project root**.

| Script | Purpose |
|--------|---------|
| `select-model.sh` / `.bat` | Interactive menu — pick model, pull, update compose, restart advisor |
| `switch-model.sh` / `.bat` | Quick switch: `bash scripts/switch-model.sh <model>` |
| `preload-model.sh` / `.bat` | Pull + warm the model **already set** in `docker-compose.yml` (no model change) |

### Interactive model picker

```bash
bash scripts/select-model.sh
# or
./scripts/select-model.sh
```

Menu options: `smollm:135m` (default), `smollm:360m`, `tinyllama`, `qwen2.5:0.5b`, `qwen2.5:1.5b`, `llama3.2:1b`, `llama3.2:3b`, or custom.

### Quick switch (no menu)

```bash
bash scripts/switch-model.sh qwen2.5:0.5b
bash scripts/switch-model.sh tinyllama
```

Windows:

```bat
scripts\select-model.bat
scripts\switch-model.bat qwen2.5:0.5b
```

### Pull current compose model only

Use when `OLLAMA_MODEL` is already correct in `docker-compose.yml` and you just need to download/warm it:

```bash
bash scripts/preload-model.sh
```

### Typical workflows

**New install — I want the default fast model:**

```bash
docker compose up -d --build
bash scripts/switch-model.sh smollm:135m
```

**New install — I want to choose from the menu:**

```bash
docker compose up -d --build
bash scripts/select-model.sh
```

**Change model later (app already running):**

```bash
bash scripts/select-model.sh
# backend and frontend keep running; only ollama + llm-advisor are touched
```

**After git pull / code changes:**

```bash
docker compose up -d --build
bash scripts/preload-model.sh    # re-warm model if advisor was recreated
```

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

**Advisor health `degraded`**: Model not pulled — run `bash scripts/select-model.sh` or `bash scripts/preload-model.sh`.

---

## Running (Development — no Docker)

Solver + UI only. The **Assistant** tab does not work in this mode (requires Docker + Ollama).

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

Model selection is documented in [Ollama model scripts](#ollama-model-scripts) above.

Larger models (`llama3.2:3b`, `qwen2.5:1.5b`) may require raising ollama `mem_limit` in [`docker-compose.yml`](docker-compose.yml).

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

**Verification**

```bash
docker stats --no-stream
time curl -s -X POST http://localhost:8080/api/llm/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"What affects heat rate?"}'
```

First chat after cold start may take 3–5 s (model load). Subsequent chats should be under ~2 s on modest CPU hardware.

**Fallback models**

- Quality too poor → `bash scripts/switch-model.sh qwen2.5:0.5b` and raise ollama `mem_limit` to `1.2g`
- Need better answers → `bash scripts/switch-model.sh qwen2.5:1.5b` with ollama `mem_limit: 1.5g`
- Still need more → `bash scripts/switch-model.sh llama3.2:1b` with ollama `mem_limit: 1.5g`

**Settings that do not work** (do not use): `OLLAMA_LOAD_IN_4BIT` (not an Ollama env var — models are already quantized), `OLLAMA_NUM_GPU=0` (CPU is default without GPU devices).

### Troubleshooting LLM Advisor

**Advisor degraded / model not ready**:

```bash
bash scripts/select-model.sh
# or, if model is already set in compose:
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

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

1. Starts Ollama (`docker compose up -d ollama`) if it is not running
2. Pulls the chosen model (skips if already on disk)
3. Updates `OLLAMA_MODEL` in `docker-compose.yml`
4. **Recreates** `llm-advisor` so it picks up the new model env (`docker compose up -d --force-recreate llm-advisor`)
5. **Warms** the model in Ollama memory (`ollama run <model> ping`)
6. Prints advisor health from `http://localhost:8080/api/llm/health`

Run step 1 first. Use `select-model` when you want to pick or change models.

**You do not need** `docker compose build` for a model change — only Ollama pull + `llm-advisor` restart (handled by the script).

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
| `select-model.sh` / `.bat` | Interactive menu — pick model, pull, update compose, restart advisor, warm |
| `switch-model.sh` / `.bat` | Quick switch: `bash scripts/switch-model.sh <model>` (same steps as select, no menu) |
| `preload-model.sh` / `.bat` | Pull + warm the model in `docker-compose.yml` (no model change, no advisor restart) |

Shared logic is in [`scripts/model-switch.sh`](scripts/model-switch.sh) (`apply_model`, `warm_model`, `restart_advisor`, etc.).

### Which Docker services are touched

| Action | `ollama` | `llm-advisor` | `backend` | `frontend` | `docker compose build`? |
|--------|----------|---------------|-----------|------------|-------------------------|
| First-time `docker compose up -d --build` | start | start | start | start | yes (all images) |
| `select-model` / `switch-model` | ensure running, pull | **recreate** | — | — | **no** |
| `preload-model` | ensure running, pull, warm | — | — | — | **no** |
| Edit `llm-service/` code | — | **rebuild + up** | — | — | `llm-advisor` only |
| Edit `backend/` or `frontend/` code | — | — | rebuild | rebuild | that service only |

After a model switch, **only `llm-advisor` is recreated**. Backend and frontend keep running.

Manual equivalent of a model switch:

```bash
docker compose up -d ollama
docker compose exec -T ollama ollama pull qwen2.5:0.5b
# edit OLLAMA_MODEL in docker-compose.yml, then:
docker compose up -d --force-recreate llm-advisor
docker compose exec -T ollama ollama run qwen2.5:0.5b "ping"
curl http://localhost:8080/api/llm/health
```

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

### Initial model load and warming

**Pull** downloads model weights into the Ollama volume (`ollama_data`). **Warm** loads weights into RAM so the first chat is not painfully slow.

| Step | What happens | Who does it |
|------|----------------|-------------|
| Pull | `ollama pull <model>` — saves to disk | `select-model`, `switch-model`, or `preload-model` |
| Advisor restart | `llm-advisor` reads new `OLLAMA_MODEL` from compose | `select-model` / `switch-model` only |
| Warm | `ollama run <model> "ping"` — loads model into memory | all three scripts |

**First install** — pick a model after the stack is up:

```bash
docker compose up -d --build
bash scripts/select-model.sh          # interactive
# or
bash scripts/switch-model.sh smollm:135m   # non-interactive default
```

**Stack already running, model already set in compose** — pull + warm only (no advisor restart):

```bash
bash scripts/preload-model.sh
```

Reads `OLLAMA_MODEL` from [`docker-compose.yml`](docker-compose.yml). Override with:

```bash
OLLAMA_MODEL=qwen2.5:1.5b bash scripts/preload-model.sh
```

**After `docker compose down` / host reboot** — Ollama may still have the model on disk, but RAM is cold. Warm again before demos:

```bash
docker compose up -d
bash scripts/preload-model.sh
```

Warming on CPU can take **30 s–several minutes** for larger models (`qwen2.5:1.5b`, `llama3.2:3b`). The script prints `Warming model in memory...` and waits until `ollama run` finishes. `select-model` hides warm output; `preload-model` shows it.

Ollama keeps loaded models in memory for **`OLLAMA_KEEP_ALIVE`** (default `30m` in compose). Chats within that window reuse the loaded model.

Verify warm + healthy:

```bash
curl http://localhost:8080/api/llm/health
# expect: "status": "healthy", "model_ready": true

time curl -s -X POST http://localhost:8080/api/llm/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"ping"}'
```

### Typical workflows

**New install — default fast model:**

```bash
docker compose up -d --build
bash scripts/switch-model.sh smollm:135m
```

**New install — choose from menu:**

```bash
docker compose up -d --build
bash scripts/select-model.sh
```

**Change model while app is running** (solver + UI stay up):

```bash
bash scripts/switch-model.sh qwen2.5:1.5b
# or
bash scripts/select-model.sh
```

If the new model needs more RAM, edit `mem_limit` under `ollama` in `docker-compose.yml` **before** switching, then run the switch script (no full rebuild).

**After git pull** (code/images may have changed):

```bash
docker compose up -d --build
bash scripts/preload-model.sh    # re-pull + warm if advisor/ollama was recreated
```

**You changed only `OLLAMA_MODEL` by hand in compose** (no script):

```bash
docker compose up -d --force-recreate llm-advisor
bash scripts/preload-model.sh
```

**You changed `llm-service/` code**:

```bash
docker compose build llm-advisor && docker compose up -d llm-advisor
bash scripts/preload-model.sh
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

**Advisor health `degraded`**: Model not pulled or not warm — run `bash scripts/select-model.sh` or `bash scripts/preload-model.sh`.

**Stuck on "Warming model in memory..."**: Normal on CPU for larger models; wait or try a smaller model (`smollm:135m`, `qwen2.5:0.5b`). Use `preload-model.sh` to see warm progress (not hidden).

**Switched model but advisor still uses old one**: Run `bash scripts/switch-model.sh <model>` (updates compose + recreates `llm-advisor`). Editing compose alone is not enough until advisor is recreated.

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

| Variable | Default (compose) | Purpose |
|----------|-------------------|---------|
| `OLLAMA_MODEL` | `qwen2.5:0.5b` | Model tag |
| `TEMPERATURE` | `0.0` | Response creativity (0 = deterministic) |
| `MAX_TOKENS` | `128` | Max output tokens (`num_predict`) |
| `NUM_CTX` | `1024` | Context window per request |
| `OLLAMA_REQUEST_TIMEOUT` | `60` | Seconds |
| `OLLAMA_KEEP_ALIVE` (ollama) | `30m` | How long loaded model stays in RAM |
| Ollama `mem_limit` | `4g` | Ollama container memory |
| LLM `mem_limit` | `2g` | Advisor container memory |

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

**Memory budget (container caps — see [`docker-compose.yml`](docker-compose.yml))**

| Service | mem_limit (current) |
|---------|---------------------|
| ollama | 4g |
| llm-advisor | 2g |
| backend | 768m |
| frontend | 128m |

Tune down for low-RAM hosts (e.g. ollama `800m`–`1.5g`) and use `smollm:135m` or `qwen2.5:0.5b`.

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
bash scripts/select-model.sh       # pull + restart advisor + warm
# or, if OLLAMA_MODEL in compose is already correct:
bash scripts/preload-model.sh      # pull + warm only
```

**Wrong model after switch**: Recreate advisor — `docker compose up -d --force-recreate llm-advisor` or re-run `switch-model.sh`.

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

# Alfa Bank Hackathon

The project consists of four local services:

- React frontend on `http://localhost:5173`;
- Node.js backend on `http://localhost:5003`;
- deterministic scoring service on `http://localhost:8000`;
- local Llama 3.2 1B server on `http://localhost:8081`.

The scoring service makes all numerical credit decisions. The LLM only rewrites
validated scoring facts into a short client-facing explanation.

## Run everything with Docker Compose

Prerequisites:

1. Install and start Docker Desktop.
2. Make sure `.env` exists. For a new checkout:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Put the model at:

   ```text
   local-llm/models/Llama-3.2-1B-Instruct-Q4_K_M.gguf
   ```

   The current workspace already contains it. For a new checkout, download it:

   ```powershell
   New-Item -ItemType Directory -Force local-llm/models
   curl.exe -L --fail --output local-llm/models/Llama-3.2-1B-Instruct-Q4_K_M.gguf "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf?download=true"
   ```

Start all services from the repository root:

```powershell
docker compose up --build
```

If the project is already running manually, stop those four processes first.
Otherwise ports `5173`, `5003`, `8000`, and `8081` will already be occupied.

Wait until the backend and scoring services are healthy, then open:

```text
http://localhost:5173/#/login
```

Useful commands:

```powershell
docker compose ps
docker compose logs -f backend scoring llm
docker compose down
```

Run these commands from the repository root. The old
`backend/docker-compose.yaml` file is only a deprecation notice and must not be
used to start the project.

The Compose configuration uses the CPU-only `llama.cpp` server and mounts the
GGUF file read-only. Rebuilding containers does not copy or redownload the model.

## Run without Docker

Use four PowerShell terminals from the repository root.

Terminal 1 — local LLM:

```powershell
.\local-llm\start.ps1
```

Terminal 2 — scoring:

```powershell
cd ml
.\.venv\Scripts\python.exe -m uvicorn credit_scoring.main:app --host 127.0.0.1 --port 8000 --env-file ..\.env
```

Terminal 3 — backend:

```powershell
cd backend
npm run dev
```

Terminal 4 — frontend:

```powershell
cd frontend
$env:VITE_LOCAL_API_URL='http://localhost:5003'
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://localhost:5173/#/login`. Use `localhost`, not `127.0.0.1`, because
the backend CORS policy currently allows the frontend origin `http://localhost:5173`.

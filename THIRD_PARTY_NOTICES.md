# Third-Party Notices

This repository contains source code and configuration that use the following third-party software. This notice is informational and does not replace the license texts shipped by each dependency.

## Application libraries

| Component | Purpose | License / source |
|---|---|---|
| React, React DOM, React Router | Web UI and routing | MIT; npm packages and their bundled license files |
| Vite and `@vitejs/plugin-react` | Frontend build tooling | MIT; npm packages |
| Express, cors | HTTP backend | MIT; npm packages |
| `jsonwebtoken` | JWT handling | MIT; npm package |
| `bcryptjs` | Password hashing in the demo | MIT; npm package |
| Prisma client/tooling and `pg` | Declared backend data-access dependencies | Apache-2.0 (Prisma), MIT (node-postgres); npm packages |
| FastAPI, Uvicorn, HTTPX | Scoring HTTP service and client | MIT (FastAPI, HTTPX), BSD-3-Clause (Uvicorn); Python packages |
| pytest | ML test runner | MIT; Python package |
| Node.js SQLite API | In-memory demo persistence | Node.js runtime license; no copied SQLite source is stored here |

Exact resolved JavaScript versions are recorded in `backend/package-lock.json` and `frontend/package-lock.json`; Python version ranges are recorded in `ml/pyproject.toml`. Transitive dependency notices remain available in the corresponding installed packages and upstream distributions.

## Llama 3.2 model

The optional local explanation service is configured for `Llama-3.2-1B-Instruct`. Llama 3.2 model weights and derivatives are governed by the **Llama 3.2 Community License Agreement** and its Acceptable Use Policy, not by this repository's application-code license. Users must obtain the model from an authorized source, review the current Meta terms, and provide any attribution required by those terms. Model weights are not committed to this repository.

## GGUF quantization and llama.cpp

- The configured file name is `Llama-3.2-1B-Instruct-Q4_K_M.gguf`. `Q4_K_M` denotes a quantized derivative; quantization does not remove the underlying Llama license obligations.
- GGUF is the model container format used by the llama.cpp ecosystem.
- The runtime image is `ghcr.io/ggml-org/llama.cpp:server`. llama.cpp is distributed under the MIT License. The runtime is pulled separately and is not vendored into this repository.

No guarantee is made that a file found under the configured name is authentic or correctly licensed. Operators are responsible for provenance, checksum verification, and retaining the model's license and notice files.

## Mock integrations and data provenance

`backend/mockDatabase/fns_db.js`, `backend/mockDatabase/bki_db.js`, and `registry_internal` in the backend database are **synthetic demo fixtures**. They do not call the Federal Tax Service, a credit bureau, Alfa-Bank production systems, or any other real registry. Names, identifiers, financial values, credit events, and dates are fabricated for hackathon testing and must not be interpreted as information about real persons or companies.

The application uses no production customer data by design. Before connecting real sources, replace the mock adapters, establish lawful data-processing grounds, add retention/access controls, and review provider terms and applicable privacy, banking, and credit-reporting requirements.

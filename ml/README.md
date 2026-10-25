# Rule-based credit scoring

The service implements deterministic risk and approval scoring without a trained ML model.

## Run

```bash
py -m venv .venv
.venv\\Scripts\\activate
pip install -e .
uvicorn credit_scoring.main:app --reload --port 8000
```

## Test

The core has no third-party runtime dependencies, so its unit tests can run before FastAPI is installed:

```bash
py -m unittest discover -s tests -v
```

## API

- `GET /health`
- `POST /v1/evaluate`

Example request: `data/sample_request.json`.

In addition to FNS, BKI and internal-registry data, approval scoring requires application fields
(`requested_amount`, `requested_term_months`, `purpose`, `declared_annual_revenue`) and product
limits. The registries do not contain those values.

`default_probability` and `approval_probability` are heuristic, not calibrated on a real credit portfolio.

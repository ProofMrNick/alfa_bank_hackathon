# Rule-based credit scoring

The service implements deterministic risk and approval scoring without a trained ML model.

## Run

```bash
py -m venv .venv
.venv\\Scripts\\activate
pip install -e .
uvicorn credit_scoring.main:app --reload --port 8000 --env-file ../.env
```

## Test

The core has no third-party runtime dependencies, so its unit tests can run before FastAPI is installed:

```bash
py -m unittest discover -s tests -v
```

## API

- `GET /health`
- `POST /v1/evaluate`
- `POST /v1/applications/{application_id}/process` — evaluate and submit the decision to backend as the ML user

Example request: `data/sample_request.json`.

In addition to FNS, BKI and internal-registry data, approval scoring requires application fields
(`requested_amount`, `requested_term_months`, `purpose`, `declared_annual_revenue`) and product
limits. The registries do not contain those values.

## Backend authentication

The ML service never stores backend credentials in source code. It reads:

```env
ML_PASSWORD=12345678
```

The technical username is fixed as `ml`. Optional overrides are
`BACKEND_URL` (default `http://localhost:5003/api`) and
`ML_REQUEST_TIMEOUT_SECONDS` (default `10`).

`/v1/applications/{application_id}/process` logs in through `/auth/login`, caches the JWT,
and sends the policy result to `/bank/applications/{application_id}/decision`. On an expired
token (`401`), it logs in once again and retries the decision.

In Docker, pass the same file with `docker run --env-file ../.env ...`; credentials are not
copied into the image.

`default_probability` and `approval_probability` are heuristic, not calibrated on a real credit portfolio.

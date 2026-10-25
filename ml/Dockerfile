FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml ./
COPY src ./src
COPY artifacts ./artifacts

RUN pip install --no-cache-dir .

ENV SCORING_ARTIFACTS_DIR=/app/artifacts

EXPOSE 8000

CMD ["uvicorn", "credit_scoring.main:app", "--host", "0.0.0.0", "--port", "8000"]

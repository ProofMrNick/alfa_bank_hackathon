from __future__ import annotations

from functools import lru_cache

from fastapi import FastAPI, HTTPException

from .backend_client import BackendClient, BackendClientError
from .config import BackendSettings, ConfigurationError
from .schemas import (
    ApplicationData,
    BKIData,
    FNSData,
    InternalData,
    ProductData,
    ScoringContext,
)
from .service import ScoringService
from .validation import ScoringValidationError


app = FastAPI(title="Credit scoring service", version="1.0.0")
service = ScoringService()


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "risk_model_version": service.risk_scorer.config["version"],
        "approval_model_version": service.approval_scorer.config["version"],
    }


@app.post("/v1/evaluate")
def evaluate(payload: dict) -> dict:
    try:
        context = context_from_dict(payload)
        return service.evaluate(context).to_dict()
    except ScoringValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=[issue.__dict__ for issue in exc.issues],
        ) from exc
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/v1/applications/{application_id}/process")
async def process_application(application_id: int, payload: dict) -> dict:
    """Evaluate an application and submit its decision as the ML user."""
    try:
        context = context_from_dict(payload)
        if context.application_id is not None and context.application_id != application_id:
            raise ValueError("Path application_id does not match payload application_id")

        result = service.evaluate(context)
        if result.decision is None:
            raise ValueError("Application and product data are required for a decision")

        backend_response = await get_backend_client().submit_decision(
            application_id,
            result.decision,
        )
        return {
            "submitted": True,
            "backend_response": backend_response,
            "evaluation": result.to_dict(),
        }
    except ScoringValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=[issue.__dict__ for issue in exc.issues],
        ) from exc
    except (KeyError, TypeError, ValueError, ConfigurationError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except BackendClientError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@lru_cache(maxsize=1)
def get_backend_client() -> BackendClient:
    return BackendClient(BackendSettings.from_env())


def context_from_dict(payload: dict) -> ScoringContext:
    products = []
    for raw_product in payload.get("products", []):
        product = dict(raw_product)
        product["allowed_purposes"] = tuple(product.get("allowed_purposes", ()))
        products.append(ProductData(**product))

    return ScoringContext(
        application_id=payload.get("application_id"),
        trigger=payload.get("trigger", "SMART_SELECTION"),
        fns=FNSData(**payload["fns"]),
        bki=BKIData(**payload["bki"]) if payload.get("bki") else None,
        internal=InternalData(**payload["internal"]) if payload.get("internal") else None,
        application=(
            ApplicationData(**payload["application"])
            if payload.get("application")
            else None
        ),
        products=tuple(products),
    )

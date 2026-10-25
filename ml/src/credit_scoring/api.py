from __future__ import annotations

from fastapi import FastAPI, HTTPException

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

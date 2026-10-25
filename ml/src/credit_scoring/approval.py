from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from .features import safe_divide
from .schemas import ApplicationData, ApprovalResult, ProductData, RiskFeatures, RiskResult


class RuleBasedApprovalScorer:
    def __init__(self, config_path: Path | None = None):
        configured_dir = os.getenv("SCORING_ARTIFACTS_DIR")
        artifacts_dir = Path(configured_dir) if configured_dir else Path.cwd() / "artifacts"
        if not artifacts_dir.exists():
            artifacts_dir = Path(__file__).resolve().parents[2] / "artifacts"
        default_path = artifacts_dir / "approval_policy_v1.json"
        with (config_path or default_path).open("r", encoding="utf-8") as file:
            self.config: dict[str, Any] = json.load(file)

    def score(
        self,
        risk: RiskResult,
        features: RiskFeatures,
        application: ApplicationData,
        product: ProductData,
    ) -> ApprovalResult:
        reasons: list[str] = []
        warnings: list[str] = []
        eligibility_errors: list[str] = []

        if risk.stop_factors:
            eligibility_errors.append("Есть жёсткие стоп-факторы")
        if application.requested_amount < product.min_amount:
            eligibility_errors.append("Сумма ниже минимальной суммы продукта")
        if application.requested_amount > product.max_amount:
            eligibility_errors.append("Сумма превышает максимальную сумму продукта")
        if not product.min_term_months <= application.requested_term_months <= product.max_term_months:
            eligibility_errors.append("Срок не входит в диапазон продукта")
        if product.allowed_purposes and application.purpose not in product.allowed_purposes:
            eligibility_errors.append("Цель заявки не соответствует продукту")
        else:
            reasons.append("Цель соответствует продукту")

        verified_revenue = features.verified_annual_revenue
        if verified_revenue is None or verified_revenue <= 0:
            eligibility_errors.append("Недостаточно данных о выручке")

        preliminary_limit = self._preliminary_limit(features, product)
        if preliminary_limit < product.min_amount:
            eligibility_errors.append("Расчётный лимит ниже минимальной суммы продукта")

        if eligibility_errors:
            return ApprovalResult(
                product_id=product.id,
                product_name=product.name,
                eligible=False,
                approval_probability=0.0,
                fit_score=0.0,
                preliminary_limit=preliminary_limit,
                estimated_monthly_payment=None,
                payment_to_income_after_loan=None,
                loan_to_revenue=safe_divide(application.requested_amount, verified_revenue),
                reasons=tuple(reasons),
                warnings=tuple(eligibility_errors),
                model_version=str(self.config["version"]),
            )

        requested = application.requested_amount
        term = application.requested_term_months
        new_payment = annuity_payment(requested, product.base_rate, term)
        existing_payment = features.monthly_payment or 0.0
        monthly_income = verified_revenue / 12
        payment_to_income_after = (existing_payment + new_payment) / monthly_income
        loan_to_revenue = requested / verified_revenue
        limit_usage = safe_divide(requested, preliminary_limit) or 10.0

        base_probability = 0.15 + 0.80 * (risk.risk_score / 999)
        amount_factor = _band_factor(limit_usage, ((0.50, 1.00), (0.80, 0.95), (1.00, 0.80)), 0.35)
        ltr_factor = _band_factor(loan_to_revenue, ((0.10, 1.00), (0.25, 0.90), (0.40, 0.70)), 0.45)
        burden_factor = _band_factor(payment_to_income_after, ((0.30, 1.00), (0.50, 0.85), (0.65, 0.60)), 0.30)
        term_factor = 1.0 if term <= 12 else 0.95 if term <= 36 else 0.85
        relationship_factor = 1.03 if features.previous_products_closed_well else 1.0

        probability = base_probability * amount_factor * ltr_factor * burden_factor * term_factor * relationship_factor
        probability = max(0.01, min(0.97, probability))

        if requested <= preliminary_limit:
            reasons.append("Запрошенная сумма укладывается в предварительный лимит")
        else:
            warnings.append("Запрошенная сумма превышает предварительный лимит")
        if loan_to_revenue <= 0.25:
            reasons.append("Сумма кредита приемлема относительно выручки")
        else:
            warnings.append("Высокое отношение суммы кредита к выручке")
        if payment_to_income_after <= 0.50:
            reasons.append("Выручка позволяет обслуживать кредит")
        else:
            warnings.append("Высокая долговая нагрузка с учётом нового кредита")
        if features.previous_products_closed_well:
            reasons.append("Предыдущие продукты банка закрыты без нарушений")

        approval_probability = round(probability, 4)
        purpose_match = 1.0
        limit_coverage = min(1.0, preliminary_limit / requested)
        term_fit = 1.0 if term <= product.max_term_months else 0.0
        fit_score = (
            0.65 * approval_probability
            + 0.15 * purpose_match
            + 0.10 * limit_coverage
            + 0.10 * term_fit
        )

        return ApprovalResult(
            product_id=product.id,
            product_name=product.name,
            eligible=True,
            approval_probability=approval_probability,
            fit_score=round(min(1.0, fit_score), 4),
            preliminary_limit=preliminary_limit,
            estimated_monthly_payment=round(new_payment, 2),
            payment_to_income_after_loan=round(payment_to_income_after, 4),
            loan_to_revenue=round(loan_to_revenue, 4),
            reasons=tuple(reasons),
            warnings=tuple(warnings),
            model_version=str(self.config["version"]),
        )

    def _preliminary_limit(self, features: RiskFeatures, product: ProductData) -> float:
        candidates = [product.max_amount]
        if features.verified_annual_revenue:
            candidates.append(features.verified_annual_revenue * float(self.config["annual_revenue_limit_share"]))
        if features.avg_monthly_inflow:
            candidates.append(features.avg_monthly_inflow * float(self.config["monthly_inflow_multiple"]))

        limit = min(candidates)
        limit -= (features.total_debt or 0.0) * float(self.config["existing_debt_deduction_share"])
        limit = max(0.0, min(product.max_amount, limit))
        return round(limit / 1000) * 1000


def annuity_payment(principal: float, annual_rate_percent: float, months: int) -> float:
    monthly_rate = annual_rate_percent / 100 / 12
    if monthly_rate == 0:
        return principal / months
    factor = (1 + monthly_rate) ** months
    return principal * monthly_rate * factor / (factor - 1)


def _band_factor(
    value: float,
    bands: tuple[tuple[float, float], ...],
    fallback: float,
) -> float:
    for upper_bound, factor in bands:
        if value <= upper_bound:
            return factor
    return fallback

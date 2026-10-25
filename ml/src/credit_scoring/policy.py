from __future__ import annotations

from .schemas import (
    ApplicationData,
    ApprovalResult,
    DecisionResult,
    RiskFeatures,
    RiskResult,
)


def make_decision(
    risk: RiskResult,
    approval: ApprovalResult,
    features: RiskFeatures,
    application: ApplicationData,
    product_rate: float,
) -> DecisionResult:
    if risk.stop_factors:
        return DecisionResult(
            type="DECLINE",
            reason=risk.stop_factors[0],
        )

    missing_fields: list[str] = []
    if features.verified_annual_revenue is None:
        missing_fields.append("annual_revenue")
    if features.bki_report_found and features.monthly_payment is None:
        missing_fields.append("monthly_payment")

    if missing_fields:
        return DecisionResult(
            type="REQUEST_INFO",
            reason="MISSING_CRITICAL_DATA",
            missing_fields=tuple(missing_fields),
        )

    if not approval.eligible:
        return DecisionResult(type="DECLINE", reason="PRODUCT_REQUIREMENTS_NOT_MET")

    if risk.risk_level == "LOW" and approval.approval_probability >= 0.75:
        return DecisionResult(
            type="APPROVE",
            reason="AUTOMATIC_POLICY_APPROVAL",
            approved_amount=application.requested_amount,
            approved_term_months=application.requested_term_months,
            approved_rate=product_rate,
        )

    if risk.risk_level != "HIGH" and approval.approval_probability >= 0.40:
        offered_amount = min(application.requested_amount, approval.preliminary_limit)
        return DecisionResult(
            type="COUNTEROFFER",
            reason="AMOUNT_ADJUSTED_TO_RISK_LIMIT",
            approved_amount=offered_amount,
            approved_term_months=application.requested_term_months,
            approved_rate=product_rate,
        )

    return DecisionResult(type="DECLINE", reason="RISK_OUTSIDE_POLICY")

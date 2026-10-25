from __future__ import annotations

from datetime import date

from .schemas import RiskFeatures, ScoringContext
from .validation import parse_iso_date


def safe_divide(numerator: float | None, denominator: float | None) -> float | None:
    if numerator is None or denominator is None or denominator <= 0:
        return None
    return numerator / denominator


def months_between(start: date | None, end: date) -> int | None:
    if start is None:
        return None
    months = (end.year - start.year) * 12 + end.month - start.month
    if end.day < start.day:
        months -= 1
    return max(0, months)


def build_features(context: ScoringContext, *, today: date | None = None) -> RiskFeatures:
    today = today or date.today()
    bki = context.bki
    internal = context.internal
    application = context.application

    registration_date = parse_iso_date(context.fns.registration_date, "fns.registration_date")
    company_age_months = months_between(registration_date, today) or 0

    declared_revenue = application.declared_annual_revenue if application else None
    bank_observed_revenue = (
        internal.avg_monthly_inflow * 12
        if internal and internal.avg_monthly_inflow is not None
        else None
    )

    if declared_revenue is not None and bank_observed_revenue is not None:
        # Conservative for a demo: use the smaller confirmed amount.
        verified_revenue = min(declared_revenue, bank_observed_revenue)
    else:
        verified_revenue = declared_revenue or bank_observed_revenue

    monthly_income = verified_revenue / 12 if verified_revenue else None
    payment_to_income = safe_divide(bki.monthly_payment if bki else None, monthly_income)
    debt_to_revenue = safe_divide(bki.total_debt if bki else None, verified_revenue)
    revenue_confirmation = safe_divide(bank_observed_revenue, declared_revenue)

    inflow = internal.avg_monthly_inflow if internal else None
    outflow = internal.avg_monthly_outflow if internal else None
    cash_flow_margin = safe_divide(
        inflow - outflow if inflow is not None and outflow is not None else None,
        inflow,
    )

    account_opened_date = parse_iso_date(
        internal.account_opened_date if internal else None,
        "internal.account_opened_date",
    )
    bki_report_date = parse_iso_date(bki.report_date if bki else None, "bki.report_date")
    internal_snapshot_date = parse_iso_date(
        internal.snapshot_date if internal else None,
        "internal.snapshot_date",
    )

    return RiskFeatures(
        company_status=context.fns.status,
        company_age_months=company_age_months,
        declared_annual_revenue=declared_revenue,
        verified_annual_revenue=verified_revenue,
        revenue_confirmation_ratio=revenue_confirmation,
        active_loans_count=bki.active_loans_count if bki else None,
        total_debt=bki.total_debt if bki else None,
        monthly_payment=bki.monthly_payment if bki else None,
        payment_to_income=payment_to_income,
        current_debt_to_revenue=debt_to_revenue,
        delinquencies_12m_count=bki.delinquencies_12m_count if bki else None,
        max_delinquency_days=bki.max_delinquency_days if bki else None,
        has_default=bool(bki.has_default) if bki else False,
        bki_report_found=bool(bki and bki.report_status == "FOUND"),
        bki_report_age_days=(today - bki_report_date).days if bki_report_date else None,
        has_account=bool(internal and internal.has_account),
        account_age_months=months_between(account_opened_date, today),
        avg_monthly_inflow=inflow,
        avg_monthly_outflow=outflow,
        cash_flow_margin=cash_flow_margin,
        acquiring_monthly_volume=internal.acquiring_monthly_volume if internal else None,
        blocked_115fz=bool(internal and internal.blocked_115fz),
        previous_products_closed_well=(
            bool(internal.previous_products_closed_well)
            if internal and internal.previous_products_closed_well is not None
            else None
        ),
        internal_snapshot_age_days=(
            (today - internal_snapshot_date).days if internal_snapshot_date else None
        ),
    )

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal


RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]
DecisionType = Literal["APPROVE", "COUNTEROFFER", "REQUEST_INFO", "DECLINE"]
Impact = Literal["POSITIVE", "NEGATIVE", "NEUTRAL", "STOP"]


@dataclass(frozen=True)
class FNSData:
    inn: str
    ogrn: str
    name: str
    legal_form: str
    registration_date: str
    status: str
    okved_main: str | None = None
    okved_additional: str | None = None
    tax_regime: str | None = None
    msp_category: str | None = None
    msp_registry_date: str | None = None
    edo_participant: int = 0
    head_name: str | None = None
    head_position: str | None = None


@dataclass(frozen=True)
class BKIData:
    inn: str
    report_status: str
    active_loans_count: int | None = None
    total_debt: float | None = None
    monthly_payment: float | None = None
    delinquencies_12m_count: int | None = None
    max_delinquency_days: int | None = None
    has_default: int = 0
    report_date: str | None = None


@dataclass(frozen=True)
class InternalData:
    inn: str
    has_account: int
    account_opened_date: str | None = None
    avg_monthly_inflow: float | None = None
    avg_monthly_outflow: float | None = None
    acquiring_monthly_volume: float | None = None
    blocked_115fz: int = 0
    previous_products_closed_well: int | None = None
    snapshot_date: str | None = None


@dataclass(frozen=True)
class ApplicationData:
    requested_amount: float
    requested_term_months: int
    purpose: str
    declared_annual_revenue: float | None = None
    product_id: int | str | None = None


@dataclass(frozen=True)
class ProductData:
    id: int | str
    name: str
    min_amount: float
    max_amount: float
    min_term_months: int
    max_term_months: int
    base_rate: float
    allowed_purposes: tuple[str, ...] = ()


@dataclass(frozen=True)
class ScoringContext:
    fns: FNSData
    bki: BKIData | None = None
    internal: InternalData | None = None
    application: ApplicationData | None = None
    products: tuple[ProductData, ...] = ()
    application_id: int | None = None
    trigger: str = "SMART_SELECTION"


@dataclass(frozen=True)
class RiskFeatures:
    company_status: str
    company_age_months: int
    declared_annual_revenue: float | None
    verified_annual_revenue: float | None
    revenue_confirmation_ratio: float | None
    active_loans_count: int | None
    total_debt: float | None
    monthly_payment: float | None
    payment_to_income: float | None
    current_debt_to_revenue: float | None
    delinquencies_12m_count: int | None
    max_delinquency_days: int | None
    has_default: bool
    bki_report_found: bool
    bki_report_age_days: int | None
    has_account: bool
    account_age_months: int | None
    avg_monthly_inflow: float | None
    avg_monthly_outflow: float | None
    cash_flow_margin: float | None
    acquiring_monthly_volume: float | None
    blocked_115fz: bool
    previous_products_closed_well: bool | None
    internal_snapshot_age_days: int | None


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    field: str
    message: str
    severity: Literal["ERROR", "WARNING"]


@dataclass(frozen=True)
class Factor:
    code: str
    impact: Impact
    message: str
    points: int = 0
    value: float | int | str | bool | None = None


@dataclass(frozen=True)
class RiskResult:
    risk_score: int
    risk_level: RiskLevel
    default_probability: float
    probability_kind: str
    stop_factors: tuple[str, ...]
    factors: tuple[Factor, ...]
    model_version: str


@dataclass(frozen=True)
class ApprovalResult:
    product_id: int | str
    product_name: str
    eligible: bool
    approval_probability: float
    fit_score: float
    preliminary_limit: float
    estimated_monthly_payment: float | None
    payment_to_income_after_loan: float | None
    loan_to_revenue: float | None
    reasons: tuple[str, ...]
    warnings: tuple[str, ...]
    model_version: str


@dataclass(frozen=True)
class DecisionResult:
    type: DecisionType
    reason: str
    approved_amount: float | None = None
    approved_term_months: int | None = None
    approved_rate: float | None = None
    missing_fields: tuple[str, ...] = ()


@dataclass(frozen=True)
class EvaluationResult:
    risk: RiskResult
    recommendations: tuple[ApprovalResult, ...]
    decision: DecisionResult | None
    validation_warnings: tuple[ValidationIssue, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

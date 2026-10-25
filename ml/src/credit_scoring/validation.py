from __future__ import annotations

from datetime import date, datetime

from .schemas import ScoringContext, ValidationIssue


class ScoringValidationError(ValueError):
    def __init__(self, issues: list[ValidationIssue]):
        self.issues = issues
        super().__init__("; ".join(issue.message for issue in issues))


def parse_iso_date(value: str | None, field: str) -> date | None:
    if value is None:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"{field} must use YYYY-MM-DD format") from exc


def validate_context(
    context: ScoringContext,
    *,
    today: date | None = None,
) -> tuple[ValidationIssue, ...]:
    today = today or date.today()
    issues: list[ValidationIssue] = []

    def error(code: str, field: str, message: str) -> None:
        issues.append(ValidationIssue(code, field, message, "ERROR"))

    def warning(code: str, field: str, message: str) -> None:
        issues.append(ValidationIssue(code, field, message, "WARNING"))

    inn = context.fns.inn
    if not inn.isdigit() or len(inn) not in (10, 12):
        error("INVALID_INN", "fns.inn", "INN must contain 10 or 12 digits")

    if context.bki and context.bki.inn != inn:
        error("INN_MISMATCH", "bki.inn", "BKI INN does not match FNS INN")
    if context.internal and context.internal.inn != inn:
        error("INN_MISMATCH", "internal.inn", "Internal registry INN does not match FNS INN")

    if context.fns.status not in {"ACTIVE", "LIQUIDATION"}:
        error("INVALID_COMPANY_STATUS", "fns.status", "Unsupported company status")
    if context.fns.legal_form not in {"IP", "OOO"}:
        warning("UNKNOWN_LEGAL_FORM", "fns.legal_form", "Unknown legal form")
    _check_binary(issues, "fns.edo_participant", context.fns.edo_participant)

    try:
        registration_date = parse_iso_date(context.fns.registration_date, "fns.registration_date")
        if registration_date and registration_date > today:
            error("FUTURE_REGISTRATION_DATE", "fns.registration_date", "Registration date is in the future")
    except ValueError as exc:
        error("INVALID_DATE", "fns.registration_date", str(exc))

    _validate_date_not_future(issues, "fns.msp_registry_date", context.fns.msp_registry_date, today)

    if context.bki:
        if context.bki.report_status not in {"FOUND", "NOT_FOUND"}:
            error("INVALID_BKI_STATUS", "bki.report_status", "BKI report_status must be FOUND or NOT_FOUND")
        _check_non_negative(issues, "bki.active_loans_count", context.bki.active_loans_count)
        _check_non_negative(issues, "bki.total_debt", context.bki.total_debt)
        _check_non_negative(issues, "bki.monthly_payment", context.bki.monthly_payment)
        _check_non_negative(issues, "bki.delinquencies_12m_count", context.bki.delinquencies_12m_count)
        _check_non_negative(issues, "bki.max_delinquency_days", context.bki.max_delinquency_days)
        _check_binary(issues, "bki.has_default", context.bki.has_default)
        _validate_date_not_future(issues, "bki.report_date", context.bki.report_date, today)

    if context.internal:
        _check_non_negative(issues, "internal.avg_monthly_inflow", context.internal.avg_monthly_inflow)
        _check_non_negative(issues, "internal.avg_monthly_outflow", context.internal.avg_monthly_outflow)
        _check_non_negative(issues, "internal.acquiring_monthly_volume", context.internal.acquiring_monthly_volume)
        _check_binary(issues, "internal.has_account", context.internal.has_account)
        _check_binary(issues, "internal.blocked_115fz", context.internal.blocked_115fz)
        if context.internal.previous_products_closed_well is not None:
            _check_binary(
                issues,
                "internal.previous_products_closed_well",
                context.internal.previous_products_closed_well,
            )
        _validate_date_not_future(
            issues,
            "internal.account_opened_date",
            context.internal.account_opened_date,
            today,
        )
        _validate_date_not_future(
            issues,
            "internal.snapshot_date",
            context.internal.snapshot_date,
            today,
        )

    if context.application:
        _check_positive(issues, "application.requested_amount", context.application.requested_amount)
        _check_positive(issues, "application.requested_term_months", context.application.requested_term_months)
        if context.application.declared_annual_revenue is not None:
            _check_positive(
                issues,
                "application.declared_annual_revenue",
                context.application.declared_annual_revenue,
            )

    for index, product in enumerate(context.products):
        prefix = f"products[{index}]"
        _check_positive(issues, f"{prefix}.min_amount", product.min_amount)
        _check_positive(issues, f"{prefix}.max_amount", product.max_amount)
        _check_positive(issues, f"{prefix}.min_term_months", product.min_term_months)
        _check_positive(issues, f"{prefix}.max_term_months", product.max_term_months)
        if product.min_amount > product.max_amount:
            error("INVALID_PRODUCT_LIMITS", prefix, "Product min_amount exceeds max_amount")
        if product.min_term_months > product.max_term_months:
            error("INVALID_PRODUCT_TERMS", prefix, "Product min term exceeds max term")

    if context.application and context.application.product_id is not None:
        product_ids = {product.id for product in context.products}
        if context.application.product_id not in product_ids:
            error(
                "PRODUCT_NOT_FOUND",
                "application.product_id",
                "Selected product is absent from products",
            )

    errors = [issue for issue in issues if issue.severity == "ERROR"]
    if errors:
        raise ScoringValidationError(errors)
    return tuple(issue for issue in issues if issue.severity == "WARNING")


def _check_non_negative(
    issues: list[ValidationIssue],
    field: str,
    value: float | int | None,
) -> None:
    if value is not None and value < 0:
        issues.append(ValidationIssue("NEGATIVE_VALUE", field, f"{field} cannot be negative", "ERROR"))


def _check_positive(
    issues: list[ValidationIssue],
    field: str,
    value: float | int,
) -> None:
    if value <= 0:
        issues.append(ValidationIssue("NON_POSITIVE_VALUE", field, f"{field} must be positive", "ERROR"))


def _check_binary(
    issues: list[ValidationIssue],
    field: str,
    value: int,
) -> None:
    if value not in (0, 1):
        issues.append(ValidationIssue("INVALID_BOOLEAN", field, f"{field} must be 0 or 1", "ERROR"))


def _validate_date_not_future(
    issues: list[ValidationIssue],
    field: str,
    value: str | None,
    today: date,
) -> None:
    try:
        parsed = parse_iso_date(value, field)
    except ValueError as exc:
        issues.append(ValidationIssue("INVALID_DATE", field, str(exc), "ERROR"))
        return
    if parsed and parsed > today:
        issues.append(ValidationIssue("FUTURE_DATE", field, f"{field} is in the future", "ERROR"))

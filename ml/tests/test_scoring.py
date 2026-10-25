from __future__ import annotations

import sys
import unittest
from datetime import date
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from credit_scoring.schemas import (  # noqa: E402
    ApplicationData,
    BKIData,
    FNSData,
    InternalData,
    ProductData,
    ScoringContext,
)
from credit_scoring.service import ScoringService  # noqa: E402
from credit_scoring.validation import ScoringValidationError  # noqa: E402


TODAY = date(2026, 10, 25)


def good_context(**overrides) -> ScoringContext:
    fns = overrides.get("fns") or FNSData(
        inn="7700000099",
        ogrn="1027700000000",
        name="ООО Надёжный бизнес",
        legal_form="OOO",
        registration_date="2018-05-10",
        status="ACTIVE",
    )
    bki = overrides.get("bki") or BKIData(
        inn="7700000099",
        report_status="FOUND",
        active_loans_count=1,
        total_debt=1_000_000,
        monthly_payment=80_000,
        delinquencies_12m_count=0,
        max_delinquency_days=0,
        has_default=0,
    )
    internal = overrides.get("internal") or InternalData(
        inn="7700000099",
        has_account=1,
        account_opened_date="2020-01-10",
        avg_monthly_inflow=5_000_000,
        avg_monthly_outflow=3_800_000,
        acquiring_monthly_volume=1_000_000,
        blocked_115fz=0,
        previous_products_closed_well=1,
    )
    application = overrides.get("application") or ApplicationData(
        requested_amount=3_000_000,
        requested_term_months=24,
        purpose="WORKING_CAPITAL",
        declared_annual_revenue=60_000_000,
        product_id=1,
    )
    product = ProductData(
        id=1,
        name="Оборотный кредит",
        min_amount=500_000,
        max_amount=10_000_000,
        min_term_months=3,
        max_term_months=36,
        base_rate=15.0,
        allowed_purposes=("WORKING_CAPITAL",),
    )
    return ScoringContext(
        fns=fns,
        bki=bki,
        internal=internal,
        application=application,
        products=(product,),
        application_id=432890,
        trigger="PRE_DECISION",
    )


class ScoringTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = ScoringService()

    def test_good_client_gets_low_risk_and_approval(self) -> None:
        result = self.service.evaluate(good_context(), today=TODAY)

        self.assertEqual(result.risk.risk_level, "LOW")
        self.assertGreaterEqual(result.risk.risk_score, 750)
        self.assertFalse(result.risk.stop_factors)
        self.assertGreaterEqual(result.recommendations[0].approval_probability, 0.75)
        self.assertEqual(result.decision.type, "APPROVE")

    def test_115fz_is_hard_stop(self) -> None:
        internal = InternalData(
            inn="7700000099",
            has_account=1,
            avg_monthly_inflow=5_000_000,
            avg_monthly_outflow=3_800_000,
            blocked_115fz=1,
        )
        result = self.service.evaluate(good_context(internal=internal), today=TODAY)

        self.assertIn("BLOCKED_115FZ", result.risk.stop_factors)
        self.assertEqual(result.risk.risk_level, "HIGH")
        self.assertEqual(result.decision.type, "DECLINE")
        self.assertEqual(result.recommendations[0].approval_probability, 0.0)

    def test_severe_delinquency_is_hard_stop(self) -> None:
        bki = BKIData(
            inn="7700000099",
            report_status="FOUND",
            total_debt=1_000_000,
            monthly_payment=80_000,
            delinquencies_12m_count=2,
            max_delinquency_days=90,
            has_default=0,
        )
        result = self.service.evaluate(good_context(bki=bki), today=TODAY)

        self.assertIn("SEVERE_DELINQUENCY", result.risk.stop_factors)
        self.assertEqual(result.decision.type, "DECLINE")

    def test_amount_above_product_max_is_ineligible(self) -> None:
        application = ApplicationData(
            requested_amount=20_000_000,
            requested_term_months=24,
            purpose="WORKING_CAPITAL",
            declared_annual_revenue=60_000_000,
            product_id=1,
        )
        result = self.service.evaluate(good_context(application=application), today=TODAY)

        self.assertFalse(result.recommendations[0].eligible)
        self.assertEqual(result.recommendations[0].approval_probability, 0.0)
        self.assertEqual(result.decision.type, "DECLINE")

    def test_mismatched_inn_is_rejected(self) -> None:
        bki = BKIData(inn="7800000099", report_status="NOT_FOUND")

        with self.assertRaises(ScoringValidationError):
            self.service.evaluate(good_context(bki=bki), today=TODAY)

    def test_invalid_boolean_is_rejected(self) -> None:
        internal = InternalData(
            inn="7700000099",
            has_account=1,
            blocked_115fz=2,
        )
        with self.assertRaises(ScoringValidationError):
            self.service.evaluate(good_context(internal=internal), today=TODAY)

    def test_future_registry_date_is_rejected(self) -> None:
        bki = BKIData(
            inn="7700000099",
            report_status="FOUND",
            has_default=0,
            report_date="2030-01-01",
        )
        with self.assertRaises(ScoringValidationError):
            self.service.evaluate(good_context(bki=bki), today=TODAY)

    def test_same_input_is_deterministic(self) -> None:
        first = self.service.evaluate(good_context(), today=TODAY).to_dict()
        second = self.service.evaluate(good_context(), today=TODAY).to_dict()
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()

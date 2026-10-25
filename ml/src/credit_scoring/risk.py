from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Any

from .schemas import Factor, RiskFeatures, RiskResult


class RuleBasedRiskScorer:
    def __init__(self, config_path: Path | None = None):
        configured_dir = os.getenv("SCORING_ARTIFACTS_DIR")
        artifacts_dir = Path(configured_dir) if configured_dir else Path.cwd() / "artifacts"
        if not artifacts_dir.exists():
            artifacts_dir = Path(__file__).resolve().parents[2] / "artifacts"
        default_path = artifacts_dir / "risk_scorecard_v1.json"
        with (config_path or default_path).open("r", encoding="utf-8") as file:
            self.config: dict[str, Any] = json.load(file)

    def score(self, features: RiskFeatures) -> RiskResult:
        score = int(self.config["base_score"])
        factors: list[Factor] = []
        stop_factors = self._stop_factors(features, factors)

        def apply(code: str, points: int, message: str, value: Any = None) -> None:
            nonlocal score
            score += points
            impact = "POSITIVE" if points > 0 else "NEGATIVE" if points < 0 else "NEUTRAL"
            factors.append(Factor(code, impact, message, points, value))

        age = features.company_age_months
        if age >= 60:
            apply("BUSINESS_AGE_60_PLUS", 90, "Бизнес работает более 5 лет", age)
        elif age >= 36:
            apply("BUSINESS_AGE_36_PLUS", 70, "Бизнес работает более 3 лет", age)
        elif age >= 24:
            apply("BUSINESS_AGE_24_PLUS", 45, "Бизнес работает более 2 лет", age)
        elif age >= 12:
            apply("BUSINESS_AGE_12_PLUS", 15, "Бизнес работает более года", age)
        elif age >= 6:
            apply("YOUNG_BUSINESS", -50, "Бизнес зарегистрирован менее года", age)
        elif age >= 3:
            apply("VERY_YOUNG_BUSINESS", -120, "Бизнес зарегистрирован менее 6 месяцев", age)

        if not features.bki_report_found:
            apply("BKI_NOT_FOUND", -40, "Кредитная история не найдена")
        else:
            active_loans = features.active_loans_count
            if active_loans == 0:
                apply("NO_ACTIVE_LOANS", 10, "Действующие кредиты отсутствуют", 0)
            elif active_loans is not None and active_loans >= 6:
                apply("MANY_ACTIVE_LOANS", -70, "У клиента много действующих кредитов", active_loans)
            elif active_loans is not None and active_loans >= 4:
                apply("SEVERAL_ACTIVE_LOANS", -30, "У клиента несколько действующих кредитов", active_loans)

            delinquencies = features.delinquencies_12m_count
            if delinquencies == 0:
                apply("NO_DELINQUENCIES", 80, "За 12 месяцев просрочки отсутствуют", 0)
            elif delinquencies is not None and delinquencies <= 2:
                apply("FEW_DELINQUENCIES", -30, "За 12 месяцев были единичные просрочки", delinquencies)
            elif delinquencies is not None and delinquencies <= 5:
                apply("REPEATED_DELINQUENCIES", -100, "За 12 месяцев было несколько просрочек", delinquencies)
            elif delinquencies is not None:
                apply("MANY_DELINQUENCIES", -180, "За 12 месяцев было много просрочек", delinquencies)

            dpd = features.max_delinquency_days
            if dpd == 0:
                apply("ZERO_MAX_DPD", 30, "Длительные просрочки отсутствуют", 0)
            elif dpd is not None and dpd <= 30:
                apply("DPD_UP_TO_30", -60, "Максимальная просрочка не превышает 30 дней", dpd)
            elif dpd is not None and dpd <= 60:
                apply("DPD_31_TO_60", -160, "Была просрочка от 31 до 60 дней", dpd)

            if features.bki_report_age_days is not None:
                if features.bki_report_age_days > 180:
                    apply("BKI_REPORT_VERY_STALE", -40, "Данные БКИ старше 180 дней", features.bki_report_age_days)
                elif features.bki_report_age_days > 90:
                    apply("BKI_REPORT_STALE", -20, "Данные БКИ старше 90 дней", features.bki_report_age_days)

        burden = features.payment_to_income
        if burden is None:
            apply("PAYMENT_BURDEN_UNKNOWN", -30, "Не удалось рассчитать текущую долговую нагрузку")
        elif burden < 0.20:
            apply("LOW_PAYMENT_BURDEN", 70, "Низкая текущая долговая нагрузка", round(burden, 4))
        elif burden < 0.40:
            apply("MODERATE_PAYMENT_BURDEN", 20, "Умеренная текущая долговая нагрузка", round(burden, 4))
        elif burden < 0.60:
            apply("ELEVATED_PAYMENT_BURDEN", -70, "Повышенная текущая долговая нагрузка", round(burden, 4))
        else:
            apply("HIGH_PAYMENT_BURDEN", -160, "Высокая текущая долговая нагрузка", round(burden, 4))

        debt_ratio = features.current_debt_to_revenue
        if debt_ratio is not None:
            if debt_ratio < 0.15:
                apply("LOW_DEBT_TO_REVENUE", 50, "Долг невысок относительно выручки", round(debt_ratio, 4))
            elif debt_ratio < 0.35:
                apply("MODERATE_DEBT_TO_REVENUE", 20, "Долг приемлем относительно выручки", round(debt_ratio, 4))
            elif debt_ratio < 0.60:
                apply("ELEVATED_DEBT_TO_REVENUE", -50, "Долг повышен относительно выручки", round(debt_ratio, 4))
            else:
                apply("HIGH_DEBT_TO_REVENUE", -130, "Долг высок относительно выручки", round(debt_ratio, 4))

        if features.has_account:
            apply("HAS_BANK_ACCOUNT", 25, "У клиента открыт расчётный счёт в банке")
        if features.account_age_months is not None:
            if features.account_age_months >= 36:
                apply("LONG_BANK_RELATIONSHIP", 25, "Клиент обслуживается в банке более 3 лет")
            elif features.account_age_months >= 12:
                apply("ESTABLISHED_BANK_RELATIONSHIP", 10, "Клиент обслуживается в банке более года")

        if features.previous_products_closed_well is True:
            apply("GOOD_PREVIOUS_PRODUCTS", 50, "Предыдущие продукты банка закрыты без нарушений")
        if features.acquiring_monthly_volume is not None and features.acquiring_monthly_volume > 0:
            apply("HAS_ACQUIRING_TURNOVER", 10, "Эквайринг подтверждает операционную деятельность")
        if features.internal_snapshot_age_days is not None and features.internal_snapshot_age_days > 180:
            apply("INTERNAL_DATA_STALE", -20, "Внутренние данные банка старше 180 дней", features.internal_snapshot_age_days)

        confirmation = features.revenue_confirmation_ratio
        if confirmation is not None:
            if 0.70 <= confirmation <= 1.30:
                apply("REVENUE_CONFIRMED", 40, "Обороты по счёту подтверждают заявленную выручку", round(confirmation, 4))
            elif 0.50 <= confirmation < 0.70:
                apply("REVENUE_PARTIALLY_CONFIRMED", -40, "Обороты подтверждают выручку только частично", round(confirmation, 4))
            elif confirmation < 0.50:
                apply("REVENUE_NOT_CONFIRMED", -100, "Обороты существенно ниже заявленной выручки", round(confirmation, 4))
            else:
                apply("INFLOW_EXCEEDS_DECLARED_REVENUE", 0, "Обороты выше заявленной выручки; требуется проверка", round(confirmation, 4))

        margin = features.cash_flow_margin
        if margin is not None:
            if margin >= 0.20:
                apply("STRONG_CASH_FLOW", 30, "Положительный запас денежного потока", round(margin, 4))
            elif margin >= 0:
                apply("POSITIVE_CASH_FLOW", 10, "Денежный поток положительный", round(margin, 4))
            else:
                apply("NEGATIVE_CASH_FLOW", -80, "Средние расходы превышают поступления", round(margin, 4))

        minimum = int(self.config["score_range"]["min"])
        maximum = int(self.config["score_range"]["max"])
        score = max(minimum, min(maximum, score))
        if stop_factors:
            score = min(score, int(self.config["stop_score_cap"]))

        low_from = int(self.config["risk_levels"]["low_from"])
        medium_from = int(self.config["risk_levels"]["medium_from"])
        risk_level = "LOW" if score >= low_from else "MEDIUM" if score >= medium_from else "HIGH"

        center = float(self.config["probability"]["center"])
        scale = float(self.config["probability"]["scale"])
        probability = 1.0 / (1.0 + math.exp((score - center) / scale))
        probability = max(0.005, min(0.95, probability))
        if stop_factors:
            probability = max(probability, 0.95)

        return RiskResult(
            risk_score=score,
            risk_level=risk_level,
            default_probability=round(probability, 4),
            probability_kind="HEURISTIC_NOT_CALIBRATED",
            stop_factors=tuple(stop_factors),
            factors=tuple(factors),
            model_version=str(self.config["version"]),
        )

    def _stop_factors(self, features: RiskFeatures, factors: list[Factor]) -> list[str]:
        stops: list[tuple[str, str, Any]] = []
        if features.company_status == "LIQUIDATION":
            stops.append(("COMPANY_LIQUIDATION", "Компания находится в процессе ликвидации", features.company_status))
        if features.company_age_months < 3:
            stops.append(("BUSINESS_TOO_YOUNG", "Компания зарегистрирована менее 3 месяцев", features.company_age_months))
        if features.has_default:
            stops.append(("PREVIOUS_DEFAULT", "В кредитной истории зафиксирован дефолт", True))
        if features.max_delinquency_days is not None and features.max_delinquency_days > 60:
            stops.append(("SEVERE_DELINQUENCY", "Максимальная просрочка превышает 60 дней", features.max_delinquency_days))
        if features.blocked_115fz:
            stops.append(("BLOCKED_115FZ", "Зафиксирована блокировка по 115-ФЗ", True))
        critical_ratio = float(self.config["critical_debt_to_revenue"])
        if features.current_debt_to_revenue is not None and features.current_debt_to_revenue >= critical_ratio:
            stops.append(("CRITICAL_DEBT", "Долг превышает критический уровень относительно выручки", round(features.current_debt_to_revenue, 4)))

        for code, message, value in stops:
            factors.append(Factor(code, "STOP", message, 0, value))
        return [code for code, _, _ in stops]

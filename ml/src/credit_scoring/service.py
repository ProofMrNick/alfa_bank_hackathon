from __future__ import annotations

from datetime import date

from .approval import RuleBasedApprovalScorer
from .features import build_features
from .policy import make_decision
from .risk import RuleBasedRiskScorer
from .schemas import EvaluationResult, ScoringContext
from .validation import validate_context


class ScoringService:
    def __init__(self) -> None:
        self.risk_scorer = RuleBasedRiskScorer()
        self.approval_scorer = RuleBasedApprovalScorer()

    def evaluate(
        self,
        context: ScoringContext,
        *,
        today: date | None = None,
    ) -> EvaluationResult:
        validation_warnings = validate_context(context, today=today)
        features = build_features(context, today=today)
        risk = self.risk_scorer.score(features)

        recommendations = []
        if context.application:
            recommendations = [
                self.approval_scorer.score(risk, features, context.application, product)
                for product in context.products
            ]
            recommendations.sort(key=lambda item: item.fit_score, reverse=True)

        decision = None
        if context.application and recommendations:
            selected = self._select_application_product(context, recommendations)
            selected_product = next(
                product for product in context.products if product.id == selected.product_id
            )
            decision = make_decision(
                risk,
                selected,
                features,
                context.application,
                selected_product.base_rate,
            )

        return EvaluationResult(
            risk=risk,
            recommendations=tuple(recommendations),
            decision=decision,
            validation_warnings=validation_warnings,
        )

    @staticmethod
    def _select_application_product(context: ScoringContext, recommendations):
        product_id = context.application.product_id if context.application else None
        if product_id is not None:
            for recommendation in recommendations:
                if recommendation.product_id == product_id:
                    return recommendation
        return recommendations[0]

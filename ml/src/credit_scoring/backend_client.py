from __future__ import annotations

from typing import Any

import httpx

from .config import BackendSettings
from .schemas import DecisionResult


class BackendClientError(RuntimeError):
    """Raised when the ML service cannot authenticate or submit a decision."""


class BackendClient:
    def __init__(self, settings: BackendSettings):
        self.settings = settings
        self._token: str | None = None

    async def login(self) -> None:
        """Authenticate the ML technical user and cache its JWT."""
        try:
            async with httpx.AsyncClient(timeout=self.settings.timeout_seconds) as client:
                response = await client.post(
                    f"{self.settings.base_url}/auth/login",
                    json={
                        "username": self.settings.username,
                        "password": self.settings.password,
                    },
                )
        except httpx.HTTPError as exc:
            raise BackendClientError(f"Backend login request failed: {exc}") from exc

        if response.status_code >= 400:
            raise BackendClientError(
                f"Backend rejected ML login with status {response.status_code}"
            )

        token = response.json().get("token")
        if not token:
            raise BackendClientError("Backend login response does not contain token")
        self._token = token

    async def submit_decision(
        self,
        application_id: int,
        decision: DecisionResult,
        *,
        comment: str | None = None,
    ) -> dict[str, Any]:
        """Send the policy decision using the authenticated ML account."""
        if self._token is None:
            await self.login()

        payload = build_decision_payload(decision, comment=comment)
        response = await self._post_decision(application_id, payload)

        # JWT may expire while the ML service is running. Refresh once on 401.
        if response.status_code == 401:
            await self.login()
            response = await self._post_decision(application_id, payload)

        if response.status_code >= 400:
            body = response.text[:500]
            raise BackendClientError(
                f"Backend rejected decision with status {response.status_code}: {body}"
            )

        if not response.content:
            return {"status": response.status_code}
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            return response.json()
        return {"status": response.status_code, "body": response.text}

    async def _post_decision(
        self,
        application_id: int,
        payload: dict[str, Any],
    ) -> httpx.Response:
        try:
            async with httpx.AsyncClient(timeout=self.settings.timeout_seconds) as client:
                return await client.post(
                    (
                        f"{self.settings.base_url}/bank/applications/"
                        f"{application_id}/decision"
                    ),
                    headers={"Authorization": f"Bearer {self._token}"},
                    json=payload,
                )
        except httpx.HTTPError as exc:
            raise BackendClientError(f"Decision request failed: {exc}") from exc


def build_decision_payload(
    decision: DecisionResult,
    *,
    comment: str | None = None,
) -> dict[str, Any]:
    """Convert the Python policy result to the Node.js endpoint contract."""
    payload: dict[str, Any] = {
        "type": decision.type,
        "comment": comment or _default_comment(decision),
    }

    if decision.type in {"APPROVE", "COUNTEROFFER"}:
        payload.update(
            {
                "approvedAmount": decision.approved_amount,
                "approvedTermMonths": decision.approved_term_months,
                "approvedRate": decision.approved_rate,
            }
        )
    elif decision.type == "REQUEST_INFO":
        payload["missingFields"] = [
            _BACKEND_FIELD_NAMES.get(field, field)
            for field in decision.missing_fields
        ]
    elif decision.type == "DECLINE":
        payload["reason"] = decision.reason

    return payload


_BACKEND_FIELD_NAMES = {
    "annual_revenue": "annualRevenue",
    "monthly_payment": "monthlyPayment",
    "total_debt": "totalDebt",
    "registration_date": "registrationDate",
    "requested_amount": "requestedAmount",
    "requested_term_months": "requestedTermMonths",
}


def _default_comment(decision: DecisionResult) -> str:
    if decision.type == "APPROVE":
        return "Заявка одобрена автоматической кредитной политикой"
    if decision.type == "COUNTEROFFER":
        return "Предложены условия в пределах рассчитанного лимита"
    if decision.type == "REQUEST_INFO":
        return "Для продолжения рассмотрения необходимы дополнительные данные"
    return f"Заявка отклонена: {decision.reason}"

# Диаграмма состояний заявки

```mermaid
stateDiagram-v2
    [*] --> DRAFT: create
    DRAFT --> SUBMITTED: submit
    SUBMITTED --> ENRICHMENT: orchestrator
    ENRICHMENT --> SCORING: data collected
    SCORING --> APPROVED: APPROVE
    SCORING --> COUNTEROFFER: COUNTEROFFER
    SCORING --> NEED_MORE_INFO: REQUEST_INFO
    SCORING --> DECLINED: DECLINE
    SCORING --> UNDER_REVIEW: service unavailable / no decision
    UNDER_REVIEW --> APPROVED: employee APPROVE
    UNDER_REVIEW --> COUNTEROFFER: employee COUNTEROFFER
    UNDER_REVIEW --> NEED_MORE_INFO: employee REQUEST_INFO
    UNDER_REVIEW --> DECLINED: employee DECLINE
    UNDER_REVIEW --> SUBMITTED: manual rescore
    NEED_MORE_INFO --> SUBMITTED: client clarify
    APPROVED --> ACCEPTED: client accept
    APPROVED --> CANCELLED: client decline
    COUNTEROFFER --> ACCEPTED: client accept
    COUNTEROFFER --> CANCELLED: client decline
    ACCEPTED --> [*]
    CANCELLED --> [*]
    DECLINED --> [*]
```

## Канонический словарь

| Слой | Значения |
|---|---|
| Статусы заявки | `DRAFT`, `SUBMITTED`, `ENRICHMENT`, `SCORING`, `UNDER_REVIEW`, `NEED_MORE_INFO`, `APPROVED`, `COUNTEROFFER`, `DECLINED`, `ACCEPTED`, `CANCELLED` |
| Решения scoring/сотрудника | `APPROVE`, `COUNTEROFFER`, `REQUEST_INFO`, `DECLINE` |
| Действия клиента | `POST /applications/{localId}/accept`, `POST /applications/{localId}/decline`, `POST /applications/{localId}/clarify` |

Каждый переход статуса автоматически создаёт строку в `applications_logs`. Повторный scoring не перезаписывает старый результат, а создаёт следующую версию в `scoring_results` с trigger `CLARIFICATION` или `MANUAL_REVIEW`.

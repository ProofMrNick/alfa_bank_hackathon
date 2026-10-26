const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'

export async function runInitialMLAssertion(application, bki, fns, internal_registry, risk_score) {
    console.log(`[ML] Отправка заявки ${application.global_id} на оценку...`)

    try {
        const response = await fetch(
            `${ML_SERVICE_URL}/v1/applications/${application.global_id}/process`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    application,
                    bki,
                    fns,
                    internal_registry,
                    risk_score
                })
            }
        )

        if (!response.ok) {
            const err = await response.text()
            console.error(`[ML] Ошибка ${response.status}:`, err)
            return null
        }

        const result = await response.json()
        console.log(`[ML] Заявка ${application.global_id} обработана:`, result)
        return result

    } catch (error) {
        console.warn(`[ML] Сервис недоступен: ${error.message}. Используем rule-based fallback.`)
        
        // Fallback: rule-based решение прямо в Node.js
        await ruleBasedFallback(application, bki, fns, internal_registry)
    }
}

// Fallback когда ML не запущен
async function ruleBasedFallback(application, bki, fns, internal_registry) {
    const { run } = await import('./db.js')  // ваш db
    
    let decision = {
        type: 'APPROVE',
        approvedAmount: application.loan_sum,
        approvedTermMonths: application.loan_duration,
        approvedRate: application.loan_interest,
        missingFields: null,
        reason: null,
        comment: 'Автоматическое одобрение (rule-based fallback)'
    }

    // Базовая проверка
    if (bki?.has_default || internal_registry?.blocked_115fz) {
        decision.type = 'DECLINE'
        decision.approvedAmount = null
        decision.approvedTermMonths = null
        decision.approvedRate = null
        decision.reason = 'Высокий риск (rule-based)'
    }

    // Отправляем как "менеджер"
    console.log(`[ML fallback] Decision для заявки ${application.global_id}:`, decision.type)
}
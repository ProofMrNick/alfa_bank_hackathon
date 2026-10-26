const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://127.0.0.1:8081'
export const LLM_MODEL = process.env.LLM_MODEL || 'Llama-3.2-1B-Instruct-Q4_K_M'
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 15000)

function cleanExplanation(value) {
    return String(value || '')
        .replace(/^\s*["«]/, '')
        .replace(/["»]\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 360)
}

async function generateExplanation(recommendation, context) {
    const sourceSentence = [
        `${recommendation.product_name} соответствует цели «${context.purposeLabel.toLowerCase()}»`,
        'запрошенная сумма находится в предварительном лимите',
        'а подтверждённая выручка позволяет обслуживать кредит',
    ].join(', ')
    const prompt = [
        `Перефразируй одним естественным предложением: «${sourceSentence}».`,
        'Не добавляй факты, числа или обещания.',
        'Верни только готовое предложение.',
    ].join(' ')

    const response = await fetch(`${LLM_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        body: JSON.stringify({
            model: LLM_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'Ты редактор банковских текстов. Пиши только по-русски, кратко и точно. Не принимай кредитных решений.',
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0,
            max_tokens: 70,
            stream: false,
        }),
    })

    if (!response.ok) {
        throw new Error(`LLM returned ${response.status}`)
    }

    const body = await response.json()
    const explanation = cleanExplanation(body.choices?.[0]?.message?.content)
    if (!explanation) {
        throw new Error('LLM returned an empty explanation')
    }
    if (/[0-9A-Za-z]/.test(explanation)) {
        throw new Error('LLM explanation contains forbidden digits or Latin characters')
    }
    return explanation
}

export async function enrichRecommendationsWithLlm(recommendations, context) {
    return Promise.all(recommendations.map(async (recommendation) => {
        try {
            const explanation = await generateExplanation(recommendation, context)
            return {
                ...recommendation,
                description: explanation,
                ai_explanation: explanation,
                llm_used: true,
                llm_model: LLM_MODEL,
            }
        } catch (err) {
            console.warn(`LLM explanation unavailable for product ${recommendation.product_id}:`, err.message)
            return {
                ...recommendation,
                description: context.purposeLabel,
                ai_explanation: null,
                llm_used: false,
                llm_model: LLM_MODEL,
            }
        }
    }))
}

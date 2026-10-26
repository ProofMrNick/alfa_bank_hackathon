import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import http from 'node:http'

let backendServer
let scoringServer
let baseUrl
let evaluationCount = 0

function listen(server) {
    return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
}

function close(server) {
    return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

async function api(path, { token, ...options } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
    })
    const body = await response.json().catch(() => null)
    return { response, body }
}

before(async () => {
    scoringServer = http.createServer((request, response) => {
        if (request.method !== 'POST' || request.url !== '/v1/evaluate') {
            response.writeHead(404).end()
            return
        }
        evaluationCount += 1
        const needsInfo = evaluationCount === 1
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({
            risk: {
                risk_score: needsInfo ? 580 : 810,
                risk_level: needsInfo ? 'MEDIUM' : 'LOW',
                default_probability: needsInfo ? 0.2 : 0.04,
                model_version: 'e2e-stub',
                stop_factors: [],
                factors: [{ code: 'E2E', impact: 'POSITIVE', message: 'Dynamic test factor', points: 10 }],
            },
            recommendations: [],
            decision: needsInfo
                ? { type: 'REQUEST_INFO', reason: 'MISSING_CRITICAL_DATA', missing_fields: ['monthly_payment'] }
                : { type: 'APPROVE', reason: 'AUTOMATIC_POLICY_APPROVAL', approved_amount: 500000, approved_term_months: 12, approved_rate: 12.5 },
            validation_warnings: [],
        }))
    })
    await listen(scoringServer)
    process.env.SCORING_URL = `http://127.0.0.1:${scoringServer.address().port}`
    process.env.SIMULATE_ACTIVITY = 'false'
    const { startServer } = await import('../src/server.js')
    backendServer = startServer(0)
    await new Promise((resolve) => backendServer.once('listening', resolve))
    baseUrl = `http://127.0.0.1:${backendServer.address().port}/api`
})

after(async () => {
    await Promise.all([close(backendServer), close(scoringServer)])
})

test('submit -> enrichment -> scoring -> clarification -> decision -> client action uses returned ids', async () => {
    const password = 'e2e-password'
    let result = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            username: 'e2e-client', password, inn: '7700000004',
            email: 'e2e@example.local', companyName: 'ООО E2E',
        }),
    })
    assert.equal(result.response.status, 200)
    const clientToken = result.body.token

    result = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'employee', password: process.env.EMPLOYEE_PASSWORD }),
    })
    assert.equal(result.response.status, 200)
    const employeeToken = result.body.token

    result = await api('/applications', {
        method: 'POST', token: clientToken,
        body: JSON.stringify({ loan_id: 1, loan_sum: 500000, loan_duration: 12, purpose: 'WORKING_CAPITAL' }),
    })
    assert.equal(result.response.status, 201)
    assert.equal(result.body.status, 'NEED_MORE_INFO')
    const localId = result.body.local_id
    const globalId = result.body.global_id
    assert.ok(localId)
    assert.ok(globalId)

    result = await api(`/bank/applications/${globalId}`, { token: employeeToken })
    assert.equal(result.response.status, 200)
    assert.equal(result.body.application.global_id, globalId)
    assert.equal(result.body.scoring.version, 1)

    result = await api(`/applications/${localId}/clarify`, {
        method: 'POST', token: clientToken,
        body: JSON.stringify({ bki_data: { monthly_payment: 0, report_date: '2026-10-26' } }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.body.data.status, 'APPROVED')

    result = await api(`/bank/applications/${globalId}`, { token: employeeToken })
    assert.equal(result.body.scoring.version, 2)
    assert.equal(result.body.scoring.trigger, 'CLARIFICATION')
    const statuses = result.body.history.map((item) => item.new_status)
    assert.deepEqual(statuses.slice(0, 5), ['DRAFT', 'SUBMITTED', 'ENRICHMENT', 'SCORING', 'NEED_MORE_INFO'])
    assert.ok(statuses.includes('APPROVED'))

    result = await api(`/applications/${localId}/accept`, { method: 'POST', token: clientToken })
    assert.equal(result.response.status, 200)
    assert.equal(result.body.status, 'ACCEPTED')
})

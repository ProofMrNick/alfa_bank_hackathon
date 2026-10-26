// simulateActivity.js
const BASE_URL = 'http://localhost:5003/api';

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiCall(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    try {
        const res = await fetch(url, options);
        const data = await res.json().catch(() => null);
        
        if (!res.ok) {
            console.log(`  ❌ ${options.method || 'GET'} ${endpoint} → ${res.status}:`, data?.error || data?.message);
            return { ok: false, status: res.status, data };
        }
        
        console.log(`  ✅ ${options.method || 'GET'} ${endpoint} → ${res.status}`);
        return { ok: true, status: res.status, data };
    } catch (error) {
        console.log(`  ❌ ${endpoint} → ОШИБКА:`, error.message);
        return { ok: false, error: error.message };
    }
}

export async function simulateActivity() {
    console.log('\n🎭 === НАЧАЛО СИМУЛЯЦИИ АКТИВНОСТИ ===\n');

    // ============================================
    // 1. ПУБЛИЧНЫЕ ЭНДПОИНТЫ
    // ============================================
    console.log('📋 [Публичные эндпоинты]');
    await apiCall('/health');
    const products = await apiCall('/products');
    const loanIds = products.data?.map(p => p.id || p.loan_id) || [1, 2, 3];

    await delay(500);

    // ============================================
    // 2. РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЕЛЕЙ
    // ============================================
    console.log('\n👤 [Регистрация пользователей]');
    
    const clients = [
        { username: 'client', password: '12345678', email: 'ivanov@test.local', inn: '7700000001', companyName: 'ИП Иванов И.И.' },
        { username: 'client2', password: '12345678', email: 'petrov@test.local', inn: '7700000002', companyName: 'ООО "Петров и партнёры"' },
        { username: 'client3', password: '12345678', email: 'sidorov@test.local', inn: '7700000003', companyName: 'ИП Сидоров С.С.' }
    ];
    
    const employee = { username: 'employee', password: '12345678', email: 'manager@alfa.local', inn: '7700000099', companyName: 'Альфа-Банк' };

    for (const client of clients) {
        await apiCall('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(client)
        });
        await delay(200);
    }


    // ============================================
    // 3. ЛОГИН
    // ============================================
    console.log('\n🔐 [Авторизация]');
    
    const tokens = {};
    for (const client of clients) {
        const res = await apiCall('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: client.username, password: client.password })
        });
        if (res.ok) tokens[client.username] = res.data.token;
        await delay(200);
    }

    const empLogin = await apiCall('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: employee.username, password: employee.password })
    });
    const employeeToken = empLogin.ok ? empLogin.data.token : null;

    // ============================================
    // 4. ДЕЙСТВИЯ КЛИЕНТОВ (Dashboard, заявки)
    // ============================================
    console.log('\n💼 [Действия клиентов]');

    for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        const token = tokens[client.username];
        const authHeaders = { 'Authorization': token, 'Content-Type': 'application/json' };
        const localId = i + 1;

        console.log(`\n  👨 Клиент: ${client.username}`);

        // Dashboard
        await apiCall('/client/dashboard', { headers: authHeaders });
        await delay(300);

        // Recommendations
        await apiCall('/client/recommendations', { headers: authHeaders });
        await delay(300);

        // Список заявок
        await apiCall('/applications', { headers: authHeaders });
        await delay(200);

        // Подача заявки
        const loanId = loanIds[i % loanIds.length];
        await apiCall(`/applications/${localId}/submit`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                loan_id: loanId,
                loan_sum: 300000 + i * 200000,
                loan_interest: 12.5,
                loan_duration: 36 + i * 12
            })
        });
        await delay(300);

        // История заявки
        await apiCall(`/applications/${localId}/history`, { headers: authHeaders });
        await delay(200);
    }

    // ============================================
    // 5. ДЕЙСТВИЯ СОТРУДНИКА БАНКА
    // ============================================
    console.log('\n🏦 [Действия сотрудника банка]');
    
    if (!employeeToken) {
        console.log('  ⚠️  Сотрудник не авторизован, пропускаем банковские операции');
    } else {
        const empHeaders = { 'Authorization': employeeToken, 'Content-Type': 'application/json' };

        // Просмотр всех заявок
        const allApps = await apiCall('/bank/applications', { headers: empHeaders });
        await delay(500);

        // Просмотр деталей каждой заявки
        const appIds = allApps.data?.map(a => a.global_id || a.id) || [1, 2, 3];

        for (let i = 0; i < appIds.length; i++) {
            const applId = appIds[i];
            console.log(`\n  📄 Заявка #${applId}`);

            // Детали заявки
            const appDetails = await apiCall(`/bank/applications/${applId}`, { headers: empHeaders });
            await delay(300);

            // Информация о клиенте по INN
            const inn = appDetails.data?.inn || clients[i]?.inn;
            if (inn) {
                await apiCall(`/bank/clients/${inn}`, { headers: empHeaders });
                await delay(300);
            }

            // История заявки
            await apiCall(`/bank/applications/${applId}/history`, { headers: empHeaders });
            await delay(200);

            // Принятие решения (разные сценарии)
            let decision;
            if (i === 0) {
                // Одобрение
                decision = {
                    type: 'APPROVE',
                    approvedAmount: 500000,
                    approvedTermMonths: 60,
                    approvedRate: 12.5,
                    missingFields: null,
                    reason: null,
                    comment: 'Отличная кредитная история, заявка одобрена'
                };
            } else if (i === 1) {
                // Запрос недостающих документов
                decision = {
                    type: 'REQUEST_INFO',
                    approvedAmount: null,
                    approvedTermMonths: null,
                    approvedRate: null,
                    missingFields: 'passport,snils',
                    reason: null,
                    comment: 'Необходимо загрузить паспорт и СНИЛС'
                };
            } else {
                // Отклонение
                decision = {
                    type: 'DECLINE',
                    approvedAmount: null,
                    approvedTermMonths: null,
                    approvedRate: null,
                    missingFields: null,
                    reason: 'Недостаточный доход для запрошенной суммы',
                    comment: 'Заявка отклонена'
                };
            }

            await apiCall(`/bank/applications/${applId}/decision`, {
                method: 'POST',
                headers: empHeaders,
                body: JSON.stringify(decision)
            });
            await delay(500);
        }
    }

    // ============================================
    // 6. КЛИЕНТЫ УТОЧНЯЮТ ДАННЫЕ (clarify)
    // ============================================
    console.log('\n📝 [Уточнение данных клиентами]');

    // Только клиент с local_id = 2 (у которого запросили документы)
    const clarifyToken = tokens[clients[1]?.username];
    if (clarifyToken) {
        await apiCall('/applications/2/clarify', {
            method: 'POST',
            headers: { 'Authorization': clarifyToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bki_data: {
                    active_loans_count: 1,
                    total_debt: 250000,
                    monthly_payment: 15000,
                    delinquencies_12m_count: 0,
                    has_default: 0,
                    report_date: '2026-10-25'
                },
                fns_data: {
                    ogrn: '1187746000000',
                    tax_regime: 'USN',
                    msp_category: 'SMALL',
                    edo_participant: 1
                },
                internal_data: {
                    has_account: 1,
                    account_opened_date: '2020-05-15',
                    avg_monthly_inflow: 1500000,
                    avg_monthly_outflow: 1200000,
                    acquiring_monthly_volume: 400000,
                    blocked_115fz: 0,
                    previous_products_closed_well: 2,
                    snapshot_date: '2026-10-25'
                }
            })
        });
    }

    await delay(500);

    // ============================================
    // 7. ПОВТОРНАЯ ПРОВЕРКА КЛИЕНТАМИ
    // ============================================
    console.log('\n🔄 [Повторная проверка статусов]');

    for (const client of clients) {
        const token = tokens[client.username];
        if (!token) continue;
        const authHeaders = { 'Authorization': token };

        await apiCall('/applications', { headers: authHeaders });
        await delay(300);
    }

    // Финальный health-check
    await apiCall('/health');

    console.log('\n🎉 === СИМУЛЯЦИЯ ЗАВЕРШЕНА ===\n');
}
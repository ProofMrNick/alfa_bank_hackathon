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
            console.log(`  [FAIL] ${options.method || 'GET'} ${endpoint} -> ${res.status}:`, data?.error || data?.message);
            return { ok: false, status: res.status, data };
        }
        
        console.log(`  [OK] ${options.method || 'GET'} ${endpoint} -> ${res.status}`);
        return { ok: true, status: res.status, data };
    } catch (error) {
        console.log(`  [ERROR] ${endpoint}:`, error.message);
        return { ok: false, error: error.message };
    }
}

export async function simulateActivity() {
    console.log('\n=== НАЧАЛО СИМУЛЯЦИИ АКТИВНОСТИ ===\n');

    // 1. ПУБЛИЧНЫЕ ЭНДПОИНТЫ
    console.log('[Публичные эндпоинты]');
    await apiCall('/health');
    const products = await apiCall('/products');
    const loanIds = products.data?.map(p => p.id || p.loan_id) || [1, 2, 3];
    await delay(500);

    // 2. РЕГИСТРАЦИЯ 4 КЛИЕНТОВ + 1 СОТРУДНИК
    console.log('\n[Регистрация пользователей]');
    
    const clients = [
        // ХОРОШИЙ клиент
        { username: 'ivanov', password: process.env.CLIENT_PASSWORD1, email: 'ivanov@test.local', 
          inn: '7700000001', companyName: 'ООО "Вектор"' },
        // ПЛОХОЙ клиент
        { username: 'petrov', password: process.env.CLIENT_PASSWORD2, email: 'petrov@test.local', 
          inn: '7700000002', companyName: 'ООО "Вектор-Трейд"' },
        // СРЕДНИЙ клиент
        { username: 'sidorov', password: process.env.CLIENT_PASSWORD3, email: 'sidorov@test.local', 
          inn: '7700000003', companyName: 'ИП Сидоров А.М.' },
        // НЕДОСТАТОК ДАННЫХ (новый клиент)
        { username: 'novikov', password: process.env.CLIENT_PASSWORD4, email: 'novikov@test.local', 
          inn: '7700000004', companyName: 'ООО "Старт"' }
    ];
    
    const employee = { 
        username: 'employee', password: process.env.EMPLOYEE_PASSWORD, 
        email: 'manager@alfa.local', inn: '7700000099', companyName: 'Альфа-Банк' 
    };

    for (const client of clients) {
        await apiCall('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(client)
        });
        await delay(200);
    }

    await apiCall('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employee)
    });

    // 3. ЛОГИН
    console.log('\n[Авторизация]');
    
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

    if (!employeeToken) {
        console.log('  Сотрудник не авторизован, симуляция прервана');
        return;
    }
    const empHeaders = { 'Authorization': employeeToken, 'Content-Type': 'application/json' };

    // 4. ИСТОРИЧЕСКИЕ ЗАЯВКИ (прошлое)
    console.log('\n[Исторические заявки - прошлое]');

    // ИВАНОВ (хороший): local_id=1
    console.log('\n  Иванов - заявка local_id=1 (историческая)');
    await apiCall('/applications/1/submit', {
        method: 'POST',
        headers: { 'Authorization': tokens.ivanov, 'Content-Type': 'application/json' },
        body: JSON.stringify({ loan_id: loanIds[0], loan_sum: 800000, loan_interest: 12.5, loan_duration: 36 })
    });
    await delay(300);

    // ПЕТРОВ (плохой): local_id=1
    console.log('\n  Петров - заявка local_id=1 (историческая)');
    await apiCall('/applications/1/submit', {
        method: 'POST',
        headers: { 'Authorization': tokens.petrov, 'Content-Type': 'application/json' },
        body: JSON.stringify({ loan_id: loanIds[0], loan_sum: 3000000, loan_interest: 14.0, loan_duration: 60 })
    });
    await delay(300);

    // СИДОРОВ (средний): local_id=1
    console.log('\n  Сидоров - заявка local_id=1 (историческая)');
    await apiCall('/applications/1/submit', {
        method: 'POST',
        headers: { 'Authorization': tokens.sidorov, 'Content-Type': 'application/json' },
        body: JSON.stringify({ loan_id: loanIds[1], loan_sum: 500000, loan_interest: 13.0, loan_duration: 24 })
    });
    await delay(300);

    // 5. БАНК ПРИНИМАЕТ РЕШЕНИЯ ПО ИСТОРИЧЕСКИМ ЗАЯВКАМ
    console.log('\n[Решения банка по историческим заявкам]');

    // Иванов - ОДОБРЕНО (OFFER -> ACCEPTED)
    console.log('\n  Заявка Иванова -> ОДОБРЕНО');
    await apiCall('/bank/applications/1/decision', {
        method: 'POST',
        headers: empHeaders,
        body: JSON.stringify({
            type: 'APPROVE',
            approvedAmount: 800000,
            approvedTermMonths: 36,
            approvedRate: 12.5,
            missingFields: null,
            reason: null,
            comment: 'Отличная кредитная история, заявка одобрена'
        })
    });
    await delay(400);

    // Клиент принимает оффер
    console.log('\n  Иванов принимает оффер');
    await apiCall('/applications/1/acceptOffer', {
        method: 'POST',
        headers: { 'Authorization': tokens.ivanov }
    });
    await delay(300);

    // Петров - ОТКЛОНЕНО
    console.log('\n  Заявка Петрова -> ОТКЛОНЕНО');
    await apiCall('/bank/applications/2/decision', {
        method: 'POST',
        headers: empHeaders,
        body: JSON.stringify({
            type: 'DECLINE',
            approvedAmount: null,
            approvedTermMonths: null,
            approvedRate: null,
            missingFields: null,
            reason: 'Высокий риск дефолта, блокировка по 115-ФЗ',
            comment: 'Заявка отклонена'
        })
    });
    await delay(400);

    // Сидоров - ОДОБРЕНО (OFFER -> ACCEPTED)
    console.log('\n  Заявка Сидорова -> ОДОБРЕНО (уменьшенная сумма)');
    await apiCall('/bank/applications/3/decision', {
        method: 'POST',
        headers: empHeaders,
        body: JSON.stringify({
            type: 'APPROVE',
            approvedAmount: 400000,
            approvedTermMonths: 24,
            approvedRate: 13.5,
            missingFields: null,
            reason: null,
            comment: 'Одобрено с уменьшением суммы из-за небольшой просрочки в прошлом'
        })
    });
    await delay(400);

    // Клиент принимает оффер
    console.log('\n  Сидоров принимает оффер');
    await apiCall('/applications/1/acceptOffer', {
        method: 'POST',
        headers: { 'Authorization': tokens.sidorov }
    });
    await delay(300);

    // 6. ТЕКУЩИЕ ЗАЯВКИ (все 4 подают сейчас)
    console.log('\n[Текущие заявки - все 4 клиента подают]');

    // ИВАНОВ: local_id=2
    console.log('\n  Иванов - заявка local_id=2 (текущая)');
    await apiCall('/applications/2/submit', {
        method: 'POST',
        headers: { 'Authorization': tokens.ivanov, 'Content-Type': 'application/json' },
        body: JSON.stringify({ loan_id: loanIds[1], loan_sum: 1200000, loan_interest: 12.0, loan_duration: 48 })
    });
    await delay(300);

    // ПЕТРОВ: local_id=2
    console.log('\n  Петров - заявка local_id=2 (текущая)');
    await apiCall('/applications/2/submit', {
        method: 'POST',
        headers: { 'Authorization': tokens.petrov, 'Content-Type': 'application/json' },
        body: JSON.stringify({ loan_id: loanIds[2], loan_sum: 2500000, loan_interest: 15.0, loan_duration: 72 })
    });
    await delay(300);

    // СИДОРОВ: local_id=2
    console.log('\n  Сидоров - заявка local_id=2 (текущая)');
    await apiCall('/applications/2/submit', {
        method: 'POST',
        headers: { 'Authorization': tokens.sidorov, 'Content-Type': 'application/json' },
        body: JSON.stringify({ loan_id: loanIds[0], loan_sum: 700000, loan_interest: 13.0, loan_duration: 36 })
    });
    await delay(300);

    // НОВИКОВ: local_id=1 (первая заявка)
    console.log('\n  Новиков - заявка local_id=1 (текущая, недостаток данных)');
    await apiCall('/applications/1/submit', {
        method: 'POST',
        headers: { 'Authorization': tokens.novikov, 'Content-Type': 'application/json' },
        body: JSON.stringify({ loan_id: loanIds[0], loan_sum: 500000, loan_interest: 12.5, loan_duration: 36 })
    });
    await delay(300);


    // Новиков уточняет данные (local_id=1)
    console.log('\n  Новиков уточняет данные');
    await apiCall('/applications/1/clarify', {
        method: 'POST',
        headers: { 'Authorization': tokens.novikov, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            bki_data: {
                active_loans_count: 0,
                total_debt: 0,
                monthly_payment: 0,
                delinquencies_12m_count: 0,
                has_default: 0,
                report_date: '2026-10-26'
            },
            fns_data: {
                ogrn: '1267746000044',
                name: 'ООО "Старт"',
                legal_form: 'OOO',
                registration_date: '2026-09-15',
                status: 'ACTIVE'
            },
            internal_data: {
                has_account: 1,
                account_opened_date: '2026-09-20',
                avg_monthly_inflow: 800000,
                avg_monthly_outflow: 600000,
                acquiring_monthly_volume: 200000,
                blocked_115fz: 0,
                previous_products_closed_well: 0,
                snapshot_date: '2026-10-26'
            }
        })
    });
    await delay(400);

    // 9. БАНК ПРИНИМАЕТ РЕШЕНИЯ ПО УТОЧНЁННЫМ ЗАЯВКАМ
    console.log('\n[Решения банка по уточнённым заявкам]');

    // Сидоров (global_id=6) - ОДОБРЕНО после уточнения
    console.log('\n  Заявка Сидорова (после уточнения) -> ОДОБРЕНО');
    await apiCall('/bank/applications/6/decision', {
        method: 'POST',
        headers: empHeaders,
        body: JSON.stringify({
            type: 'APPROVE',
            approvedAmount: 700000,
            approvedTermMonths: 36,
            approvedRate: 13.0,
            missingFields: null,
            reason: null,
            comment: 'Данные уточнены, заявка одобрена'
        })
    });
    await delay(400);

    // Клиент принимает оффер
    console.log('\n  Сидоров принимает оффер');
    await apiCall('/applications/2/acceptOffer', {
        method: 'POST',
        headers: { 'Authorization': tokens.sidorov }
    });
    await delay(300);

    // Новиков (global_id=7) - ОДОБРЕНО после уточнения
    console.log('\n  Заявка Новикова (после уточнения) -> ОДОБРЕНО');
    await apiCall('/bank/applications/7/decision', {
        method: 'POST',
        headers: empHeaders,
        body: JSON.stringify({
            type: 'APPROVE',
            approvedAmount: 500000,
            approvedTermMonths: 36,
            approvedRate: 12.5,
            missingFields: null,
            reason: null,
            comment: 'Данные предоставлены, заявка одобрена'
        })
    });
    await delay(400);

    // Клиент принимает оффер
    console.log('\n  Новиков принимает оффер');
    await apiCall('/applications/1/acceptOffer', {
        method: 'POST',
        headers: { 'Authorization': tokens.novikov }
    });
    await delay(300);

    // 10. ИВАНОВ ПРИНИМАЕТ ОФФЕР ПО ВТОРОЙ ЗАЯВКЕ
    console.log('\n[Иванов принимает второй оффер]');
    console.log('\n  Иванов принимает оффер по заявке local_id=2');
    await apiCall('/applications/2/acceptOffer', {
        method: 'POST',
        headers: { 'Authorization': tokens.ivanov }
    });
    await delay(300);

    // 11. ПОВТОРНАЯ ПРОВЕРКА КЛИЕНТАМИ
    console.log('\n[Повторная проверка статусов клиентами]');

    for (const client of clients) {
        const token = tokens[client.username];
        if (!token) continue;
        const authHeaders = { 'Authorization': token };

        console.log(`\n  Клиент ${client.username}`);
        await apiCall('/client/dashboard', { headers: authHeaders });
        await delay(300);
        await apiCall('/applications', { headers: authHeaders });
        await delay(300);
    }

    // Финальный health-check
    await apiCall('/health');

    console.log('\n=== СИМУЛЯЦИЯ ЗАВЕРШЕНА ===\n');
}
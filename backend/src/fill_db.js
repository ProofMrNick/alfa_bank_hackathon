import db from './db.js'
import bcrypt from 'bcryptjs'

export default function fill_db() {
    ///registering accounts for  an employee and ML
    const hashed_employee_password = bcrypt.hashSync(process.env.EMPLOYEE_PASSWORD, 8)
    const hashed_ml_password = bcrypt.hashSync(process.env.ML_PASSWORD, 8)
    const hashed_client_password = bcrypt.hashSync(process.env.CLIENT_PASSWORD, 8)
    db.exec(`
        INSERT INTO users (username, password, role) VALUES
        ('employee', '${hashed_employee_password}', 'EMPLOYEE'),
        ('ml', '${hashed_ml_password}', 'EMPLOYEE');

        INSERT INTO user_info (user_id, email, name, risk_score, company_name) VALUES
        (${1}, 'manager@alfa-bank.local', 'Смирнова Ольга Викторовна', '-1', '-1'),
        (${2}, 'ml@alfa-bank.local', 'Исскуственный Интелект', '-1', '-1');;
    `)
    

    //mock data for testing
    // 2. Кредиты
    db.exec(`
        INSERT INTO loans (name, interest_rate, duration, min_amount, max_amount) VALUES
        ('Потребительский кредит', 12.5, 60, 50000, 3000000),
        ('Ипотека', 8.9, 360, 1000000, 30000000),
        ('Автокредит', 10.5, 84, 300000, 7000000),
        ('Кредит для бизнеса', 14.0, 36, 500000, 10000000)
    `)
    
}

// auto-test.js
const BASE_URL = 'http://localhost:5003/api';

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function simulateActivity() {

    try {


        // 3. Register Client

        const regRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'client',
                password: '12345678',
                email: 'auto@test.local',
                inn: '7700000099',
                companyName: 'AutoTest Inc'
            })
        });
        console.log('Register:', await regRes.json());

        // 4. Login Client
        console.log('\n4. Логин клиента...');
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({ username: 'client', password: '12345678' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token; // Убедитесь, что ваш логин возвращает { token: "..." }

        if (!token) {
            return;
        }

        const authHeaders = { 'Authorization': token, 'Content-Type': 'application/json' };

        // 5. Dashboard
        await fetch(`${BASE_URL}/client/dashboard`, { headers: authHeaders })
            .then(r => r.json()).then(d => console.log('Dashboard OK:', !!d.userInfo));

        // 6. Submit Application (local_id = 1)
        const submitRes = await fetch(`${BASE_URL}/applications/1/submit`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                loan_id: 1,
                loan_sum: 500000,
                loan_interest: 12.5,
                loan_duration: 60
            })
        });
        const submitData = await submitRes.json();
        console.log('Submit:', submitData);
        
        // Извлекаем global_id из ответа (если ваш бэкенд его возвращает)
        // const globalId = submitData.data?.application_id || 1; 


    } catch (error) {
        console.error('Ошибка при автоматическом тестировании:', error.message);
    }
}

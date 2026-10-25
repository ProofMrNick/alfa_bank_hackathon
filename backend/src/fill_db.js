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
        ('ml', '${hashed_ml_password}', 'EMPLOYEE')
    `)
    
    const insertUser = db.prepare(`INSERT INTO users (username, password) VALUES (?, ?)`)
    const result = insertUser.run('client', hashed_client_password)

    const insertUserInfo = db.prepare(`INSERT INTO user_info (user_id, email, name, inn, company_name) VALUES (?, ?, ?, ?, ?)`)
    insertUserInfo.run(result.lastInsertRowid, 'client@test.local', 'client', "7700000001", "ИП Клиентов И.И.")

    //mock data for testing
    // 2. Кредиты
    db.exec(`
        INSERT INTO loans (name, interest_rate, duration, min_amount, max_amount) VALUES
        ('Потребительский кредит', 12.5, 60, 50000, 3000000),
        ('Ипотека', 8.9, 360, 1000000, 30000000),
        ('Автокредит', 10.5, 84, 300000, 7000000),
        ('Кредит для бизнеса', 14.0, 36, 500000, 10000000)
    `)
    
    db
    
}
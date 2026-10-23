import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync(':memory:')

// Execute SQL statements from strings

db.exec(`
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT NOT NULL DEFAULT 'CLIENT' -- CLIENT, EMPLOYEE
    )
`)

db.exec(`
    CREATE TABLE applications (

        global_id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_id INTEGER,
        user_id INTEGER,
        loan_id INTEGER,

        loan_sum INTEGER,
        loan_interest REAL,
        loan_duration INTEGER,

        time_of_application DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'CREATED',


        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(loan_id) REFERENCES loans(id)

    )    
`)

db.exec(`
    CREATE TABLE loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        interest_rate REAL NOT NULL,
        duration INTEGER NOT NULL,   -- months
        min_amount INTEGER NOT NULL,  
        max_amount INTEGER NOT NULL
    )    
`)

db.exec(`
    CREATE TABLE user_info (
    user_id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    
    
    inn TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`)

db.exec(`
    CREATE TABLE applications_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    application_global_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    comment TEXT,
    new_status TEXT
    )
`)
db.exec(`
    CREATE TRIGGER log_application_created
    AFTER INSERT ON applications
    FOR EACH ROW
    BEGIN
        INSERT INTO applications_logs (user_id, application_global_id, new_status, timestamp)
        VALUES (NEW.user_id, NEW.global_id, 'CREATED', CURRENT_TIMESTAMP);
    END;
`)
db.exec(`
    CREATE TRIGGER log_application_status_change
    AFTER UPDATE OF status ON applications
    FOR EACH ROW
    WHEN OLD.status != NEW.status
    BEGIN
        INSERT INTO applications_logs (user_id, application_global_id, new_status, timestamp)
        VALUES (OLD.user_id, OLD.global_id, NEW.status, CURRENT_TIMESTAMP);
    END;
`)


//mock data for testing
db.exec(`
    INSERT INTO users (username, password, role) VALUES ('admin', '$2a$08$VtY02.2oD9ZEjvQqtd6LM.hYbtrGUa3sAwvS9O9U6d..LUK3uJQpi', 'EMPLOYEE')
    `)

// 2. Кредиты
db.exec(`
    INSERT INTO loans (name, interest_rate, duration, min_amount, max_amount) VALUES
    ('Потребительский кредит', 12.5, 60, 50000, 3000000),
    ('Ипотека', 8.9, 360, 1000000, 30000000),
    ('Автокредит', 10.5, 84, 300000, 7000000),
    ('Кредит для бизнеса', 14.0, 36, 500000, 10000000)
`)

export default db
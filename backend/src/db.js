import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync(':memory:')

// Execute SQL statements from strings
db.exec(`
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )
`)

db.exec(`
    CREATE TABLE applications (
        application_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type_of_loan TEXT,
        time_of_application DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY(user_id) REFERENCES users(id)
    )    
`)

db.exec(`
    CREATE TABLE loans (
        loan_id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_name TEXT NOT NULL,
        interest_rate REAL NOT NULL,
        duration INTEGER NOT NULL,   -- months
        min_amount INTEGER NOT NULL,  
        max_amount INTEGER NOT NULL    
    )    
`)


export default db
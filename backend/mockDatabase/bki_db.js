import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync(':memory:')

// Execute SQL statements from strings

db.exec(`
    CREATE TABLE bki (
        inn                    TEXT PRIMARY KEY,
        report_status          TEXT NOT NULL,  
        active_loans_count     INTEGER,
        total_debt             REAL,
        monthly_payment        REAL,
        delinquencies_12m_count INTEGER,
        max_delinquency_days   INTEGER,
        has_default            INTEGER NOT NULL DEFAULT 0,
        report_date            TEXT

    )
`)

db.prepare(`
    INSERT INTO bki (
        inn, report_status, active_loans_count, total_debt,
        monthly_payment, delinquencies_12m_count,
        max_delinquency_days, has_default, report_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run('7700000099', 'FOUND', 1, 1000000, 80000, 0, 0, 0, '2026-10-20')

export default db

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

export default db
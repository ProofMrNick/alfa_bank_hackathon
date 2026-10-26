import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync(':memory:')

// Execute SQL statements from strings

db.exec(`
    CREATE TABLE fns (
        inn                TEXT PRIMARY KEY,
        ogrn               TEXT NOT NULL,
        name               TEXT NOT NULL,
        legal_form         TEXT NOT NULL,              -- 'IP' | 'OOO'
        registration_date  TEXT NOT NULL,              -- ISO: '2018-10-17'
        status             TEXT NOT NULL,              -- 'ACTIVE' | 'LIQUIDATION'
        okved_main         TEXT,
        okved_additional   TEXT,                       -- JSON-массив строк
        tax_regime         TEXT,
        msp_category       TEXT,                       -- 'MICRO' | 'SMALL'
        msp_registry_date  TEXT,
        edo_participant    INTEGER NOT NULL DEFAULT 0, -- 0/1
        head_name          TEXT,                       -- для ООО
        head_position      TEXT

    )
`)

db.prepare(`
    INSERT INTO fns (
        inn, ogrn, name, legal_form, registration_date, status,
        okved_main, okved_additional, tax_regime, msp_category,
        msp_registry_date, edo_participant, head_name, head_position
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
    '7700000099',
    '1027700000000',
    'ООО Надёжный бизнес',
    'OOO',
    '2018-05-10',
    'ACTIVE',
    '62.01',
    JSON.stringify(['62.02', '63.11']),
    'USN',
    'SMALL',
    '2018-08-01',
    1,
    'Иванов Иван Иванович',
    'Генеральный директор',
)

export default db

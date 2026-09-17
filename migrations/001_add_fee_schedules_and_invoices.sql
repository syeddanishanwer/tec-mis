-- 1. Base Fee Templates
CREATE TABLE IF NOT EXISTS student_fee_schedules (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    base_fee NUMERIC(10, 2) NOT NULL,
    concession_amount NUMERIC(10, 2) DEFAULT 0.00,
    effective_from_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fee_schedules_student_date 
ON student_fee_schedules(student_id, effective_from_date DESC);

-- 2. Monthly Ledger
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    month_year DATE NOT NULL,
    base_fee NUMERIC(10, 2) NOT NULL,
    concession_amount NUMERIC(10, 2) DEFAULT 0.00,
    net_due NUMERIC(10, 2) GENERATED ALWAYS AS (base_fee - concession_amount) STORED,
    paid_amount NUMERIC(10, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'unpaid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_student_month UNIQUE (student_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_invoices_month_student 
ON invoices(month_year, student_id);
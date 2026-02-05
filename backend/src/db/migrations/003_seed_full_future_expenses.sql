-- Final consolidate future_expenses table with CORRECT YEARS (2026) and TYPE
DROP TABLE IF EXISTS future_expenses;

CREATE TABLE future_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'EUR',
    date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    type VARCHAR(50) DEFAULT 'ESTIMATE', -- 'INSTALLMENT' or 'ESTIMATE'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO future_expenses (title, amount, currency, date, status, type) VALUES
-- Items with specific monthly allocation - YEAR 2026 (INSTALLMENTS)
('Hidrolik Kapaklar (Şubat)', 66000.00, 'EUR', '2026-02-15', 'PENDING', 'INSTALLMENT'),
('Hidrolik Kapaklar (Nisan)', 49500.00, 'EUR', '2026-04-15', 'PENDING', 'INSTALLMENT'),

('Paslanmaz loca vs. (Şubat)', 11538.00, 'EUR', '2026-02-15', 'PENDING', 'INSTALLMENT'),
('Paslanmaz loca vs. (Mart)', 20192.00, 'EUR', '2026-03-15', 'PENDING', 'INSTALLMENT'),

('Astar (Şubat)', 5769.00, 'EUR', '2026-02-15', 'PENDING', 'INSTALLMENT'),
('Astar (Mart)', 5769.00, 'EUR', '2026-03-15', 'PENDING', 'INSTALLMENT'),
('Astar (Nisan)', 7692.00, 'EUR', '2026-04-15', 'PENDING', 'INSTALLMENT'),

('İskele - Aydınlatma (Şubat)', 8000.00, 'EUR', '2026-02-15', 'PENDING', 'INSTALLMENT'),

('Yalıtım Malzemesi (Mayıs)', 100000.00, 'EUR', '2026-05-15', 'PENDING', 'INSTALLMENT'),

-- Items with ONLY Total Amount (Assigned to June 30, 2026) (ESTIMATES)
('Klima-Pis Su-Temizsu tesisat malzemesi', 40000.00, 'EUR', '2026-06-30', 'PENDING', 'ESTIMATE'),
('Pompalar', 50000.00, 'EUR', '2026-06-30', 'PENDING', 'ESTIMATE'),
('Boya Malzemesi Macun Dahil', 200000.00, 'EUR', '2026-06-30', 'PENDING', 'ESTIMATE'),
('Elektrik', 300000.00, 'EUR', '2026-06-30', 'PENDING', 'ESTIMATE'),
('Cam', 300000.00, 'EUR', '2026-06-30', 'PENDING', 'ESTIMATE'),
('Elektronikler', 120000.00, 'EUR', '2026-06-30', 'PENDING', 'ESTIMATE'),
('Jeneratörler', 120000.00, 'EUR', '2026-06-30', 'PENDING', 'ESTIMATE'),
('Tik güverte 700€/m2', 196000.00, 'EUR', '2026-06-30', 'PENDING', 'ESTIMATE'),
('Havuzlar', 80000.00, 'EUR', '2026-06-30', 'PENDING', 'ESTIMATE'),
('Asansör', 32000.00, 'EUR', '2026-06-30', 'PENDING', 'ESTIMATE'),
('Otomasyon', 120000.00, 'EUR', '2026-06-30', 'PENDING', 'ESTIMATE'),
('Stabilizer', 250000.00, 'EUR', '2026-06-30', 'PENDING', 'ESTIMATE');

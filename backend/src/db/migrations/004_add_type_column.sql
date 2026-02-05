-- Ensure type column exists and has permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'future_expenses' AND column_name = 'type') THEN
        ALTER TABLE future_expenses ADD COLUMN type VARCHAR(50) DEFAULT 'ESTIMATE';
    END IF;
END $$;

-- Update data to classify monthly installments correctly
UPDATE future_expenses SET type = 'INSTALLMENT' WHERE title ~ '\((Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\)';
-- Also catch any with (Month) pattern generally if distinct from above
UPDATE future_expenses SET type = 'INSTALLMENT' WHERE title LIKE '%(%)%';

-- Ensure permissions
GRANT ALL PRIVILEGES ON TABLE future_expenses TO public;

-- Operating Authority Dashboard — Supabase schema
-- Run this in Supabase SQL Editor (only needs to run once)

CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  added_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON customers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON transcriptions FOR ALL USING (true) WITH CHECK (true);

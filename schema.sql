-- Operating Authority Dashboard — Supabase schema
-- Run this in Supabase SQL Editor

-- === INITIAL TABLES (already created) ===

CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  added_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transcriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_phone TEXT NOT NULL,
  transcription TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === V2: QUESTION-RESPONSE TRACKING ===

-- Prompts: a batch of questions sent to a customer
CREATE TABLE prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_phone TEXT NOT NULL,
  questions JSONB NOT NULL,
  message_sent TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Link transcriptions to the prompt/question they answer
ALTER TABLE transcriptions
  ADD COLUMN IF NOT EXISTS prompt_id UUID REFERENCES prompts(id),
  ADD COLUMN IF NOT EXISTS question_index INT;

-- RLS policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Allow all (auth handled at Netlify Function layer)
DO $$ BEGIN
  CREATE POLICY "Allow all" ON customers FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all" ON transcriptions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all" ON prompts FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

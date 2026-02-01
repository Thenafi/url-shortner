-- URL Shortener Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS short_urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_code TEXT NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on short_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_short_urls_code ON short_urls(short_code);

-- Enable Row Level Security (optional, recommended for security)
ALTER TABLE short_urls ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your security needs)
-- For a public URL shortener, you might want to allow reads but restrict writes
CREATE POLICY "Allow all operations" ON short_urls
    FOR ALL
    USING (true)
    WITH CHECK (true);

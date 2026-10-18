-- Accent-insensitive quack search (GET /api/quacks?q=...) matches with unaccent().
CREATE EXTENSION IF NOT EXISTS "unaccent";

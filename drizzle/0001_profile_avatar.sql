-- Incremental schema migration: optional private profile avatar metadata on public.profiles
-- Compatible with Neon PostgreSQL and PGlite (idempotent execution via IF NOT EXISTS / duplicate_object).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_key text,
  ADD COLUMN IF NOT EXISTS avatar_updated_at timestamptz;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_avatar_key_check CHECK (
      avatar_key IS NULL
      OR avatar_key ~ '^avatars/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_avatar_consistency_check CHECK (
      (avatar_key IS NULL AND avatar_updated_at IS NULL)
      OR (avatar_key IS NOT NULL AND avatar_updated_at IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

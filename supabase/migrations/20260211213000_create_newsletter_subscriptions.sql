/*
  # Newsletter subscriptions

  ## Changes
  - Create `newsletter_subscriptions` table
  - One row per user (user_id unique)
  - RLS: users can read/write only their own row
*/

CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  subscribed boolean NOT NULL DEFAULT true,
  subscribed_at timestamptz,
  unsubscribed_at timestamptz,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_subscriptions_user_unique UNIQUE (user_id)
);

ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_subscriptions'
      AND policyname = 'Users can read own newsletter subscription'
  ) THEN
    CREATE POLICY "Users can read own newsletter subscription"
      ON public.newsletter_subscriptions FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_subscriptions'
      AND policyname = 'Users can insert own newsletter subscription'
  ) THEN
    CREATE POLICY "Users can insert own newsletter subscription"
      ON public.newsletter_subscriptions FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_subscriptions'
      AND policyname = 'Users can update own newsletter subscription'
  ) THEN
    CREATE POLICY "Users can update own newsletter subscription"
      ON public.newsletter_subscriptions FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_user_id ON public.newsletter_subscriptions(user_id);

CREATE OR REPLACE FUNCTION public.handle_newsletter_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_newsletter_updated_at ON public.newsletter_subscriptions;
CREATE TRIGGER trg_newsletter_updated_at
BEFORE UPDATE ON public.newsletter_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.handle_newsletter_updated_at();

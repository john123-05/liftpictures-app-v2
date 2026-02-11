/*
  # Add popup toggle for newsletter modal

  ## Changes
  - Add newsletter_subscriptions.popup_enabled (default true)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'newsletter_subscriptions'
      AND column_name = 'popup_enabled'
  ) THEN
    ALTER TABLE public.newsletter_subscriptions
      ADD COLUMN popup_enabled boolean NOT NULL DEFAULT true;
  END IF;
END $$;

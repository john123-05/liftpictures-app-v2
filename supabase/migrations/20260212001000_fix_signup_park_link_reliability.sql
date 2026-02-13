/*
  # Fix signup reliability + park linkage

  Ensures:
  - public.users has park_id and default/backfill
  - handle_new_user trigger function is park-aware
  - trigger is attached and non-breaking
*/

-- Ensure parks table exists and has default Adventure Land park
CREATE TABLE IF NOT EXISTS public.parks (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.parks (id, slug, name, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', 'adventure-land', 'Adventure Land', true)
ON CONFLICT (id) DO UPDATE
SET slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

-- Ensure users.park_id exists and is populated
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS park_id uuid REFERENCES public.parks(id);

UPDATE public.users
SET park_id = '11111111-1111-1111-1111-111111111111'
WHERE park_id IS NULL;

ALTER TABLE public.users
  ALTER COLUMN park_id SET DEFAULT '11111111-1111-1111-1111-111111111111',
  ALTER COLUMN park_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_park_id ON public.users(park_id);

-- Recreate trigger function safely.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_park_id uuid;
BEGIN
  v_park_id := NULLIF(new.raw_user_meta_data->>'park_id', '')::uuid;

  IF v_park_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.parks p
    WHERE p.id = v_park_id AND p.is_active = true
  ) THEN
    v_park_id := '11111111-1111-1111-1111-111111111111'::uuid;
  END IF;

  INSERT INTO public.users (id, email, vorname, nachname, park_id)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    v_park_id
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      vorname = COALESCE(EXCLUDED.vorname, public.users.vorname),
      nachname = COALESCE(EXCLUDED.nachname, public.users.nachname),
      park_id = COALESCE(public.users.park_id, EXCLUDED.park_id);

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Do not block auth signup completely; app-side fallback will upsert profile on first session load.
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

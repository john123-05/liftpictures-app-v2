/*
  # Fix handle_new_user deterministically

  Problem addressed:
  - Signup can appear successful while public.users row is missing.
  - Root cause is usually trigger function failure + swallowed exception.

  This migration:
  - Ensures users.park_id exists/default/not null
  - Replaces handle_new_user with safe park_id parsing
  - Removes broad exception swallowing so real DB errors surface
*/

-- Ensure users.park_id exists and is usable.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS park_id uuid REFERENCES public.parks(id);

UPDATE public.users
SET park_id = '11111111-1111-1111-1111-111111111111'
WHERE park_id IS NULL;

ALTER TABLE public.users
  ALTER COLUMN park_id SET DEFAULT '11111111-1111-1111-1111-111111111111',
  ALTER COLUMN park_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_park_id ON public.users(park_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_park_id_text text;
  v_park_id uuid;
BEGIN
  v_park_id_text := NULLIF(new.raw_user_meta_data->>'park_id', '');

  -- Safe UUID parse (no exception on invalid values)
  IF v_park_id_text IS NOT NULL
     AND v_park_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN
    v_park_id := v_park_id_text::uuid;
  ELSE
    v_park_id := NULL;
  END IF;

  IF v_park_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.parks p
    WHERE p.id = v_park_id
      AND p.is_active = true
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
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

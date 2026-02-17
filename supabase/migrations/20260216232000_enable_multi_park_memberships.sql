/*
  # Enable multi-park memberships per auth account

  Goal:
  - Keep one auth user per email.
  - Allow one user to be member of multiple parks.
  - Keep users.park_id as currently active park for compatibility.
*/

-- =====================================================
-- USER_PARKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_parks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  park_id uuid NOT NULL REFERENCES public.parks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_parks_user_park_unique UNIQUE (user_id, park_id)
);

CREATE INDEX IF NOT EXISTS idx_user_parks_user_id ON public.user_parks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_parks_park_id ON public.user_parks(park_id);

ALTER TABLE public.user_parks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_parks'
      AND policyname = 'Users can read own park memberships'
  ) THEN
    CREATE POLICY "Users can read own park memberships"
      ON public.user_parks
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_parks'
      AND policyname = 'Users can insert own park memberships'
  ) THEN
    CREATE POLICY "Users can insert own park memberships"
      ON public.user_parks
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_parks'
      AND policyname = 'Users can delete own park memberships'
  ) THEN
    CREATE POLICY "Users can delete own park memberships"
      ON public.user_parks
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- =====================================================
-- BACKFILL FROM EXISTING USERS.PARK_ID
-- =====================================================

INSERT INTO public.user_parks (user_id, park_id, created_at, updated_at)
SELECT
  u.id,
  u.park_id,
  COALESCE(u.created_at, now()),
  now()
FROM public.users u
WHERE u.park_id IS NOT NULL
ON CONFLICT (user_id, park_id) DO NOTHING;

-- =====================================================
-- KEEP MEMBERSHIPS IN SYNC WHEN ACTIVE PARK CHANGES
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_user_park_membership_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.park_id IS NOT NULL THEN
    INSERT INTO public.user_parks (user_id, park_id)
    VALUES (NEW.id, NEW.park_id)
    ON CONFLICT (user_id, park_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_park_membership_from_profile ON public.users;
CREATE TRIGGER trg_sync_user_park_membership_from_profile
  AFTER INSERT OR UPDATE OF park_id ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_park_membership_from_profile();

-- =====================================================
-- SIGNUP TRIGGER: CREATE PROFILE + MEMBERSHIP
-- =====================================================

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
      park_id = COALESCE(EXCLUDED.park_id, public.users.park_id);

  INSERT INTO public.user_parks (user_id, park_id)
  VALUES (new.id, v_park_id)
  ON CONFLICT (user_id, park_id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


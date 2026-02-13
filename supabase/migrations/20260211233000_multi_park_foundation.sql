/*
  # Multi-park foundation (non-destructive)

  ## Goal
  Introduce a park tenant model so multiple theme parks can use the same backend.
  Existing data is preserved and backfilled to the default demo park "Adventure Land".

  ## Notes
  - Additive migration only
  - Existing app behavior remains valid
  - Future parks can be added via `parks` + `park_storage_buckets`
*/

-- =====================================================
-- CONSTANT DEFAULT PARK ID (Adventure Land demo)
-- =====================================================

-- Fixed UUID to keep defaults deterministic across environments.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'parks'
  ) THEN
    CREATE TABLE public.parks (
      id uuid PRIMARY KEY,
      slug text NOT NULL UNIQUE,
      name text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

ALTER TABLE public.parks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'parks'
      AND policyname = 'Anyone can read active parks'
  ) THEN
    CREATE POLICY "Anyone can read active parks"
      ON public.parks
      FOR SELECT
      TO anon, authenticated
      USING (is_active = true);
  END IF;
END $$;

INSERT INTO public.parks (id, slug, name, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', 'adventure-land', 'Adventure Land', true)
ON CONFLICT (id) DO UPDATE
SET slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

-- =====================================================
-- PARK STORAGE BUCKET MAPPING
-- =====================================================

CREATE TABLE IF NOT EXISTS public.park_storage_buckets (
  bucket_id text PRIMARY KEY,
  park_id uuid NOT NULL REFERENCES public.parks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.park_storage_buckets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'park_storage_buckets'
      AND policyname = 'Authenticated can read bucket mappings'
  ) THEN
    CREATE POLICY "Authenticated can read bucket mappings"
      ON public.park_storage_buckets
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

INSERT INTO public.park_storage_buckets (bucket_id, park_id)
VALUES ('test', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (bucket_id) DO NOTHING;

-- =====================================================
-- USERS PARK LINK + helper function
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'park_id'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN park_id uuid REFERENCES public.parks(id);
  END IF;
END $$;

UPDATE public.users
SET park_id = '11111111-1111-1111-1111-111111111111'
WHERE park_id IS NULL;

ALTER TABLE public.users
  ALTER COLUMN park_id SET DEFAULT '11111111-1111-1111-1111-111111111111',
  ALTER COLUMN park_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_park_id ON public.users(park_id);

CREATE OR REPLACE FUNCTION public.current_user_park_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_park_id uuid;
BEGIN
  SELECT u.park_id INTO v_park_id
  FROM public.users u
  WHERE u.id = auth.uid();

  RETURN COALESCE(v_park_id, '11111111-1111-1111-1111-111111111111'::uuid);
END;
$$;

-- Keep signup trigger compatible with park selection in auth metadata.
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
END;
$$;

-- =====================================================
-- Add park_id to domain tables + backfill
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='photos' AND column_name='park_id') THEN
    ALTER TABLE public.photos ADD COLUMN park_id uuid REFERENCES public.parks(id);
  END IF;
END $$;
UPDATE public.photos SET park_id = '11111111-1111-1111-1111-111111111111' WHERE park_id IS NULL;
ALTER TABLE public.photos ALTER COLUMN park_id SET DEFAULT '11111111-1111-1111-1111-111111111111', ALTER COLUMN park_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_photos_park_id ON public.photos(park_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rides' AND column_name='park_id') THEN
    ALTER TABLE public.rides ADD COLUMN park_id uuid REFERENCES public.parks(id);
  END IF;
END $$;
UPDATE public.rides r
SET park_id = u.park_id
FROM public.users u
WHERE r.user_id = u.id
  AND r.park_id IS NULL;
UPDATE public.rides SET park_id = '11111111-1111-1111-1111-111111111111' WHERE park_id IS NULL;
ALTER TABLE public.rides ALTER COLUMN park_id SET DEFAULT public.current_user_park_id(), ALTER COLUMN park_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rides_park_id ON public.rides(park_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='favorites' AND column_name='park_id') THEN
    ALTER TABLE public.favorites ADD COLUMN park_id uuid REFERENCES public.parks(id);
  END IF;
END $$;
UPDATE public.favorites f
SET park_id = COALESCE(
  (SELECT u.park_id FROM public.users u WHERE u.id = f.user_id),
  (SELECT p.park_id FROM public.photos p WHERE p.id = f.photo_id),
  '11111111-1111-1111-1111-111111111111'::uuid
)
WHERE f.park_id IS NULL;
UPDATE public.favorites SET park_id = '11111111-1111-1111-1111-111111111111' WHERE park_id IS NULL;
ALTER TABLE public.favorites ALTER COLUMN park_id SET DEFAULT public.current_user_park_id(), ALTER COLUMN park_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_favorites_park_id ON public.favorites(park_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cart_items' AND column_name='park_id') THEN
    ALTER TABLE public.cart_items ADD COLUMN park_id uuid REFERENCES public.parks(id);
  END IF;
END $$;
UPDATE public.cart_items c
SET park_id = COALESCE(
  (SELECT u.park_id FROM public.users u WHERE u.id = c.user_id),
  (SELECT p.park_id FROM public.photos p WHERE p.id = c.photo_id),
  '11111111-1111-1111-1111-111111111111'::uuid
)
WHERE c.park_id IS NULL;
UPDATE public.cart_items SET park_id = '11111111-1111-1111-1111-111111111111' WHERE park_id IS NULL;
ALTER TABLE public.cart_items ALTER COLUMN park_id SET DEFAULT public.current_user_park_id(), ALTER COLUMN park_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cart_items_park_id ON public.cart_items(park_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchases' AND column_name='park_id') THEN
    ALTER TABLE public.purchases ADD COLUMN park_id uuid REFERENCES public.parks(id);
  END IF;
END $$;
UPDATE public.purchases pur
SET park_id = COALESCE(
  (SELECT u.park_id FROM public.users u WHERE u.id = pur.user_id),
  (SELECT p.park_id FROM public.photos p WHERE p.id = pur.photo_id),
  '11111111-1111-1111-1111-111111111111'::uuid
)
WHERE pur.park_id IS NULL;
UPDATE public.purchases SET park_id = '11111111-1111-1111-1111-111111111111' WHERE park_id IS NULL;
ALTER TABLE public.purchases ALTER COLUMN park_id SET DEFAULT public.current_user_park_id(), ALTER COLUMN park_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_park_id ON public.purchases(park_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='unlocked_photos' AND column_name='park_id') THEN
    ALTER TABLE public.unlocked_photos ADD COLUMN park_id uuid REFERENCES public.parks(id);
  END IF;
END $$;
UPDATE public.unlocked_photos up
SET park_id = COALESCE(
  (SELECT u.park_id FROM public.users u WHERE u.id = up.user_id),
  (SELECT p.park_id FROM public.photos p WHERE p.id = up.photo_id),
  '11111111-1111-1111-1111-111111111111'::uuid
)
WHERE up.park_id IS NULL;
UPDATE public.unlocked_photos SET park_id = '11111111-1111-1111-1111-111111111111' WHERE park_id IS NULL;
ALTER TABLE public.unlocked_photos ALTER COLUMN park_id SET DEFAULT public.current_user_park_id(), ALTER COLUMN park_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unlocked_photos_park_id ON public.unlocked_photos(park_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leaderboard_entries' AND column_name='park_id') THEN
    ALTER TABLE public.leaderboard_entries ADD COLUMN park_id uuid REFERENCES public.parks(id);
  END IF;
END $$;
UPDATE public.leaderboard_entries le
SET park_id = COALESCE(
  (SELECT p.park_id FROM public.photos p WHERE p.id = le.photo_id),
  (SELECT u.park_id FROM public.users u WHERE u.id = le.user_id),
  '11111111-1111-1111-1111-111111111111'::uuid
)
WHERE le.park_id IS NULL;
UPDATE public.leaderboard_entries SET park_id = '11111111-1111-1111-1111-111111111111' WHERE park_id IS NULL;
ALTER TABLE public.leaderboard_entries ALTER COLUMN park_id SET DEFAULT public.current_user_park_id(), ALTER COLUMN park_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_park_id ON public.leaderboard_entries(park_id, ride_date DESC, speed_kmh DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='newsletter_subscriptions' AND column_name='user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='newsletter_subscriptions' AND column_name='park_id'
  ) THEN
    ALTER TABLE public.newsletter_subscriptions ADD COLUMN park_id uuid REFERENCES public.parks(id);
  END IF;
END $$;
UPDATE public.newsletter_subscriptions n
SET park_id = COALESCE(u.park_id, '11111111-1111-1111-1111-111111111111'::uuid)
FROM public.users u
WHERE n.user_id = u.id
  AND n.park_id IS NULL;
UPDATE public.newsletter_subscriptions SET park_id = '11111111-1111-1111-1111-111111111111' WHERE park_id IS NULL;
ALTER TABLE public.newsletter_subscriptions ALTER COLUMN park_id SET DEFAULT public.current_user_park_id(), ALTER COLUMN park_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_park_id ON public.newsletter_subscriptions(park_id);

-- =====================================================
-- Update storage trigger: map bucket -> park
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_storage_object()
RETURNS TRIGGER AS $$
DECLARE
  v_park_id uuid;
BEGIN
  SELECT psb.park_id INTO v_park_id
  FROM public.park_storage_buckets psb
  WHERE psb.bucket_id = NEW.bucket_id;

  IF v_park_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.photos (
    storage_bucket,
    storage_path,
    captured_at,
    speed_kmh,
    park_id,
    created_at
  )
  VALUES (
    NEW.bucket_id,
    NEW.name,
    NEW.created_at,
    parse_speed_kmh(NEW.name),
    v_park_id,
    now()
  )
  ON CONFLICT (storage_bucket, storage_path) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Update leaderboard trigger to include park_id
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_leaderboard_from_unlocked_photo()
RETURNS trigger AS $$
DECLARE
  v_speed numeric;
  v_ride_date date;
  v_park_id uuid;
BEGIN
  SELECT
    COALESCE(NULLIF(p.speed_kmh, 0), parse_speed_kmh(p.storage_path), 0),
    (p.captured_at AT TIME ZONE 'UTC')::date,
    p.park_id
  INTO v_speed, v_ride_date, v_park_id
  FROM public.photos p
  WHERE p.id = NEW.photo_id;

  IF v_ride_date IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.leaderboard_entries (user_id, photo_id, speed_kmh, ride_date, park_id)
  VALUES (
    NEW.user_id,
    NEW.photo_id,
    COALESCE(v_speed, 0),
    v_ride_date,
    COALESCE(v_park_id, NEW.park_id, '11111111-1111-1111-1111-111111111111'::uuid)
  )
  ON CONFLICT (user_id, photo_id)
  DO UPDATE SET
    speed_kmh = EXCLUDED.speed_kmh,
    ride_date = EXCLUDED.ride_date,
    park_id = EXCLUDED.park_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill/update park-aware leaderboard rows.
INSERT INTO public.leaderboard_entries (user_id, photo_id, speed_kmh, ride_date, park_id)
SELECT
  up.user_id,
  up.photo_id,
  COALESCE(NULLIF(p.speed_kmh, 0), parse_speed_kmh(p.storage_path), 0),
  (p.captured_at AT TIME ZONE 'UTC')::date,
  COALESCE(p.park_id, up.park_id, '11111111-1111-1111-1111-111111111111'::uuid)
FROM public.unlocked_photos up
JOIN public.photos p ON p.id = up.photo_id
ON CONFLICT (user_id, photo_id)
DO UPDATE SET
  speed_kmh = EXCLUDED.speed_kmh,
  ride_date = EXCLUDED.ride_date,
  park_id = EXCLUDED.park_id;

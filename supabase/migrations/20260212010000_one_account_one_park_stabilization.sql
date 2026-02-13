/*
  # One Account = One Park stabilization

  Goal:
  - Make multi-park setup reliable and deterministic.
  - Every user is linked to exactly one park via `public.users.park_id`.
  - All core business tables carry `park_id` and are backfilled.
  - Storage ingestion supports configurable bucket->park mappings.

  Notes:
  - Non-destructive, idempotent where possible.
  - Default demo park is Adventure Land.
*/

-- =====================================================
-- Constants / base tenant objects
-- =====================================================

CREATE TABLE IF NOT EXISTS public.parks (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
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

CREATE TABLE IF NOT EXISTS public.park_storage_buckets (
  bucket_id text NOT NULL,
  park_id uuid NOT NULL REFERENCES public.parks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_id, park_id)
);

ALTER TABLE public.park_storage_buckets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
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

-- In case old schema created a single-column PK on bucket_id.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'park_storage_buckets_pkey'
      AND conrelid = 'public.park_storage_buckets'::regclass
  ) THEN
    -- Recreate only when current PK is not (bucket_id, park_id)
    IF NOT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_attribute a1 ON a1.attrelid = c.oid AND a1.attnum = ANY(i.indkey)
      JOIN pg_attribute a2 ON a2.attrelid = c.oid AND a2.attnum = ANY(i.indkey)
      WHERE c.relname = 'park_storage_buckets'
        AND i.indisprimary
        AND a1.attname = 'bucket_id'
        AND a2.attname = 'park_id'
    ) THEN
      ALTER TABLE public.park_storage_buckets DROP CONSTRAINT park_storage_buckets_pkey;
      ALTER TABLE public.park_storage_buckets ADD CONSTRAINT park_storage_buckets_pkey PRIMARY KEY (bucket_id, park_id);
    END IF;
  END IF;
END $$;

INSERT INTO public.park_storage_buckets (bucket_id, park_id)
VALUES ('test', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (bucket_id, park_id) DO NOTHING;

-- =====================================================
-- User <-> park linkage (one account = one park)
-- =====================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS park_id uuid REFERENCES public.parks(id);

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

-- Backfill missing profile rows from auth.users first.
INSERT INTO public.users (id, email, vorname, nachname, park_id, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'first_name', ''),
  COALESCE(au.raw_user_meta_data->>'last_name', ''),
  COALESCE(
    (
      SELECT p.id
      FROM public.parks p
      WHERE p.id = CASE
        WHEN NULLIF(au.raw_user_meta_data->>'park_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN (NULLIF(au.raw_user_meta_data->>'park_id', ''))::uuid
        ELSE NULL
      END
      AND p.is_active = true
      LIMIT 1
    ),
    '11111111-1111-1111-1111-111111111111'::uuid
  ),
  now(),
  now()
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL;

UPDATE public.users u
SET park_id = COALESCE(
  (
    SELECT p.id
    FROM auth.users au
    JOIN public.parks p
      ON p.id = CASE
        WHEN NULLIF(au.raw_user_meta_data->>'park_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN (NULLIF(au.raw_user_meta_data->>'park_id', ''))::uuid
        ELSE NULL
      END
     AND p.is_active = true
    WHERE au.id = u.id
    LIMIT 1
  ),
  '11111111-1111-1111-1111-111111111111'::uuid
)
WHERE u.park_id IS NULL;

ALTER TABLE public.users
  ALTER COLUMN park_id SET DEFAULT '11111111-1111-1111-1111-111111111111',
  ALTER COLUMN park_id SET NOT NULL;

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
      park_id = COALESCE(public.users.park_id, EXCLUDED.park_id);

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- Domain tables park_id hardening
-- =====================================================

ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS park_id uuid REFERENCES public.parks(id);
UPDATE public.photos p
SET park_id = COALESCE(
  (
    SELECT psb.park_id
    FROM public.park_storage_buckets psb
    WHERE psb.bucket_id = p.storage_bucket
    ORDER BY psb.park_id
    LIMIT 1
  ),
  '11111111-1111-1111-1111-111111111111'::uuid
)
WHERE p.park_id IS NULL;
ALTER TABLE public.photos
  ALTER COLUMN park_id SET DEFAULT '11111111-1111-1111-1111-111111111111',
  ALTER COLUMN park_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_photos_park_id ON public.photos(park_id);

-- Move photos uniqueness to park-aware key.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'photos'
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname::text ORDER BY u.ord)
        FROM unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord)
        JOIN pg_attribute a
          ON a.attrelid = t.oid
         AND a.attnum = u.attnum
      ) = ARRAY['storage_bucket','storage_path']::text[]
  LOOP
    EXECUTE format('ALTER TABLE public.photos DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.photos_bucket_path_unique;
DROP INDEX IF EXISTS public.photos_storage_bucket_storage_path_key;
DROP INDEX IF EXISTS public.unique_photo_storage;

DELETE FROM public.photos a
USING public.photos b
WHERE a.ctid < b.ctid
  AND a.park_id = b.park_id
  AND a.storage_bucket = b.storage_bucket
  AND a.storage_path = b.storage_path;
CREATE UNIQUE INDEX IF NOT EXISTS photos_park_bucket_path_unique_idx
  ON public.photos (park_id, storage_bucket, storage_path);

ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS park_id uuid REFERENCES public.parks(id);
UPDATE public.rides r
SET park_id = COALESCE(
  (SELECT u.park_id FROM public.users u WHERE u.id = r.user_id),
  '11111111-1111-1111-1111-111111111111'::uuid
)
WHERE r.park_id IS NULL;
ALTER TABLE public.rides
  ALTER COLUMN park_id SET DEFAULT public.current_user_park_id(),
  ALTER COLUMN park_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rides_park_id ON public.rides(park_id);

ALTER TABLE public.favorites ADD COLUMN IF NOT EXISTS park_id uuid REFERENCES public.parks(id);
UPDATE public.favorites f
SET park_id = COALESCE(
  (SELECT u.park_id FROM public.users u WHERE u.id = f.user_id),
  (SELECT p.park_id FROM public.photos p WHERE p.id = f.photo_id),
  '11111111-1111-1111-1111-111111111111'::uuid
)
WHERE f.park_id IS NULL;
ALTER TABLE public.favorites
  ALTER COLUMN park_id SET DEFAULT public.current_user_park_id(),
  ALTER COLUMN park_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_favorites_park_id ON public.favorites(park_id);

ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS park_id uuid REFERENCES public.parks(id);
UPDATE public.cart_items c
SET park_id = COALESCE(
  (SELECT u.park_id FROM public.users u WHERE u.id = c.user_id),
  (SELECT p.park_id FROM public.photos p WHERE p.id = c.photo_id),
  '11111111-1111-1111-1111-111111111111'::uuid
)
WHERE c.park_id IS NULL;
ALTER TABLE public.cart_items
  ALTER COLUMN park_id SET DEFAULT public.current_user_park_id(),
  ALTER COLUMN park_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cart_items_park_id ON public.cart_items(park_id);

ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS park_id uuid REFERENCES public.parks(id);
UPDATE public.purchases pur
SET park_id = COALESCE(
  (SELECT u.park_id FROM public.users u WHERE u.id = pur.user_id),
  (SELECT p.park_id FROM public.photos p WHERE p.id = pur.photo_id),
  '11111111-1111-1111-1111-111111111111'::uuid
)
WHERE pur.park_id IS NULL;
ALTER TABLE public.purchases
  ALTER COLUMN park_id SET DEFAULT public.current_user_park_id(),
  ALTER COLUMN park_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_park_id ON public.purchases(park_id);

ALTER TABLE public.unlocked_photos ADD COLUMN IF NOT EXISTS park_id uuid REFERENCES public.parks(id);
UPDATE public.unlocked_photos up
SET park_id = COALESCE(
  (SELECT u.park_id FROM public.users u WHERE u.id = up.user_id),
  (SELECT p.park_id FROM public.photos p WHERE p.id = up.photo_id),
  '11111111-1111-1111-1111-111111111111'::uuid
)
WHERE up.park_id IS NULL;
ALTER TABLE public.unlocked_photos
  ALTER COLUMN park_id SET DEFAULT public.current_user_park_id(),
  ALTER COLUMN park_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unlocked_photos_park_id ON public.unlocked_photos(park_id);

ALTER TABLE public.leaderboard_entries ADD COLUMN IF NOT EXISTS park_id uuid REFERENCES public.parks(id);
UPDATE public.leaderboard_entries le
SET park_id = COALESCE(
  (SELECT p.park_id FROM public.photos p WHERE p.id = le.photo_id),
  (SELECT u.park_id FROM public.users u WHERE u.id = le.user_id),
  '11111111-1111-1111-1111-111111111111'::uuid
)
WHERE le.park_id IS NULL;
ALTER TABLE public.leaderboard_entries
  ALTER COLUMN park_id SET DEFAULT public.current_user_park_id(),
  ALTER COLUMN park_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_park_id
  ON public.leaderboard_entries(park_id, ride_date DESC, speed_kmh DESC);

-- Optional table in some environments.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'newsletter_subscriptions'
  ) THEN
    ALTER TABLE public.newsletter_subscriptions
      ADD COLUMN IF NOT EXISTS park_id uuid REFERENCES public.parks(id);

    UPDATE public.newsletter_subscriptions n
    SET park_id = COALESCE(
      (SELECT u.park_id FROM public.users u WHERE u.id = n.user_id),
      '11111111-1111-1111-1111-111111111111'::uuid
    )
    WHERE n.park_id IS NULL;

    ALTER TABLE public.newsletter_subscriptions
      ALTER COLUMN park_id SET DEFAULT public.current_user_park_id(),
      ALTER COLUMN park_id SET NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_park_id
      ON public.newsletter_subscriptions(park_id);
  END IF;
END $$;

-- =====================================================
-- Storage ingestion + leaderboard sync park-aware
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_storage_object()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.photos (
    storage_bucket,
    storage_path,
    captured_at,
    speed_kmh,
    park_id,
    created_at
  )
  SELECT
    NEW.bucket_id,
    NEW.name,
    NEW.created_at,
    parse_speed_kmh(NEW.name),
    psb.park_id,
    now()
  FROM public.park_storage_buckets psb
  WHERE psb.bucket_id = NEW.bucket_id
  ON CONFLICT (park_id, storage_bucket, storage_path) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_storage_object_created ON storage.objects;
CREATE TRIGGER on_storage_object_created
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_storage_object();

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

DROP TRIGGER IF EXISTS trg_sync_leaderboard_from_unlocked_photo ON public.unlocked_photos;
CREATE TRIGGER trg_sync_leaderboard_from_unlocked_photo
AFTER INSERT OR UPDATE ON public.unlocked_photos
FOR EACH ROW
EXECUTE FUNCTION public.sync_leaderboard_from_unlocked_photo();

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

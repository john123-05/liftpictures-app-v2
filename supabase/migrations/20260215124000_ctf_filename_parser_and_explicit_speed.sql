/*
  # CTF filename parsing + explicit speed suffix (_S1234)

  ## Goal
  - Support new source filename format: C(4) + T(8) + F(4), optionally with `_S1234`
  - Store parsed source parts in dedicated columns
  - Only parse speed when explicit marker exists (or legacy `km/h` text)
  - Avoid wrong speed from "last 4 digits" when those digits are file sequence (F1..4)
*/

-- 1) Add source metadata columns to photos (non-destructive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'photos' AND column_name = 'source_customer_code'
  ) THEN
    ALTER TABLE public.photos ADD COLUMN source_customer_code text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'photos' AND column_name = 'source_time_code'
  ) THEN
    ALTER TABLE public.photos ADD COLUMN source_time_code text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'photos' AND column_name = 'source_file_code'
  ) THEN
    ALTER TABLE public.photos ADD COLUMN source_file_code text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'photos' AND column_name = 'source_speed_kmh'
  ) THEN
    ALTER TABLE public.photos ADD COLUMN source_speed_kmh numeric;
  END IF;
END $$;

-- 2) Helper: base filename stem (without extension)
CREATE OR REPLACE FUNCTION public.filename_stem(path text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(split_part(path, '/', array_length(string_to_array(path, '/'), 1)), '\.[^.]+$', '')
$$;

-- 3) Parse explicit speed only
-- Supported:
--   - Legacy "...34,56 km/h..."
--   - New explicit suffix "..._S3456" => 34.56
CREATE OR REPLACE FUNCTION public.parse_speed_kmh(path text)
RETURNS numeric AS $$
DECLARE
  stem text;
  kmh_match text;
  suffix_match text;
BEGIN
  IF path IS NULL OR length(path) = 0 THEN
    RETURN NULL;
  END IF;

  kmh_match := (regexp_matches(path, '(\d{1,3}[,\.]\d{1,2})\s*km/h', 'i'))[1];
  IF kmh_match IS NOT NULL THEN
    RETURN replace(kmh_match, ',', '.')::numeric;
  END IF;

  stem := public.filename_stem(path);
  suffix_match := (regexp_matches(stem, '_[sS](\d{4})$'))[1];
  IF suffix_match IS NOT NULL THEN
    RETURN (suffix_match::numeric / 100.0);
  END IF;

  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4) Parse C/T/F parts from start of stem: C(4) + T(8) + F(4)
CREATE OR REPLACE FUNCTION public.parse_source_customer_code(path text)
RETURNS text AS $$
DECLARE
  stem text;
  code text;
BEGIN
  IF path IS NULL OR length(path) = 0 THEN
    RETURN NULL;
  END IF;

  stem := public.filename_stem(path);
  code := (regexp_matches(stem, '^(\d{4})(\d{8})(\d{4})(?:_[sS]\d{4})?$'))[1];
  RETURN code;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.parse_source_time_code(path text)
RETURNS text AS $$
DECLARE
  stem text;
  code text;
BEGIN
  IF path IS NULL OR length(path) = 0 THEN
    RETURN NULL;
  END IF;

  stem := public.filename_stem(path);
  code := (regexp_matches(stem, '^(\d{4})(\d{8})(\d{4})(?:_[sS]\d{4})?$'))[2];
  RETURN code;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.parse_source_file_code(path text)
RETURNS text AS $$
DECLARE
  stem text;
  code text;
BEGIN
  IF path IS NULL OR length(path) = 0 THEN
    RETURN NULL;
  END IF;

  stem := public.filename_stem(path);
  code := (regexp_matches(stem, '^(\d{4})(\d{8})(\d{4})(?:_[sS]\d{4})?$'))[3];
  RETURN code;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5) Update storage ingestion trigger to fill source fields and explicit speed
-- Keep shared-bucket behavior (all mapped parks for the same bucket)
CREATE OR REPLACE FUNCTION public.handle_new_storage_object()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.photos (
    storage_bucket,
    storage_path,
    captured_at,
    speed_kmh,
    source_customer_code,
    source_time_code,
    source_file_code,
    source_speed_kmh,
    park_id,
    created_at
  )
  SELECT
    NEW.bucket_id,
    NEW.name,
    NEW.created_at,
    public.parse_speed_kmh(NEW.name),
    public.parse_source_customer_code(NEW.name),
    public.parse_source_time_code(NEW.name),
    public.parse_source_file_code(NEW.name),
    public.parse_speed_kmh(NEW.name),
    psb.park_id,
    now()
  FROM public.park_storage_buckets psb
  WHERE psb.bucket_id = NEW.bucket_id
  ON CONFLICT (park_id, storage_bucket, storage_path) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6) Backfill source fields for existing rows
UPDATE public.photos
SET
  source_customer_code = public.parse_source_customer_code(storage_path),
  source_time_code = public.parse_source_time_code(storage_path),
  source_file_code = public.parse_source_file_code(storage_path),
  source_speed_kmh = public.parse_speed_kmh(storage_path),
  speed_kmh = public.parse_speed_kmh(storage_path)
WHERE storage_path IS NOT NULL;


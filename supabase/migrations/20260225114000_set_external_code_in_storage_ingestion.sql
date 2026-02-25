/*
  # Set external_code during storage ingestion

  Goal:
  - Keep existing upload/sync flow unchanged
  - Populate photos.external_code from filename stem (without extension)
    Example: 1406206236002028.jpg -> 1406206236002028
*/

CREATE OR REPLACE FUNCTION public.handle_new_storage_object()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix text;
  v_customer_code text;
  v_park_id uuid;
  v_candidate_count integer;
  v_attraction_id uuid;
  v_external_code text;
BEGIN
  v_prefix := public.path_prefix(NEW.name);
  v_customer_code := public.parse_source_customer_code(NEW.name);
  v_external_code := NULLIF(
    regexp_replace(
      regexp_replace(COALESCE(NEW.name, ''), '^.*/', ''),
      '\\.[^.]+$',
      ''
    ),
    ''
  );

  -- 1) Preferred routing: explicit path prefix (park-slug/...)
  IF v_prefix IS NOT NULL THEN
    SELECT ppp.park_id
    INTO v_park_id
    FROM public.park_path_prefixes ppp
    WHERE ppp.path_prefix = v_prefix
      AND ppp.is_active = true
    LIMIT 1;
  END IF;

  -- 2) Legacy fallback (no/invalid prefix): infer from unique camera mapping
  IF v_park_id IS NULL AND v_customer_code IS NOT NULL THEN
    SELECT COUNT(DISTINCT pc.park_id), MIN(pc.park_id::text)::uuid
    INTO v_candidate_count, v_park_id
    FROM public.park_cameras pc
    WHERE pc.customer_code = v_customer_code
      AND pc.is_active = true;

    IF COALESCE(v_candidate_count, 0) <> 1 THEN
      v_park_id := NULL;
    END IF;
  END IF;

  -- 3) Final fallback: unique bucket->park mapping only
  IF v_park_id IS NULL THEN
    SELECT COUNT(DISTINCT psb.park_id), MIN(psb.park_id::text)::uuid
    INTO v_candidate_count, v_park_id
    FROM public.park_storage_buckets psb
    WHERE psb.bucket_id = NEW.bucket_id;

    IF COALESCE(v_candidate_count, 0) <> 1 THEN
      v_park_id := NULL;
    END IF;
  END IF;

  -- If still unresolved, skip safely.
  IF v_park_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pc.attraction_id
  INTO v_attraction_id
  FROM public.park_cameras pc
  WHERE pc.park_id = v_park_id
    AND pc.customer_code = v_customer_code
    AND pc.is_active = true
  LIMIT 1;

  INSERT INTO public.photos (
    storage_bucket,
    storage_path,
    captured_at,
    speed_kmh,
    source_customer_code,
    source_time_code,
    source_file_code,
    source_speed_kmh,
    camera_code,
    attraction_id,
    park_id,
    external_code,
    created_at
  )
  VALUES (
    NEW.bucket_id,
    NEW.name,
    NEW.created_at,
    public.parse_speed_kmh(NEW.name),
    v_customer_code,
    public.parse_source_time_code(NEW.name),
    public.parse_source_file_code(NEW.name),
    public.parse_speed_kmh(NEW.name),
    v_customer_code,
    v_attraction_id,
    v_park_id,
    v_external_code,
    now()
  )
  ON CONFLICT (park_id, storage_bucket, storage_path) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

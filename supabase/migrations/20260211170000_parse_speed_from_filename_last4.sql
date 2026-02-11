/*
  # Parse speed from filename last 4 digits

  ## Rule
  If filename is `123456.jpg`, speed is `34.56` km/h (last 4 digits / 100).

  ## Changes
  - Update `parse_speed_kmh(path text)` to support this rule
  - Keep compatibility with existing `34,56 km/h` naming pattern
  - Backfill existing photos where speed is missing/zero
*/

CREATE OR REPLACE FUNCTION parse_speed_kmh(path text)
RETURNS numeric AS $$
DECLARE
  base_name text;
  stem text;
  kmh_match text;
  digits text;
  last_four text;
BEGIN
  IF path IS NULL OR length(path) = 0 THEN
    RETURN NULL;
  END IF;

  -- 1) Backward-compatible pattern: "34,56 km/h" or "34.56km/h"
  kmh_match := (regexp_matches(path, '(\d{1,3}[,\.]\d{1,2})\s*km/h', 'i'))[1];
  IF kmh_match IS NOT NULL THEN
    RETURN replace(kmh_match, ',', '.')::numeric;
  END IF;

  -- 2) New rule: last 4 digits of filename represent speed * 100
  base_name := split_part(path, '/', array_length(string_to_array(path, '/'), 1));
  stem := regexp_replace(base_name, '\.[^.]+$', '');
  digits := regexp_replace(stem, '\D', '', 'g');

  IF length(digits) < 4 THEN
    RETURN NULL;
  END IF;

  last_four := right(digits, 4);
  RETURN (last_four::numeric / 100.0);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE photos
SET speed_kmh = parse_speed_kmh(storage_path)
WHERE storage_path IS NOT NULL
  AND (speed_kmh IS NULL OR speed_kmh = 0);

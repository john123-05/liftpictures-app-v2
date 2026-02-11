/*
  # Storage Trigger für automatische Photo-Erfassung

  ## Änderungen

  ### 1. Index auf photos.captured_at
  - Erstellt Index für effiziente Zeitbereich-Abfragen
  - Sortiert nach captured_at DESC für schnelle neueste-zuerst Abfragen

  ### 2. Trigger Function: handle_new_storage_object
  - Wird ausgelöst bei INSERT in storage.objects
  - Filtert nach bucket_id='test'
  - Erstellt automatisch photos-Record mit:
    - storage_bucket = bucket_id
    - storage_path = name (Pfad der Datei)
    - captured_at = created_at (Upload-Zeitstempel)
    - created_at = now()
  - ON CONFLICT DO NOTHING verhindert Duplikate

  ### 3. Trigger: on_storage_object_created
  - Hört auf INSERT Events in storage.objects
  - Führt handle_new_storage_object() aus

  ## Zweck
  Automatische Synchronisation von Storage-Uploads mit photos-Tabelle
  für nahtlose Integration mit der Galerie-Ansicht.
*/

-- Index auf captured_at für effiziente Zeitbereich-Abfragen
CREATE INDEX IF NOT EXISTS idx_photos_captured_at 
  ON photos(captured_at DESC);

-- Function die bei Storage-Upload ausgeführt wird
CREATE OR REPLACE FUNCTION handle_new_storage_object()
RETURNS TRIGGER AS $$
BEGIN
  -- Nur für bucket 'test' ausführen
  IF NEW.bucket_id = 'test' THEN
    -- Photo-Record erstellen (on conflict do nothing für Sicherheit)
    INSERT INTO public.photos (
      storage_bucket,
      storage_path,
      captured_at,
      created_at
    )
    VALUES (
      NEW.bucket_id,
      NEW.name,
      NEW.created_at,
      now()
    )
    ON CONFLICT (storage_bucket, storage_path) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger erstellen (drop first wenn bereits vorhanden)
DROP TRIGGER IF EXISTS on_storage_object_created ON storage.objects;

CREATE TRIGGER on_storage_object_created
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_storage_object();
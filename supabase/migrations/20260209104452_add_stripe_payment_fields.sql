/*
  # Add Stripe Payment Fields and Speed Extraction

  ## Changes

  ### 1. Extend photos table
  - `price_cents` (integer) - Photo price in cents, default 300 (3.00 EUR)
  - `currency` (text) - Currency code, default 'eur'
  - `is_paid` (boolean) - Global paid flag (optional), default false
  - `stripe_product_id` (text, nullable) - Stripe product reference
  - `stripe_price_id` (text, nullable) - Stripe price reference
  - Index on is_paid for filtering

  ### 2. Extend purchases table
  - `stripe_checkout_session_id` (text, unique) - Stripe checkout session ID
  - `stripe_payment_intent_id` (text, nullable) - Stripe payment intent ID
  - `amount_cents` (integer) - Amount paid in cents
  - `currency` (text) - Currency used
  - `paid_at` (timestamptz, nullable) - When payment completed
  - Additional indexes on status and photo_id

  ### 3. Speed extraction function
  - `parse_speed_kmh(path text)` - Extracts speed from filename pattern like "34,48 km/h"
  - Returns numeric value with decimal point
  - Returns null if pattern not found

  ### 4. Update storage trigger
  - Automatically extracts speed_kmh from filename on insert

  ### 5. Backfill existing photos
  - Updates speed_kmh for all existing photos where null
*/

-- =====================================================
-- PHOTOS TABLE: Add payment fields
-- =====================================================

-- Add price_cents column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'photos' AND column_name = 'price_cents'
  ) THEN
    ALTER TABLE photos ADD COLUMN price_cents integer NOT NULL DEFAULT 300;
  END IF;
END $$;

-- Add currency column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'photos' AND column_name = 'currency'
  ) THEN
    ALTER TABLE photos ADD COLUMN currency text NOT NULL DEFAULT 'eur';
  END IF;
END $$;

-- Add is_paid column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'photos' AND column_name = 'is_paid'
  ) THEN
    ALTER TABLE photos ADD COLUMN is_paid boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add stripe_product_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'photos' AND column_name = 'stripe_product_id'
  ) THEN
    ALTER TABLE photos ADD COLUMN stripe_product_id text;
  END IF;
END $$;

-- Add stripe_price_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'photos' AND column_name = 'stripe_price_id'
  ) THEN
    ALTER TABLE photos ADD COLUMN stripe_price_id text;
  END IF;
END $$;

-- Create index on is_paid
CREATE INDEX IF NOT EXISTS idx_photos_is_paid ON photos(is_paid);

-- =====================================================
-- PURCHASES TABLE: Add Stripe fields
-- =====================================================

-- Add stripe_checkout_session_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'stripe_checkout_session_id'
  ) THEN
    ALTER TABLE purchases ADD COLUMN stripe_checkout_session_id text;
  END IF;
END $$;

-- Add unique constraint on stripe_checkout_session_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchases_stripe_checkout_session_id_key'
  ) THEN
    ALTER TABLE purchases ADD CONSTRAINT purchases_stripe_checkout_session_id_key 
      UNIQUE (stripe_checkout_session_id);
  END IF;
END $$;

-- Add stripe_payment_intent_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'stripe_payment_intent_id'
  ) THEN
    ALTER TABLE purchases ADD COLUMN stripe_payment_intent_id text;
  END IF;
END $$;

-- Add amount_cents column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'amount_cents'
  ) THEN
    ALTER TABLE purchases ADD COLUMN amount_cents integer;
  END IF;
END $$;

-- Add currency column to purchases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'currency'
  ) THEN
    ALTER TABLE purchases ADD COLUMN currency text;
  END IF;
END $$;

-- Add paid_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE purchases ADD COLUMN paid_at timestamptz;
  END IF;
END $$;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_photo_id ON purchases(photo_id);

-- =====================================================
-- SPEED EXTRACTION FUNCTION
-- =====================================================

-- Function to parse speed from filename
-- Extracts patterns like "34,48 km/h" or "34.48 km/h"
-- Returns numeric value with decimal point
CREATE OR REPLACE FUNCTION parse_speed_kmh(path text)
RETURNS numeric AS $$
DECLARE
  speed_match text;
  speed_value numeric;
BEGIN
  -- Try to extract speed pattern: digits with comma or dot followed by km/h
  -- Pattern matches: "123,45 km/h" or "12.34km/h" (with optional space)
  speed_match := (regexp_matches(path, '(\d{1,3}[,\.]\d{1,2})\s*km/h', 'i'))[1];
  
  IF speed_match IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Replace comma with dot for numeric conversion
  speed_match := replace(speed_match, ',', '.');
  
  -- Convert to numeric
  speed_value := speed_match::numeric;
  
  RETURN speed_value;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- UPDATE STORAGE TRIGGER TO EXTRACT SPEED
-- =====================================================

-- Enhanced function that extracts speed from filename
CREATE OR REPLACE FUNCTION handle_new_storage_object()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process for bucket 'test'
  IF NEW.bucket_id = 'test' THEN
    -- Create photo record with speed extraction
    INSERT INTO public.photos (
      storage_bucket,
      storage_path,
      captured_at,
      speed_kmh,
      created_at
    )
    VALUES (
      NEW.bucket_id,
      NEW.name,
      NEW.created_at,
      parse_speed_kmh(NEW.name),
      now()
    )
    ON CONFLICT (storage_bucket, storage_path) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- BACKFILL SPEED FOR EXISTING PHOTOS
-- =====================================================

-- Update existing photos to extract speed from their storage_path
UPDATE photos
SET speed_kmh = parse_speed_kmh(storage_path)
WHERE speed_kmh IS NULL AND storage_path IS NOT NULL;
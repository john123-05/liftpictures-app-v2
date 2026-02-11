/*
  # Warenkorb und Unlock System

  ## Neue Tabellen

  ### 1. cart_items
  - Speichert Artikel im Warenkorb des Users
  - Columns:
    - id (uuid, primary key)
    - user_id (uuid, references auth.users)
    - photo_id (uuid, references photos)
    - quantity (integer, default 1)
    - created_at (timestamptz)
  - Unique constraint: (user_id, photo_id)

  ### 2. purchase_items
  - Einzelne Artikel eines Kaufs
  - Columns:
    - id (uuid, primary key)
    - purchase_id (uuid, references purchases)
    - item_type (text: 'photo', 'photopass', 'ticket')
    - photo_id (uuid, nullable)
    - product_code (text, nullable)
    - unit_amount_cents (integer)
    - quantity (integer)
    - created_at (timestamptz)

  ### 3. unlocked_photos
  - Freigeschaltete Fotos für User
  - Columns:
    - id (uuid, primary key)
    - user_id (uuid, references auth.users)
    - photo_id (uuid, references photos)
    - unlocked_at (timestamptz)
  - Unique constraint: (user_id, photo_id)

  ### 4. leaderboard_entries
  - Leaderboard Einträge (nur für gekaufte Fotos)
  - Columns:
    - id (uuid, primary key)
    - user_id (uuid, references auth.users)
    - photo_id (uuid, references photos)
    - speed_kmh (numeric)
    - ride_date (date)
    - created_at (timestamptz)
  - Unique constraint: (user_id, photo_id)

  ## Sicherheit
  - RLS aktiviert auf allen Tabellen
  - Users können nur ihre eigenen Daten sehen/ändern
*/

-- =====================================================
-- CART_ITEMS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  photo_id uuid REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_user_photo_unique UNIQUE (user_id, photo_id)
);

-- Enable RLS
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own cart items"
  ON cart_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cart items"
  ON cart_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cart items"
  ON cart_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cart items"
  ON cart_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_photo_id ON cart_items(photo_id);

-- =====================================================
-- PURCHASE_ITEMS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES purchases(id) ON DELETE CASCADE NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('photo', 'photopass', 'ticket')),
  photo_id uuid REFERENCES photos(id) ON DELETE SET NULL,
  product_code text,
  unit_amount_cents integer NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own purchase items"
  ON purchase_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.id = purchase_items.purchase_id
      AND purchases.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_photo_id ON purchase_items(photo_id);

-- =====================================================
-- UNLOCKED_PHOTOS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS unlocked_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  photo_id uuid REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unlocked_photos_user_photo_unique UNIQUE (user_id, photo_id)
);

-- Enable RLS
ALTER TABLE unlocked_photos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own unlocked photos"
  ON unlocked_photos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unlocked_photos_user_id ON unlocked_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_photos_photo_id ON unlocked_photos(photo_id);

-- =====================================================
-- LEADERBOARD_ENTRIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  photo_id uuid REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
  speed_kmh numeric NOT NULL,
  ride_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_entries_user_photo_unique UNIQUE (user_id, photo_id)
);

-- Enable RLS
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- Policies (Leaderboard ist öffentlich sichtbar)
CREATE POLICY "Anyone can view leaderboard entries"
  ON leaderboard_entries FOR SELECT
  TO authenticated
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_speed_kmh ON leaderboard_entries(speed_kmh DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_ride_date ON leaderboard_entries(ride_date DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_user_id ON leaderboard_entries(user_id);

-- =====================================================
-- UPDATE PURCHASES TABLE (if needed)
-- =====================================================

-- Add total_amount_cents if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'total_amount_cents'
  ) THEN
    ALTER TABLE purchases ADD COLUMN total_amount_cents integer;
  END IF;
END $$;
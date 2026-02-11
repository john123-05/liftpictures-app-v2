# MASTER PROMPT: Neue Webapp (Next.js + TypeScript) mit bestehendem Supabase-Backend

Kopiere den kompletten Prompt unten 1:1 in dein anderes Projekt/Tool.

---

## Prompt zum Einfügen

Du bist ein Senior Full-Stack Engineer und sollst eine **neue Webapp** (keine Mobile-App) bauen, die an ein **bereits existierendes Supabase-Backend** angebunden wird.

### 0) Harte Regeln (nicht verhandelbar)

1. **Nicht-destruktiv arbeiten**:
   - Keine Tabellen löschen.
   - Keine bestehenden Spalten löschen/umbenennen.
   - Keine bestehenden Policies verschlechtern.
   - Bestehende Edge Functions nicht inkompatibel ändern.
2. **Nur additive Änderungen**, falls zwingend nötig (z. B. neue View, zusätzliche Spalte, zusätzliche Policy).
3. **RLS respektieren** und alle Client-Queries so bauen, dass sie mit RLS funktionieren.
4. **Secrets niemals im Browser**:
   - `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` nur serverseitig.
5. Bestehende Business-Logik muss erhalten bleiben:
   - Speed parsing aus Dateiname (letzte 4 Ziffern / 100).
   - `unlocked_photos` beeinflusst Leaderboard.
   - Tagespass schaltet Tagesbilder frei.
   - Newsletter/Poup-Einstellungen persistent.

---

### 1) Zielstack und Architekturvorgabe

- Framework: **Next.js (App Router) + TypeScript**
- Styling: modernes, minimalistisches Web-UI (responsive, mobile-first)
- Datenzugriff:
  - Browser: Supabase Client mit `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Server: separater Supabase-Client für sichere Operationen (wo erforderlich)
- Zahlungen:
  - Stripe Checkout über bestehende Supabase Edge Functions
  - Webhook-Verarbeitung über bestehende Backend-Logik

---

### 2) Pflicht-ENV-Contract

Erstelle/erwarte diese Umgebungsvariablen:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (nur Server/Edge)
- `STRIPE_SECRET_KEY` (nur Server/Edge)
- `STRIPE_WEBHOOK_SECRET` (nur Webhook-Handling)

Zusatz:
- Wenn nötig für API-Aufrufe: `SUPABASE_PROJECT_REF` oder klare Basiskonfiguration für Function-URL.

---

### 3) Bestehender Backend-Contract (muss unterstützt werden)

#### Tabellen (Fokus)

- `users`
- `rides`
- `photos`
- `favorites`
- `purchases`
- `purchase_items`
- `cart_items`
- `unlocked_photos`
- `leaderboard_entries`
- `newsletter_subscriptions`
- `stripe_customers`
- `stripe_subscriptions`
- `stripe_orders`

#### Wichtige Edge Functions

- `cart-checkout`
- `stripe-checkout`
- `stripe-webhook`
- `delete-account`

#### Bestehende Kernlogik

- Speed kann aus `photos.speed_kmh` kommen oder aus `storage_path` geparsed werden:
  - letzte 4 Ziffern des Dateinamens / 100
- Käufe führen zur Freischaltung in `unlocked_photos`
- Tagespass-Fälle können ohne einzelne `photo_id` vorkommen; Freischaltung über Tag
- Leaderboard basiert auf freigeschalteten Fotos
- Newsletter + Popup (`popup_enabled`) bleiben pro User gespeichert

---

### 4) Feature-Scope (vollständig)

Die neue Webapp soll folgende Bereiche vollständig abdecken:

1. **Landingpage**
   - Marketing-Startseite
   - CTA zu Login/Signup/App-Bereich
2. **Auth**
   - Signup, Login, Logout, Session-Restore
   - Benutzerprofil laden/synchronisieren
3. **Galerie**
   - Ride-bezogene Bildanzeige
   - Kaufstatus pro Bild
   - Favoriten persistent (auch nach Logout/Login)
4. **Warenkorb**
   - Bilder hinzufügen
   - Duplikat-Logik (gleiches Bild nicht mehrfach kaufen)
5. **Checkout**
   - Checkout Session starten
   - Stripe Redirect/Return
   - Webhook-basierte Freischaltung (nicht client-seitig faken)
6. **Gekaufte Bilder**
   - Liste der freigeschalteten Bilder
   - Download/Share-Funktionalität
7. **Dashboard/Ranking**
   - Höchstgeschwindigkeit aus freigeschalteten Bildern
   - Tagesranking mit User-Daten
8. **Profil**
   - Avatar
   - Display Name
   - Account-Security Einstellungen
9. **Newsletter & Benachrichtigungen**
   - Subscribe/Unsubscribe
   - Popup Enabled Toggle
10. **Account Delete**
   - Sicherer Löschflow mit Bestätigung
   - Backend-getriggerte tatsächliche Löschung

---

### 5) Öffentliche Interfaces/Typen (verbindlich)

Erstelle und verwende klare TypeScript-Interfaces (mindestens):

- `UserProfile`
- `Ride`
- `Photo`
- `CartItem`
- `Purchase`
- `UnlockedPhoto`
- `LeaderboardEntry`
- `NewsletterSubscription`
- `CheckoutRequest`
- `CheckoutResponse`
- `DeleteAccountRequest`
- `DeleteAccountResponse`
- Gemeinsames Fehlerformat, z. B.:
  - `ApiError { code: string; message: string; details?: unknown }`

Zusätzlich:
- konsistentes UI-State-Modell pro Feature: `idle | loading | success | error`

---

### 6) Security & Compliance Vorgaben

1. Service-Role niemals clientseitig.
2. Admin-Operationen nur serverseitig.
3. Webhook-Signatur validieren.
4. Keine Umgehung von RLS.
5. Nur minimal notwendige Daten im Frontend.
6. Sensible Logs vermeiden (keine Secrets/Tokens im Log).

---

### 7) Implementierungsreihenfolge (Pflicht)

Arbeite strikt in dieser Reihenfolge:

1. Setup & ENV
2. Auth
3. Datenzugriff (Users/Rides/Photos/Favorites)
4. Commerce (Cart + Checkout + Unlock)
5. Dashboard/Leaderboard
6. Profil (inkl. Avatar/Display Name)
7. Newsletter & Popup Settings
8. Account Delete
9. QA/Abnahme

Für jeden Schritt liefern:
- Dateien/Module
- kurz begründete Architekturentscheidung
- Definition of Done

---

### 8) Definition of Done (DoD) je Modul

Jedes Modul ist nur fertig, wenn:

1. Typisierung vollständig und strikt ist.
2. Fehlerfälle abgefangen und angezeigt werden.
3. Loading-/Empty-/Error-States vorhanden sind.
4. RLS-kompatible Queries genutzt werden.
5. Keine Secrets im Client landen.
6. Mindestens Basis-Tests/Checks beschrieben oder implementiert sind.

---

### 9) Akzeptanzkriterien (müssen erfüllt sein)

1. End-to-end Kauf funktioniert, Foto wird freigeschaltet.
2. Favoriten bleiben nach Logout/Login erhalten.
3. Tagespass schaltet Tagesfotos frei.
4. Ranking aktualisiert sich nach Kauf.
5. Profiländerungen (inkl. Display Name/Avatar) persistieren.
6. Newsletter/Popup Settings bleiben persistiert.
7. Account-Delete-Flow ist bestätigt und sicher.

---

### 10) Testfälle (mindestens diese Szenarien)

1. Auth-Flow: Signup, Login, Session-Restore, Logout.
2. Galerie-Flow: Ride auswählen, Fotos laden, Favorit setzen/entfernen.
3. Cart-Flow: Bild hinzufügen, Duplikat verhindern, Checkout starten.
4. Payment-Flow: Stripe Session, Webhook, Unlock prüfen.
5. Day-Pass-Flow: Kauf ohne einzelne `photo_id`, Tagesfreischaltung prüfen.
6. Dashboard-Flow: Höchstgeschwindigkeit und Ranking aktualisieren.
7. Profil-Flow: Avatar + Display Name persistieren.
8. Newsletter-Flow: Subscribe/Unsubscribe + Popup Toggle über Sessions hinweg.
9. Delete-Flow: Bestätigung + endgültige Löschung.

---

### 11) Gewünschtes Output-Format vom Builder

Liefere am Ende:

1. Strukturierte Dateiliste mit neu/angepasst.
2. Relevante Codeausschnitte oder vollständige Dateien.
3. ENV-Setup-Anleitung.
4. Migrationen nur falls zwingend (additiv, rollback-sicher).
5. Testprotokoll (was wurde geprüft, Ergebnis).
6. Offene Risiken + nächste sinnvolle Schritte.

---

### 12) Annahmen/Defaults (fest)

1. Zieltechnologie: **Next.js + TypeScript**
2. Umfang: **komplette Funktionsabdeckung**
3. Security-Modus: **Production-sicher**
4. Fokus: neue **Webapp/Landingpage mit App-Bereich**, nicht Mobile-App
5. Bestehendes Backend ist die Source of Truth

---

### 13) Eingaben, die ich dir gleich gebe

Nutze folgende Inputs, sobald ich sie poste:

- Supabase URL
- Supabase Anon Key
- ggf. Supabase Project Ref
- ggf. Stripe Public/Secret Setup-Hinweise

Wenn eine Information fehlt, frage gezielt nach genau der fehlenden Variable und blockiere keine anderen Schritte.


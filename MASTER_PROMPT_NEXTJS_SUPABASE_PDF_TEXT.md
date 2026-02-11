# Spezifikation für neue Webapp mit bestehendem Supabase-Backend
## PDF-freundliche Fassung (1:1 exportierbar)

**Version:** 1.0  
**Datum:** 2026-02-11  
**Projektziel:** Erstellung einer neuen Webapp (Landingpage + App-Bereich) auf Basis von Next.js + TypeScript mit Anbindung an bestehendes Supabase-Backend.

---

## 1. Zielsetzung

Diese Spezifikation beschreibt verbindlich, wie eine neue Webapp umzusetzen ist, die das bestehende Backend vollständig nutzt.  
Der Umsetzende (Builder/Agent/Team) soll mit diesem Dokument ohne weitere Design- oder Backend-Grundsatzentscheidungen arbeiten können.

---

## 2. Nicht-funktionale Leitplanken

1. Keine destruktiven Backend-Änderungen.
2. Additive Änderungen nur bei zwingender Notwendigkeit.
3. Bestehende RLS-Policies dürfen nicht abgeschwächt werden.
4. Secrets dürfen nicht im Browser ausgeliefert werden.
5. Bestehende Geschäftslogik muss kompatibel bleiben.

---

## 3. Zielarchitektur

### 3.1 Technologie-Stack

- Next.js (App Router)
- TypeScript
- Supabase JS Client (Browser + Server getrennt)
- Stripe Checkout über bestehende Supabase Edge Functions

### 3.2 Sicherheitsmodell

- Public Client Zugriff nur mit `NEXT_PUBLIC_*`
- Privilegierte Schlüssel ausschließlich serverseitig
- Webhook-Verifikation zwingend
- Keine Admin-Operation aus Browser-Kontext

---

## 4. ENV-Vertrag

| Variable | Verwendung | Sichtbarkeit |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + App Runtime | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + App Runtime | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/Edge-only Operationen | Secret |
| `STRIPE_SECRET_KEY` | Checkout/Webhook Serverlogik | Secret |
| `STRIPE_WEBHOOK_SECRET` | Signaturprüfung Webhook | Secret |

**Regel:** Secrets niemals in Client-Bundles, Browser-Logs oder öffentliche Responses geben.

---

## 5. Backend-Vertrag (Bestandsdaten)

### 5.1 Tabellen (müssen unterstützt werden)

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

### 5.2 Edge Functions (bestehend)

- `cart-checkout`
- `stripe-checkout`
- `stripe-webhook`
- `delete-account`

### 5.3 Relevante Bestandslogik

1. Geschwindigkeitsermittlung:
   - Primär aus `speed_kmh`, alternativ Parsing aus Dateiname (`letzte 4 Ziffern / 100`).
2. `unlocked_photos` wirkt auf Leaderboard-Logik.
3. Tagespass-Fälle können ohne einzelne `photo_id` verarbeitet werden.
4. Newsletter + Popup-Einstellungen werden pro User persistent gespeichert.

---

## 6. Funktionsumfang (verbindlich)

1. Landingpage (Marketing) mit sauberem Übergang in Auth/App-Bereich.
2. Auth: Signup, Login, Logout, Session-Restore.
3. Galerie: ride-bezogen, Kaufstatus, Favoriten persistent.
4. Warenkorb: Duplikat-Käufe desselben Fotos verhindern.
5. Checkout: Stripe Redirect + webhook-basierte Freischaltung.
6. Gekaufte Bilder: Anzeige, Download, Sharing.
7. Dashboard/Ranking: Top-Speed aus freigeschalteten Fotos.
8. Profil: Avatar, Display Name, Security-Einstellungen.
9. Newsletter/Popup: subscribe/unsubscribe + popup toggle, persistent.
10. Account-Löschung: sicherer Bestätigungsflow + tatsächliche Löschung.

---

## 7. Öffentliche Interfaces / Typen

Folgende Typen sind mindestens bereitzustellen und konsistent zu nutzen:

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
- `ApiError` (standardisiertes Fehlerformat)

Zusätzlich pro UI-Feature: Zustandsmodell `idle | loading | success | error`.

---

## 8. Umsetzungsreihenfolge (Pflicht)

1. Setup und ENV
2. Auth
3. Datenzugriff
4. Commerce (Cart + Checkout + Unlock)
5. Dashboard/Leaderboard
6. Profil
7. Newsletter + Popup Settings
8. Delete Account
9. QA und Abnahme

---

## 9. Definition of Done

Ein Modul gilt nur als abgeschlossen, wenn:

1. TypeScript-Typisierung konsistent und strikt ist.
2. Loading-/Empty-/Error-States vorhanden sind.
3. RLS-konforme Zugriffe sichergestellt sind.
4. Keine Secrets in Browser-Kontext gelangen.
5. Fehlerfälle sauber behandelt und kommuniziert werden.

---

## 10. Akzeptanzkriterien

1. E2E-Kauf schaltet Bild korrekt frei.
2. Favoriten überleben Logout/Login.
3. Tagespass schaltet Tagesbilder frei.
4. Dashboard/Ranking aktualisieren sich nach Kauf.
5. Profiländerungen bleiben gespeichert.
6. Newsletter-/Popup-Settings bleiben gespeichert.
7. Delete-Flow ist bestätigt und sicher.

---

## 11. Pflicht-Testfälle

1. Auth: Signup/Login/Session-Restore/Logout.
2. Galerie: Laden, Filter, Favoriten toggeln.
3. Warenkorb: Add, Duplikatverhinderung, Checkout-Start.
4. Payment: Session, Redirect, Webhook, Unlock.
5. Day Pass: Kauf ohne einzelne `photo_id`, Tagesfreischaltung.
6. Dashboard: Höchstgeschwindigkeit + Tagesranking.
7. Profil: Avatar + Display Name Persistenz.
8. Newsletter: Subscribe/Unsubscribe + Popup Toggle Persistenz.
9. Delete: Bestätigung + tatsächliche Löschung.

---

## 12. Deliverables des Umsetzenden

1. Liste aller neuen/geänderten Dateien.
2. ENV-Setup und Startanleitung.
3. Implementierte Schnittstellen/Typen.
4. Falls notwendig additive Migrationen (inkl. Rollback-Hinweis).
5. Testprotokoll mit Ergebnissen.
6. Offene Risiken und empfohlene Next Steps.

---

## 13. Feste Annahmen

1. Zieltechnologie: Next.js + TypeScript.
2. Scope: vollständige Funktionsabdeckung.
3. Security-Level: production-sicher.
4. Artefaktziel: Landingpage/Webapp, nicht Mobile-App.
5. Bestehendes Supabase-Backend ist Source of Truth.

---

## 14. Prompt-Block für externe Builder (Copy/Paste)

Verwende den Inhalt aus `MASTER_PROMPT_NEXTJS_SUPABASE.md` als direkte Arbeitsanweisung.  
Dieses Dokument ist die PDF-freundliche Spezifikationsdarstellung desselben Inhalts.


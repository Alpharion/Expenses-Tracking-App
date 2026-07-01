# DBS Expenses Tracker — Implementation Plan

## Context

DBS Bank sends transaction notification emails to Gmail, but the DBS app lacks proper categorisation and the emails clutter the inbox. This app solves both problems: it reads those emails via the Gmail API, classifies each transaction using Llama3, stores them in Supabase, and presents a clean mobile-first dashboard filterable by month, category, and inflow/outflow. It's deployed as a PWA on Vercel so it can be saved to the home screen and behaves like a native app.

**Framework choice:** React + Next.js as a PWA on Vercel is the recommended path. Flutter Web and React Native with Expo can both be deployed free as web apps, but React/Next.js has better Vercel integration, mature OAuth tooling via NextAuth, and PWA add-to-home-screen works well on both iOS and Android — no app store accounts needed.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend + API | Next.js 14 (App Router) | Single repo, API routes, Vercel-native |
| Database | Supabase (free tier) | Postgres, JS client, easy SQL editor |
| Auth | NextAuth v5 (beta) | Native App Router support, handles Gmail OAuth + token refresh |
| Email source | Gmail API via `googleapis` | Reads DBS transaction emails from user's Gmail |
| AI classification | Llama3-8b via Groq API (free) | Fastest free Llama3 inference |
| PWA | `next-pwa` | Zero-config Workbox service worker |
| Styling | Tailwind CSS | Mobile-first, utility-first |
| Deployment | Vercel Hobby (free) | Auto-deploys from git, serverless functions |

---

## Final File Structure

```
DBS_Expenses_App/
├── .env.local
├── next.config.js
├── public/
│   ├── manifest.json
│   └── icons/icon-192.png, icon-512.png
├── app/
│   ├── layout.tsx              ← root layout, PWA meta tags
│   ├── providers.tsx           ← SessionProvider wrapper
│   ├── page.tsx                ← main dashboard (filter state, data fetch)
│   ├── globals.css
│   └── api/
│       ├── auth/[...nextauth]/route.ts   ← NextAuth handler
│       ├── gmail/sync/route.ts           ← Gmail → Groq → Supabase pipeline
│       └── transactions/route.ts         ← GET (filtered list) + DELETE (by filter)
├── components/
│   ├── SummaryCards.tsx        ← total inflow / outflow / net
│   ├── FilterBar.tsx           ← month, category, type selectors
│   ├── TransactionList.tsx
│   ├── TransactionCard.tsx     ← single row with emoji, merchant, amount
│   ├── SyncButton.tsx
│   └── ClearButton.tsx         ← two-tap confirmation before deleting
└── lib/
    ├── auth.ts                 ← NextAuth config (Google provider + JWT callbacks)
    ├── gmail.ts                ← Gmail API helpers + token refresh
    ├── groq.ts                 ← Llama3 prompt + structured JSON extraction
    ├── supabase.ts             ← service_role client (server-only)
    └── types.ts                ← shared TS interfaces
```

---

## Supabase Schema

Run this in the Supabase SQL editor (no CLI needed):

```sql
create table if not exists public.transactions (
  id               uuid primary key default gen_random_uuid(),
  gmail_message_id text unique not null,      -- deduplication key
  date             date not null,
  amount           numeric(12, 2) not null,
  type             text not null check (type in ('inflow', 'outflow')),
  category         text not null,
  merchant         text,
  description      text,
  raw_snippet      text,
  created_at       timestamptz not null default now()
);

create index idx_transactions_date     on public.transactions (date desc);
create index idx_transactions_type     on public.transactions (type);
create index idx_transactions_category on public.transactions (category);

alter table public.transactions disable row level security;
```

RLS is disabled — the `service_role` key is used only in server-side API routes, never exposed to the browser.

---

## Environment Variables (`.env.local`)

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>

GOOGLE_CLIENT_ID=         # from Google Cloud Console
GOOGLE_CLIENT_SECRET=

NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=   # from Supabase dashboard → Settings → API

GROQ_API_KEY=             # from console.groq.com
```

All of these go into Vercel → Project → Settings → Environment Variables for production. Update `NEXTAUTH_URL` to the production domain.

---

## Key Implementation Details

### Gmail OAuth (`/lib/auth.ts`)

NextAuth v5 with Google provider. Critical flags:
- `access_type: "offline"` + `prompt: "consent"` — ensures a `refresh_token` is returned on first login
- `scope` includes `https://www.googleapis.com/auth/gmail.readonly`
- JWT callbacks store `accessToken`, `refreshToken`, and `expiresAt` in the encrypted session cookie

Token refresh is handled in `/lib/gmail.ts`: before each Gmail call, check if the token expires within 60 seconds and fetch a new one via `https://oauth2.googleapis.com/token`.

### Gmail Fetch (`/lib/gmail.ts`)

Search query for DBS emails:
```
from:donotreply@dbs.com OR from:dbsbank@dbs.com subject:"transaction" OR subject:"payment" OR subject:"credit" OR subject:"debit"
```
Fetches up to 100 messages. Email bodies are base64url-encoded; handle both `text/plain` and nested `multipart/alternative` structures.

### Groq Classification (`/lib/groq.ts`)

Model: `llama3-8b-8192` (free, fast). Upgrade to `llama3-70b-8192` if accuracy is insufficient.

System prompt instructs Llama3 to return **only** this JSON (no markdown, no explanation):
```json
{
  "amount": <number, SGD>,
  "type": <"inflow" | "outflow">,
  "merchant": <string | null>,
  "description": <string>,
  "date": <"YYYY-MM-DD">,
  "category": <"Food"|"Transport"|"Shopping"|"Entertainment"|"Bills"|"Transfer"|"Health"|"Travel"|"Groceries"|"Other">
}
```
Non-transaction emails return `{"skip": true}`. Temperature is 0 for deterministic output. Email body truncated to 3000 chars to stay within token limits.

**Rate limiting:** Groq free tier allows ~30 req/min. Process emails in batches of 5, with a 10-second delay between batches.

### Sync Route (`/app/api/gmail/sync/route.ts`)

```
POST /api/gmail/sync
```
1. Auth check (NextAuth session)
2. Refresh Gmail token if needed
3. Fetch DBS emails from Gmail
4. Classify each email via Groq (batched)
5. Upsert to Supabase with `onConflict: "gmail_message_id"` + `ignoreDuplicates: true`
6. Return `{ synced: N, total: M }`

Set `export const maxDuration = 60` on this route (Vercel Hobby allows up to 60s function timeout).

### Transactions Route (`/app/api/transactions/route.ts`)

- `GET ?month=2026-06&category=Food&type=outflow` — returns filtered list, ordered by date desc
- `DELETE ?month=...&category=...&type=...` — requires at least one filter (safety guard against full wipe)

### Frontend (`/app/page.tsx`)

Filter state (month, category, type) is managed in React state. Any change triggers a `fetchTransactions()` call to the GET route. Default month is current month.

`ClearButton` uses a two-tap pattern: first tap sets `confirming = true` and shows "Tap again to confirm"; second tap sends the DELETE. `onBlur` resets `confirming` if the user taps away.

### PWA (`next.config.js` + `/public/manifest.json`)

`next-pwa` is disabled in development to prevent caching issues. Manifest theme colour is DBS red (`#ef4444`). Add `<link rel="apple-touch-icon">` in `layout.tsx` for iOS home screen support.

---

## One-Time External Setup (Manual Steps)

1. **Google Cloud Console:**
   - Create project → Enable Gmail API
   - OAuth consent screen: External, add your Gmail as test user
   - Create OAuth credentials (Web Application type)
   - Add redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://<your-app>.vercel.app/api/auth/callback/google`

2. **Groq:** Sign up at console.groq.com → API Keys → Create key

3. **Supabase:** Create project → run the schema SQL above → copy URL and service_role key

---

## Implementation Order

| # | Task | Checkpoint |
|---|------|------------|
| 1 | Bootstrap: `npx create-next-app@14` + install deps | `npm run dev` runs |
| 2 | Supabase schema in SQL editor | Table visible in dashboard |
| 3 | Add `.env.local` + `/lib/types.ts` + `/lib/supabase.ts` | TypeScript compiles |
| 4 | `/lib/auth.ts` + NextAuth route + providers wrapper | Google sign-in works |
| 5 | `/lib/gmail.ts` | Test with console.log in a temp route |
| 6 | `/lib/groq.ts` | Test classify on a hardcoded email string |
| 7 | `/app/api/gmail/sync/route.ts` | `POST /api/gmail/sync` returns JSON |
| 8 | `/app/api/transactions/route.ts` | GET + DELETE work via curl/Postman |
| 9 | All components (bottom-up) | Each renders correctly |
| 10 | Wire `/app/page.tsx` | Full flow works locally |
| 11 | PWA config (`next.config.js` + manifest + icons) | Lighthouse PWA score > 90 |
| 12 | Deploy to Vercel + add production env vars | Production URL accessible |
| 13 | Add production redirect URI in Google Cloud | OAuth works in production |

---

## Dependencies

```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"

npm install next-auth@beta @supabase/supabase-js groq-sdk googleapis next-pwa date-fns
```

---

## Verification

**Local checklist:**
- Sign in with Google → redirected to dashboard
- Click "Sync Gmail" → network tab shows `/api/gmail/sync` response with `synced` count
- Supabase Table Editor shows rows after sync
- Changing filters updates the transaction list
- Summary cards (In/Out/Net) match the visible filtered rows
- "Clear filtered" requires two taps; rows disappear from Supabase after confirm
- Re-sync → no duplicate rows (test `gmail_message_id` unique constraint)

**PWA:**
- Chrome DevTools → Application → Manifest: loads correctly
- Application → Service Workers: SW registered
- Android Chrome: Add to Home Screen works
- iOS Safari: Share → Add to Home Screen works

**Edge cases to test:**
- Sync with 0 DBS emails → `{ synced: 0 }` with no error
- Gmail token expired (>1 hour old) → refresh succeeds transparently
- Groq returns malformed JSON → email is skipped gracefully (try/catch in `classifyTransaction`)

**Prompt calibration:** Before building the UI, test the Groq prompt against 5–10 real DBS email bodies. DBS sends different formats for credit card alerts, PayNow transfers, GIRO debits, and ATM withdrawals. Adjust the system prompt if any format is misclassified. Add `"If this is a monthly statement (not a transaction alert), return {\"skip\": true}"` to handle statement emails.

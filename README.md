# Macro Tracker

Expo (React Native) app + Supabase backend.

## Run it

```bash
npm install
cp .env.example .env.local
npx expo start
```

Scan the QR code with the Expo Go app (iPhone camera or Android Expo Go).

## Database

Schema lives in `supabase/migrations/`. It's already applied to the Macro Tracker Supabase project.
New changes go in a new migration file — never edit an applied one.

## Layout

- `src/app/` — screens (Expo Router; every file is a route)
- `src/components/` — shared UI
- `src/lib/` — Supabase client, queries, target math, weight trend

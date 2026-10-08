# Know Me or Not?

A mobile-first social guessing game for 2–8 friends. The checked-in experience contains the complete product journey as an interactive demo; the Supabase schema and client boundary are ready for a hosted project.

## Run locally

1. Copy `.env.example` to `.env.local` and add your Supabase values.
2. Run `pnpm install`, then `pnpm dev`.
3. Use `pnpm test`, `pnpm lint`, and `pnpm build` before release.

Anonymous sign-in must be enabled in Supabase. Apply the SQL in `supabase/migrations`, seed curated questions, and keep the secret key server-only. Without Supabase values the polished local demo still runs, but it does not claim cross-device synchronization.

See `ARCHITECTURE.md`, `DATABASE.md`, `TESTING.md`, `DEPLOYMENT.md`, and `ANDROID_RELEASE.md`.

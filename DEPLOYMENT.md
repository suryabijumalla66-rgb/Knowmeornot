# Deployment

Create a dedicated Supabase project named `know-me-or-not`, enable anonymous sign-ins, apply the migration, run the seed, and deploy `supabase/functions/game-api` with JWT verification enabled. Add the project URL and publishable key from `.env.example` to the frontend host, build, and deploy over HTTPS. The Edge Function receives its server-only credentials from Supabase; never copy them into the browser deployment.

Before public launch, add rate limiting for room creation/join/answer submission, CAPTCHA for suspicious anonymous traffic, scheduled cleanup for expired rooms, and integration tests against a staging database. Configure the production origin for invite URLs and PWA metadata.

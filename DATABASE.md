# Database and security

Apply `supabase/migrations/20261008183228_complete_multiplayer_backend.sql` to a new Supabase project and run `supabase/seed.sql`. The migration creates constrained rooms, seats, games, rounds, private answers, results, compatibility statistics, rate-limit buckets, transactional state functions, private Realtime authorization and indexes. RLS is enabled on every public table.

Enable anonymous authentication and use only the publishable key in the browser. Never expose a secret/service-role key. Creation, joining, starting, submitting, timeout advancement, scoring, removal, host reassignment and rematches go through the authenticated `game-api` Edge Function. The SQL functions lock room/round rows, use `clock_timestamp()`, reject duplicates and late answers, and commit scoring plus state advancement atomically.

Do not add `round_answers` to a broadly readable Realtime publication. Before reveal, each user may read only their own answer. Return aggregate answer counts, not answer IDs. Run Supabase database/security advisors after applying the migration.

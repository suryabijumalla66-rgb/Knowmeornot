# Architecture

The App Router UI is a mobile-first state-driven game surface. `lib/game.ts` owns deterministic, testable round planning, substitution, room-code creation, and score rules. `lib/questions.ts` contains 120 curated question records. Supabase anonymous auth provides a durable browser identity; room membership binds that identity to exactly one seat.

Production state is authoritative in Postgres: `WAITING → STARTING → QUESTION_ACTIVE → REVEAL → INTERMISSION → FINISHED`. Trusted server functions validate the expected room version, server time, membership and current round inside one transaction. Clients subscribe only to public room/member/round changes, then reconcile by refetching. Private answer rows are never added to a public Realtime publication. A reveal projection is produced only after the deadline or complete submission set.

The browser signs in anonymously, then calls the authenticated `game-api` Edge Function. That function validates the user JWT and invokes one narrowly granted service-role RPC. All state transitions execute transactionally in PostgreSQL. Browsers cannot call the trusted game RPC or read gameplay tables directly.

Room events use private Realtime topics (`room:<uuid>:game`). Database triggers send only a room ID and timestamp, never an answer. Clients reconcile by fetching an authorization-filtered snapshot. The snapshot includes the caller's own answer while a round is active and includes all results only after reveal.

# Testing

Run `pnpm test` for scoring, speed bonus, 2/5/8-player plans, fair subject counts, unique questions, substitution and room codes. Run `pnpm lint` and `pnpm build` for static checks.

For multiplayer QA, create one room and open its invite in four independent Playwright browser contexts (not tabs sharing storage). Assert unique anonymous sessions, synchronized start/deadline timestamps, private pre-reveal payloads, one accepted answer per member, atomic simultaneous final submissions, refresh recovery, host disconnect/reassignment, subject timeout skip, results, and rematch. Network-loss tests should toggle contexts offline and confirm reconciliation on reconnect.

The repository cannot honestly mark hosted Realtime, RLS or transaction tests as passed until the dedicated `know-me-or-not` Supabase project exists, the migration is applied and the Edge Function is deployed. Use five independent browser contexts against that project before production approval.

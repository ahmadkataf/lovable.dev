# Browser checks (Playwright)

Run against a local API + built site (`npm --prefix web run build`, then `wrangler dev --local` in `api/` with a fresh
D1 that has an admin `0985258963` / `Admin123!` — see `api/scripts/privacy-smoke.mjs`, which creates it):

- `node web/e2e/team-push.mjs` — the team panel's notification card in every permission state, the in-app hint
  (`?np=1/0`), single permission request, sign-out unlink. `OUT=<dir>` keeps screenshots.
- `node web/e2e/sync-recovery.mjs` — one failed request must not leave the panel "offline": a confirm made right after
  still reaches the server. `OFF=<days>` picks a free date when re-running on the same database.

Both expect the server at `http://127.0.0.1:8799`.

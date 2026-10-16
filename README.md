# Independent Sports Lab — Render-ready prototype

## No-cost goals
- Self-contained Node 20+ service, no npm packages and no API keys.
- Free Render **web service** supports this server, subject to Render usage limits and sleeping.
- No Render cron job is used because that is paid.
- The service compares predictions with ESPN-posted odds *after* producing projected scores.

## Start locally
`npm start` then visit http://localhost:3000. `npm test` runs smoke tests.

## Publish (blocked until a Git URL exists)
Render's deployment tools require a cloneable Git repository. Create one and push these files, then create a Render free-tier Node web service with:
- build command: `npm install`
- start command: `npm start`
- health check: `/health`
- environment PORT is assigned by Render
Do **not** add payment information or choose paid cron/database features.

## What isn't migrated
This is a portable working prototype, **not** a finished replacement: historical v3 database records and BET validation gates, pregame persistent snapshots, unattended background checks, push notifications, and verified injury/lineup ingestion are not yet migrated. As a safety measure, all model opportunities are labeled WATCH rather than BET. Never infer positive EV or historical ROI from the listed edge alone.

ESPN endpoints are undocumented and might change or limit access; track feed warnings. Render free web service can sleep between visits and has no guaranteed 24/7 background operation. Keep the existing Floot deployment until an alternative is tested.

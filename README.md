# TaskTracker · Taskline

A personal task organizer for classes, general tasks, and personal life.

## Features

- Create, edit, complete, reopen, and delete tasks.
- Due dates and optional local-clock due times; overdue and upcoming views.
- Low, medium, high, and urgent priorities.
- Suggested or custom task types, notes, and in-progress status.
- Create and rename color-coded subjects within Classes, General, and Personal.
- Daily, weekday, weekly, monthly, and yearly recurrence with custom intervals.
- Completed history, search, priority filtering, and sorting.
- Responsive desktop and phone interface.
- Persistent Cloudflare D1 storage with per-user ownership checks.

## Recurring tasks

Completing an occurrence creates exactly one next occurrence, based on the previous due date. Missed dates are not automatically skipped. Monthly schedules preserve their original day, clamping to shorter months (January 31 → February 28 → March 31). Yearly leap-day schedules also retain the original day. Completed recurring occurrences cannot be reopened while their next occurrence exists; edit the next occurrence instead. Deleting one occurrence does not delete other occurrences. Date/time fields represent the calendar date and local clock time entered; this version does not send reminders or integrate external calendars.

## Development

Node.js 22.13+ and the pnpm version declared in `package.json` are required.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_absurd_hellion.sql
pnpm dev
```

Run the migration once for a new local database. Local development uses a development-only identity. Production rejects unauthenticated API calls and trusts identity headers injected by the Sites authentication gateway. Do not expose this Worker directly without a trusted gateway that strips client-supplied identity headers.

```sh
pnpm exec tsc --noEmit
node --experimental-strip-types --test tests/recurrence.test.mjs
```

## Architecture and hosting

React + TypeScript, Vinext, Tailwind, Shadcn/Radix, and Cloudflare Workers + D1. The live app uses private Sites hosting. GitHub stores source code only; personal tasks are stored separately in the database, never in this repository. GitHub Pages cannot host the authenticated API and database. GitHub changes do not automatically deploy to the live app; publish through Sites after changes.

- `app/page.tsx`: task workspace and editors
- `app/api/workspace/route.ts`: validated, owner-scoped API and atomic recurrence
- `lib/task-model.ts`: input validation, types, calendar recurrence
- `db/schema.ts` and `drizzle/`: database schema and migrations
- `.openai/hosting.json`: hosting and database binding

Publishing requires a Cloudflare-compatible build, generated migrations, and the Sites deployment workflow. No API keys or database contents are committed.

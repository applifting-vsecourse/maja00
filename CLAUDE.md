# Quacker — starter template

Full-stack teaching template: pnpm monorepo with two apps.

- `apps/backend` — NestJS + Prisma + Postgres. Auth: BetterAuth (mounted at `/api/auth/*`, treat as a black box). API docs: Swagger at `/api/docs`.
- `apps/frontend` — React + Vite + TanStack Router/Query, Tailwind + shadcn/ui, `ky` + `zod` API client. Feature folders under `src/features/`.

The worked example is the quack feed: `Quack` model → seed → repository → service → `GET`/`POST /api/quacks` (DTO-validated, author taken from the session) → zod schema → TanStack Query → list page + post form. Copy its pattern for new features.

**Before writing or changing any UI, read [`DESIGN.md`](DESIGN.md).** It is a contract, not a suggestion — it exists to stop generated screens drifting into generic nested cards.

## Commands

- `pnpm dev` — everything: env files, Postgres (Docker), migrate, seed, both dev servers
- `pnpm check-all` — lint + type-check + tests + build (same as CI)
- `pnpm backend test` / `pnpm frontend test:ci` — unit tests
- `pnpm backend prisma:migrations:run` — create/apply migrations after schema changes

## Conventions

Deliberately sparse — this file grows as the team learns what it expects from generated code. Add rules here when you find yourself repeating the same review feedback.

### UI controls come from the kit

Need a control that isn't in `src/components/ui/`? Add it with `pnpm dlx shadcn@latest add <name>` — don't hand-roll one in a feature folder, even where a native input would do the job. One accessibility implementation to reason about beats a per-control judgement call.

The CLI puts `shadow-xs`/`shadow-sm` on inputs, textareas and cards. [`DESIGN.md`](DESIGN.md) keeps shadows for things that genuinely float — dialogs, dropdowns, toasts. Strip them.

Always read the diff after running the CLI. It once added a stray `cn` package to `package.json`/`pnpm-lock.yaml` and made the new component import `cn` from it. Type-check passed because the package exists. Revert the `package.json` and lockfile changes and import `cn` from `@/lib/utils` like every other file in `src/components/ui/`. Primary-coloured fills (e.g. `bg-primary` on a progress bar) also need restyling to neutral tokens, since `primary` is for actions.

### Permissions are checked on the server

Every endpoint that changes or deletes data checks, in the service, that the signed-in user may do it, and throws `ForbiddenException` (403) otherwise. The current user always comes from the session (`@User()`), never from the request body, the URL or a query parameter. Hiding a button in the UI is convenience, not protection: assume someone will call the API directly.

### New roles

Add the role to the `UserRole` enum and extend the single check in the service. Don't add role checks in React or controllers as the only protection.

### The app is already running

Assume the dev servers are up. If something is listening on the app's ports, that is this application: use it. Don't start a second instance, don't restart it, don't run `pnpm dev`.

Don't reach for the browser to check your own work. Tests and type-checks are the evidence; open the running app when asked to, not on your own initiative.

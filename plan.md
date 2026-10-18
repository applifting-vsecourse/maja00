# Plan: Polls on quacks

Implements [`story.md`](story.md). Nothing is built yet. This plan follows the existing quack pattern: schema, repository, service, controller, zod schema, TanStack Query, UI.

## Design in one paragraph

A poll belongs to exactly one quack. Counts are never stored. They are computed from the vote rows on every read, so they can't drift. The database enforces one vote per user per poll with a composite primary key, and "switching" is an upsert on that key, so concurrent requests can't create a second vote. "Closed" is derived from `closesAt <= now` on the server, so there is no status column and no background job. The server decides who may see counts and leaves them out of the response for non-voters, so hiding them is not just a UI matter.

## Data model

Three new tables in `apps/backend/prisma/schema.prisma`, with one migration.

```prisma
model Poll {
  id        String       @id @default(cuid())
  quack     Quack        @relation(fields: [quackId], references: [id], onDelete: Cascade)
  quackId   String       @unique              // at most one poll per quack
  closesAt  DateTime
  createdAt DateTime     @default(now())
  options   PollOption[]
  votes     PollVote[]

  @@map("poll")
}

model PollOption {
  id       String     @id @default(cuid())
  poll     Poll       @relation(fields: [pollId], references: [id], onDelete: Cascade)
  pollId   String
  text     String     @db.VarChar(50)
  position Int                                // display order, 0-based
  votes    PollVote[]

  @@unique([pollId, position])
  @@unique([id, pollId])                      // lets a vote prove its option belongs to its poll
  @@map("poll_option")
}

model PollVote {
  poll      Poll       @relation(fields: [pollId], references: [id], onDelete: Cascade)
  pollId    String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  option    PollOption @relation(fields: [optionId, pollId], references: [id, pollId], onDelete: Cascade)
  optionId  String
  createdAt DateTime   @default(now())
  updatedAt DateTime   @default(now()) @updatedAt

  @@id([pollId, userId])                      // one vote per user per poll, enforced by the DB
  @@index([optionId])
  @@map("poll_vote")
}
```

Also add `poll Poll?` to `Quack` and `pollVotes PollVote[]` to `User`.

The migration is `pnpm backend prisma:migrations:run`.

What the database guarantees:

- **One vote per person:** the primary key `(pollId, userId)`.
- **A vote can't point at another poll's option:** the composite foreign key `(optionId, pollId)`.
- **Cleanup:** deleting a user removes their votes, so counts drop accordingly. Deleting a quack removes its poll, options and votes.

What the service guarantees, because the schema can't express it:

- The author can't vote.
- A closed poll takes no votes.
- Option count (2–4), option length (1–50) and duration (1 minute to 7 days) are validated.

### Seed

Add to `apps/backend/src/scripts/seed/seed/` (next to `create-quack.ts`) one open poll with a few votes and one closed poll, so every UI state can be seen without clicking through.

## API

All routes are under `/api` and use the existing `AuthenticatedUserGuard`, `ValidationPipe` and Swagger tags. The author always comes from the session. The poll code goes into the quack module, in new files beside the quack ones (poll repository and poll methods on `QuacksService`), because a poll is part of the quack aggregate and a separate module would just need to import back.

### `POST /api/quacks` (extended)

The body gains an optional `poll`:

```json
{
  "text": "Where do we go for lunch?",
  "mood": "happy",
  "poll": { "options": ["Pizza", "Ramen", "Salad"], "durationMinutes": 1440 }
}
```

- `poll.options`: array of 2–4 strings, each trimmed, non-empty, at most 50 characters.
- `poll.durationMinutes`: integer from 1 to 10080 (7 days). The form takes days, hours and minutes and sends the total.
- The server sets `closesAt = now + durationMinutes`, using its own clock.
- Responses: `201` with the quack, or `400` if invalid (same as today).

### `GET /api/quacks` (extended)

Each quack now carries `poll: PollDto | null`. The poll is shaped for the requesting user:

```json
"poll": {
  "id": "…",
  "closesAt": "2026-10-20T12:00:00.000Z",
  "closed": false,
  "options": [
    { "id": "…", "text": "Pizza", "votes": 6 },
    { "id": "…", "text": "Ramen", "votes": 9 }
  ],
  "totalVotes": 15,
  "myVoteOptionId": "…",
  "canVote": true
}
```

- `votes` and `totalVotes` are `null` for someone who may not see counts yet. That is a non-author who hasn't voted, while the poll is open. They are numbers for the author, for people who have voted, and for everyone once the poll is closed.
- `canVote` is `!closed && viewer is not the author`.
- `myVoteOptionId` is `null` if the viewer hasn't voted. The author always gets `null`.
- Percentages are computed by the client from `votes` and `totalVotes`.
- This is built in a fixed number of queries, however many quacks are in the list: the polls with their options, one `groupBy` for the counts of those polls, and the viewer's own votes. It does not query once per quack.
- Search is unaffected. The raw search query still only picks quack ids, and the poll data is attached afterwards.

### `PUT /api/quacks/:quackId/poll/vote`

Body: `{ "optionId": "…" }`. This is idempotent and means "my vote is this option", so it covers both first votes and switches.

- Does an upsert on `(pollId, userId)` and returns the updated `PollDto` for the viewer, with counts visible because they have now voted.
- Errors:

| Status | When                                                               |
| ------ | ------------------------------------------------------------------ |
| `400`  | body invalid                                                       |
| `403`  | the viewer is the author                                           |
| `404`  | no such quack, quack has no poll, or the option isn't in that poll |
| `409`  | the poll is closed                                                 |

- The close check and the upsert run in one transaction. A vote landing in the few milliseconds around `closesAt` may go either way. That is acceptable for this feature.

No endpoint for withdrawing a vote, editing a poll, or listing voters, as per the story.

## Backend structure (mirrors the existing quack files)

- `domain/poll.ts`: types plus a pure function `toPollView(poll, counts, viewer, now)` that applies the visibility rules. This is the one place those rules live, so it gets the most unit tests.
- `repositories/`: add `createQuack` with a nested poll create, batched poll loading for `getQuacks`, and `voteOnPoll`. Only the repository touches Prisma.
- `services/quacks.service.ts`: `getQuacks(viewer, search)` (now needs the viewer), `createQuack` accepts the poll, and a `voteOnPoll` method that does the author/closed/option checks and throws Nest `ForbiddenException`, `NotFoundException` and `ConflictException`.
- `controllers/`: extend `CreateQuackDto` with a nested poll DTO (`@ValidateNested`, `@ArrayMinSize(2)`, `@ArrayMaxSize(4)`, `@Min(1)`, `@Max(10080)`). Add `VoteDto`, `PollResponseDto`, and the extended `QuackResponseDto`. All get Swagger decorators.

## Frontend structure

- `api/quackSchemas.ts`: add `pollSchema` (`votes` and `totalVotes` nullable) and `poll: pollSchema.nullable()` on `quackSchema`.
- `api/voteOnPoll.ts` and `hooks/useVoteOnPoll.ts`: the mutation, built like `useAddQuack`.
- `api/addQuack.ts`: pass the optional poll through.
- `components/PollForm` inside `QuackForm`: an "Add poll" button reveals 2 option inputs (up to 4, with add and remove) and days, hours and minutes inputs (default 1 day). Fields have labels, validation errors show under the field, and the submit button keeps its pending state. Uses the existing `Input` and `Label`. No new control is needed for the toggle.
- `components/QuackPoll.tsx`, rendered by `QuackItem` when `quack.poll` is set. It has four states:
  1. **Can vote, no counts:** options as buttons, plus time left.
  2. **Results:** count, percentage and bar per option, your pick marked, total votes, time left. Switching is available while open.
  3. **Author view:** results, no vote buttons.
  4. **Closed:** final results for everyone, with a "Closed" label.
- Bars use shadcn `progress`, added with `pnpm dlx shadcn@latest add progress` (the project rule: no hand-rolled controls). The CLI's shadows are stripped per `CLAUDE.md`.
- Styling follows `DESIGN.md`: no card inside the quack row, hairline separators, semantic colours only, `primary` is not used on option buttons, and inline errors use `destructive`.

### Optimistic voting

`useVoteOnPoll` uses `onMutate` to update every cached list under `quackKeys.lists()`, keeps a snapshot, restores it in `onError`, and invalidates in `onSettled`.

- **Switching:** counts are known, so the old option goes down by one and the new one up by one at once.
- **First vote:** the viewer didn't have counts, so none can be shown instantly. The pick is marked immediately, and the counts fill in as soon as the response arrives (typically a fraction of a second), with a skeleton in the meantime. It does not invent a count.
- **On error:** roll back, then show an inline message on that poll: "Your vote didn't go through. Try again." On a `409`, the poll is refetched and shown as closed with its final counts instead.
- Freshness is already configured (`refetchOnWindowFocus: true` in `config/react-query.ts`), so the focus refresh needs no extra code.
- Time left is computed from `closesAt` at render. A poll that closes while the page is open is corrected on the next focus refresh or failed vote.

## Build order

Each step ends with `pnpm check-all` passing and could be committed on its own.

1. **Schema, migration, seed.** The tables above, plus seeded polls. Nothing else changes yet.
2. **Domain logic.** `poll.ts` and `toPollView`, with unit tests for every visibility rule (author, voter, non-voter, open, closed).
3. **Repository.** Create a quack with a poll, load polls batched into `getQuacks`, and the vote upsert. Repository specs include "two simultaneous votes from one user leave one row" and "an option from another poll is rejected".
4. **Service and controller.** Extended create, extended list, and the vote endpoint. Service specs cover author, closed, wrong option, switching, and the 2–4 / 50 / 1–10080 minute limits. Check the endpoints in Swagger at `/api/docs`.
5. **Frontend: show polls.** Schemas and `QuackPoll` in all four states, driven by the seed data.
6. **Frontend: create polls.** The poll part of the form, with validation and tests.
7. **Frontend: vote.** The mutation with optimistic update, rollback and the inline error. Tests: success, switch, failure rollback, closed response.
8. **Final pass.** `pnpm check-all`, the acceptance criteria in `story.md` one by one, and a check that quacks without polls, search, mood and settings behave as before.

Steps 1–4 are the backend and can be reviewed without any UI. Steps 5–7 are the frontend.

## Decisions I made that you may want to change

- **Closed poll vote returns `409`.** Not `400`, because the request is valid and only the poll's state forbids it.
- **First vote shows no instant counts,** only your marked pick and a skeleton for the counts. Showing a guessed count would break "the numbers have to be right".
- **Poll code lives in the quack module,** not a new module.
- **Percentages are computed on the client,** so the API stays plain counts.
- **No usage logging line.** The story says to measure with database queries. A search-style log line like `Quack search: …` would be a two-line addition if you'd rather have it.

## Verification

- Automated: `pnpm backend test`, `pnpm frontend test:ci`, `pnpm check-all`.
- The dev servers are already running, so I won't start another instance or open the browser unless you ask me to.
- Manual check, if you want one afterwards: use the seeded open and closed polls to see all four states, and vote as a second user.

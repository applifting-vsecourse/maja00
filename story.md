# Story: replies

Product owner: "People discuss under quacks by posting a new quack that starts with '@name …', and nobody can tell what anyone is replying to. I want people to reply to a quack and see the replies under it. Replies belong to the people who wrote them: if an author deletes a quack that already has replies, the replies must not disappear with it. At the same time, when someone deletes their quack, its content has to really disappear from the app."

As a quacker, I want to reply to any quack and read the whole conversation under it, so I can tell who is answering what.

## Acceptance criteria

Feed, search and Mine

- The All feed shows only top-level quacks, newest first. Each shows the number of its **direct** replies (tombstones included), linking to its thread.
- A deleted top-level quack that still has replies stays in the feed as "This quack was deleted · N replies", linking to its thread.
- Search finds quacks at every level. Mine shows all my quacks at every level.
- A reply in search or Mine shows "Replying to @name" (or "Replying to a deleted quack") linking to the parent's thread.
- Tombstones never appear in search or in Mine.

Thread page `/quacks/$quackId`

- Shows the chain of quacks above the opened one (as context), the opened quack highlighted, then its whole subtree.
- Replies are sorted oldest first. Indentation grows up to 4 levels. Deeper replies stay at level 4 and show "Replying to @name".
- A tombstone shows only "This quack was deleted": no avatar, name, time, Reply or Delete.
- An unknown id shows the not-found state.

Replying

- Every live quack on the thread page has a Reply button that opens a form under it: text and mood (the default mood applies), no poll.
- After posting, the thread reloads and the new reply is visible. The feed's reply count updates.
- The author comes from the session, never from the body.
- Replying to a deleted quack: no button, and the API returns 409. Replying to a non-existent quack returns 404. A reply with a poll returns 400. Signed out returns 401.

Deleting

- The author or an admin may delete, checked on the server (403 otherwise). An admin deleting someone else's quack is logged as today.
- A quack **without** replies is deleted completely, with its poll and votes.
- A quack **with** replies becomes a tombstone: text, mood, author and poll are removed from the database (not just hidden), and its replies stay in place.
- When the last reply under a tombstone is deleted, the tombstone is deleted too, recursively up the chain.
- The API never returns text, mood or author for a tombstone.

Out of scope

- Reply notifications, editing, pagination of threads, subtree reply counts.
- Account deletion. Note for whoever builds it: through `SetNull` the replies to the user's deleted quacks become top-level quacks. To keep them in their threads, tombstone those quacks first.
- Converting old "@name …" quacks into replies.

## Decisions

1. **Depth: a full tree.** You can reply to any quack, at any depth.
   - Rejected: replies only to top-level quacks. Inside a thread you still couldn't tell which reply someone answered, the same problem one level down.
   - Rejected: a flat thread with `rootId`. It stores the root twice, and the precision of a tree was preferred.
2. **Deleting: hybrid.** A hard delete when there are no replies, a tombstone when there are. A childless tombstone is cleaned up.
   - Rejected: always a tombstone. It leaves empty rows for every deleted quack.
   - Rejected: always a hard delete. Replies would be orphaned and their context lost for good.
3. **`parentId` FK: `onDelete: SetNull`.** The app's own delete path never triggers it, because hybrid deletion handles quacks with replies. It only applies to deletes outside the app (a user cascade), where replies survive as top-level quacks.
   - Rejected: `Restrict`. It would block deleting a user whose quack has replies.
   - Rejected: `Cascade`. It silently erases other people's replies, contradicting the product owner.
4. **A tombstone keeps no author (`userId = NULL`).** "Really disappear" includes who wrote what in reply to whom.
   - Rejected: keeping `userId`, hidden in the API. It's reversible and needs fewer type changes, but it keeps personal metadata about deleted content.
5. **Threads on their own page.** The feed shows top-level quacks with a reply count.
   - Rejected: expanding inline in the feed. Deep trees get cramped in the column, and it drifts towards nested cards.
   - Rejected: replies in the feed. It brings back the noise the product owner complained about.
6. **Reply count: direct replies, computed** (`groupBy` on `parentId`).
   - Rejected: a subtree count through a recursive CTE. It needs extra raw SQL; it can be added later without a schema change.
   - Rejected: a stored `replyCount`. Stored twice, it drifts, and the database-side `SetNull` would need a trigger.
7. **A reply may have a mood, not a poll.**
   - Rejected: polls on replies. They get few votes deep in a thread, and they'd add poll state to every node.
8. **Replies appear in search and Mine,** with a "Replying to" link.
   - Rejected: top-level only. Your own replies would be impossible to find, even to delete them.
9. **A top-level tombstone with replies stays in the feed.** This follows from decisions 2 and 5.
   - Rejected: hiding every tombstone. Its replies would become unreachable, which in effect means they'd disappear.
10. **No replies to a tombstone (409). Thread oldest first. Indentation capped at 4 levels. Delete permissions unchanged.**

## Proposed schema

Only `Quack` changes. There are no new tables.

```prisma
model Quack {
  id        String     @id @default(cuid())
  /// null only on a tombstone (deleted quack that still has replies)
  text      String?    @db.Text
  mood      QuackMood?
  /// null only on a tombstone: the author of deleted content is not kept
  user      User?      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String?
  /// the quack this one replies to; null = top-level quack
  parent    Quack?     @relation("QuackReplies", fields: [parentId], references: [id], onDelete: SetNull)
  parentId  String?
  replies   Quack[]    @relation("QuackReplies")
  /// set when a quack with replies is deleted; the row stays as a tombstone
  deletedAt DateTime?
  poll      Poll?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @default(now()) @updatedAt

  @@index([userId])
  // children of a quack (thread, reply counts) + feed of top-level quacks newest first
  @@index([parentId, createdAt])
  @@map("quack")
}
```

Added by hand to the migration (Prisma doesn't model CHECK constraints):

```sql
-- A quack is either live (text + author) or a tombstone (neither), never half.
ALTER TABLE "quack" ADD CONSTRAINT "quack_tombstone_check"
  CHECK (("deletedAt" IS NULL) = ("text" IS NOT NULL AND "userId" IS NOT NULL));
ALTER TABLE "quack" ADD CONSTRAINT "quack_not_own_parent_check"
  CHECK ("parentId" IS NULL OR "parentId" <> "id");
```

### Reading it

| What the user sees | Query                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Feed               | `findMany` where `parentId = null` and (`deletedAt = null` or `replies: { some: {} }`), newest first |
| Reply counts       | one `groupBy` on `parentId` for the page                                                             |
| Search             | the existing `unaccent` raw query plus `deletedAt IS NULL`, then `findMany` by ids                   |
| Mine               | `findMany` where `userId = me` (tombstones have no author)                                           |
| "Replying to"      | `include: { parent: { select: id, deletedAt, user.username } }`                                      |
| Thread             | two `WITH RECURSIVE` CTEs (ancestors, subtree) → ids → one `findMany`; the tree is built in memory   |

### Stored twice?

No counts or copies. "Deleted" shows in `deletedAt`, `text IS NULL` and `userId IS NULL`. `quack_tombstone_check` keeps the three consistent, and the code reads only `deletedAt`.

### When a quack is deleted

- Through the app, without replies: the row is deleted and the poll, options and votes cascade. An ancestor tombstone left with no replies is deleted too, recursively.
- Through the app, with replies: the row is tombstoned and the poll is deleted explicitly. Replies are untouched.
- Creating a reply and deleting a quack both lock the parent row (`SELECT … FOR UPDATE`) in one transaction. Otherwise a new reply could silently become top-level, or a childless tombstone could survive.
- Outside the app (a user cascade): direct replies get `parentId = NULL` and become top-level along with their subtrees. A tombstone left childless is hidden by the feed filter.

### Migration on production data

The new columns are nullable with no default, and `DROP NOT NULL` doesn't rewrite the table. Every existing row is top-level (`parentId = NULL`) and live (`deletedAt = NULL`, `text` and `userId` set), so both CHECKs pass. The index, the FK and the CHECK validation scan the table once. For a large table, use `NOT VALID` + `VALIDATE` and `CREATE INDEX CONCURRENTLY`. Rolling back is lossless only until the first reply or tombstone exists.

## Where it lands

- Backend `apps/backend/src/modules/quack`: `domain/quack.ts` (live and deleted types), `quack.repository.ts` (feed filter, reply counts, parent include, `getThread`, hybrid `deleteQuack` in a transaction), `quacks.service.ts` (parent checks, no poll on a reply), `quacks.controller.ts` (`parentId` on `POST /api/quacks`, `GET /api/quacks/:quackId/thread`), the DTOs, the seed (sample threads).
- Frontend `apps/frontend/src/features/quack`: `quackSchemas`, `quackKeys`, `useAddQuack` (invalidating the thread), `QuackItem` (count, "Replying to"), a new route `routes/_ProtectedPages/quacks.$quackId.tsx`, a thread component, a reply form (`QuackForm` without the poll), the tombstone row.

## Done when

- Locally: reply three levels deep, delete the middle quack (it becomes a tombstone and its replies stay), delete its last reply (the tombstone goes too). In the database, the deleted text and author are gone.
- Unit tests cover hybrid deletion and the upward cleanup. An E2E test covers reply → thread → delete with replies → "This quack was deleted".
- Every permission check is on the server, and the author comes from the session.

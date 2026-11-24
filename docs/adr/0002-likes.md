# 2. Likes are rows in a join table, counted when read

- Status: Accepted (2026-11-24), not yet implemented
- Origin: [cases.md](../../cases.md), likes. Decisions 3 and 4.

## Context

Every live quack, replies included, can be liked: once per user, and unliked again. Every quack the API returns needs `likeCount` and `likedByMe` for the signed-in viewer, in the feed, the thread, search and Mine. Liking twice must still leave one like, also when two requests race (a double click, two tabs).

Likes also hang off a quack, so ADR 0001 applies: when a quack becomes a tombstone, its likes have to go in the same transaction. Who liked deleted content is not kept.

## Decision

A new table `quack_like`, one row per like:

```prisma
model QuackLike {
  quack     Quack    @relation(fields: [quackId], references: [id], onDelete: Cascade)
  quackId   String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  createdAt DateTime @default(now())

  // One like per user per quack, enforced by the database.
  @@id([quackId, userId])
  @@index([userId])
  @@map("quack_like")
}
```

- **One like per user** is the primary key `(quackId, userId)`, not a check in code. Liking is an insert that ignores the conflict (`ON CONFLICT DO NOTHING`), and unliking is a `deleteMany`. Both are idempotent, so two racing likes still leave one row.
- **The count is not stored.** Lists and threads load the counts for all quacks on the page with one `groupBy` on `quackId`, and the viewer's likes with one query (`userId = viewer AND quackId IN (…)`). That's the same pattern as reply counts and poll votes, and it keeps the number of queries fixed per page.
- **Deleting:** a hard-deleted quack takes its likes with it (`onDelete: Cascade`). A quack that becomes a tombstone gets its likes deleted in the tombstone transaction, next to its poll. A deleted user takes their likes with them.
- **A tombstone can't be liked.** The insert only happens while the quack is live (`deletedAt IS NULL`), checked in the same transaction as the insert, so a like can't land on a quack that is being turned into a tombstone at the same moment.

## Options considered

1. **A join table, counted when read (chosen).** One source of truth: the count can't disagree with the likes, whatever deletes them (the app, a tombstone, a user cascade). It costs two extra queries per page, which the existing indexes make cheap at this app's scale.
2. **A join table plus a stored `quack.likeCount`, updated in the same transaction.** Rejected for now. It makes reads one join cheaper, but the count is a copy that every path that removes likes has to keep right: unlike, tombstoning, and the user cascade, which runs in the database and never passes through the app. One forgotten path and the number is wrong for good. Worth revisiting only if counting ever shows up as slow; adding the column later is a migration plus a backfill, not a redesign.
3. **Only a counter on the quack.** Rejected. Without knowing who liked, the app can't keep it to one like per user, can't unlike, and can't answer `likedByMe`.

## Consequences

- **Quack queries get two more lookups** for counts and the viewer's likes. Every list and thread query has to include them, or the quack comes back without a count. The response always has both fields; a tombstone has `likeCount: 0`, `likedByMe: false`.
- **The tombstone transaction in `QuackRepository` grows a step**: delete the quack's likes along with its poll. A test checks that no like rows remain.
- **Like and unlike can't tell "already liked" from "just liked"**, by design: the answer is the current state, not what changed.
- **Deleting a user removes their likes** and so lowers counts on other people's quacks. That's intended: a like belongs to the person who gave it.
- **Any future feature that reads likes** (who liked, notifications, sorting by likes) can build on the table directly. Sorting the feed by likes would make the read-time count expensive; that is the point to revisit option 2.

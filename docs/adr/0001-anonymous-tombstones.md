# 1. Deleted quacks with replies become anonymous tombstones

- Status: Accepted (2026-11-10), not yet implemented
- Origin: [story.md](../../story.md), replies. Decisions 2 and 4.

## Context

Replies turn quacks into a tree (`Quack.parentId`). The product owner set two rules that pull against each other:

- If an author deletes a quack that already has replies, the replies must not disappear with it.
- When someone deletes their quack, its content has to really disappear from the app.

Until now, a delete was a hard `DELETE` of the row, and the poll and votes cascaded. In a tree, that row is what connects its replies to the conversation. So we need something that holds the place in the tree without keeping what was deleted.

This decision is broader than the replies feature. It changes what a `Quack` row can be. Until now every row had text and an author. From now on, some rows have neither. Every current and future reader of the `quack` table has to deal with that.

## Decision

A quack that has replies is not deleted. It becomes a **tombstone**, and in the same transaction:

- `text`, `mood` and **`userId`** are set to `NULL` and `deletedAt` is set to now.
- Its poll (with options and votes) is deleted.
- `id`, `parentId` and `createdAt` stay, so the replies keep their place in the thread.

A quack without replies is still hard-deleted. A tombstone is deleted as soon as it has no replies left. A database CHECK enforces that a row is either fully live or fully a tombstone:

```sql
CHECK (("deletedAt" IS NULL) = ("text" IS NOT NULL AND "userId" IS NOT NULL))
```

`deletedAt` is the one field code reads to tell them apart.

## Options considered

1. **A tombstone without an author (chosen).** It's the only option where both rules hold. Who wrote what in reply to whom is personal data about deleted content, so "really disappear" includes the author. The API can't leak an author it doesn't have.
2. **A tombstone that keeps `userId`, hidden in the API.** Rejected. It's a smaller change (`Quack.user` stays required) and reversible. But the database keeps attributable metadata about content the author deleted, and every response has to remember to leave it out. One forgotten DTO is a leak.
3. **No tombstone: a hard delete, with replies set to `parentId = NULL`.** Rejected. Nothing is left behind, but the replies lose their context and their subtrees come loose from the conversation. That defeats the replies feature. It stays only as the database's `onDelete: SetNull` safety net for deletes outside the app (a user cascade).
4. **No tombstone: a hard delete that cascades to the replies.** Rejected. It directly breaks "replies must not disappear".

## Consequences

Hard to undo:

- The author of a tombstone is gone for good. Moving to option 2 later can't restore it for tombstones that already exist, and the deleted text can't be restored or audited either. The only remaining trace is the moderation log line (`admin X deleted quack Y written by Z`, ids only), which the moderation story keeps on purpose.

For the rest of the app:

- **`Quack.text` and `Quack.userId` / `Quack.user` become nullable** in Prisma and in the generated types. The domain `Quack` splits into a live quack and a deleted one, so code that needs the author or the text has to narrow by `deletedAt` first.
- **Every query on `quack` has to decide about tombstones.** The feed shows a top-level tombstone only while it has replies. Search and "Mine" exclude tombstones (`deletedAt IS NULL`; "Mine" also drops them because `userId` is null). Any future reader (likes, profiles, notifications, statistics, exports) needs an explicit rule. The default is to exclude them.
- **Permission checks can't treat "no author" as "no quack".** The old `QuackRepository.findQuackAuthorId` returned `null` for a missing quack, and a tombstone also has a `null` author. It is replaced by `findQuackForDelete`, which returns the author and whether the quack is a tombstone, so the delete check can answer 404 for a missing quack and 409 for one that is already deleted.
- **Every response has to cope with an empty quack.** `QuackResponseDto` and the frontend zod schema get nullable `text` and `user`, and the UI renders a tombstone as "This quack was deleted".
- **Deleting a user doesn't remove their tombstones.** They no longer point to the user, so the `userId` cascade doesn't reach them. The replies keep them alive, and the hybrid cleanup removes them once the last reply is gone.
- **Any new feature hanging off a quack** (like the poll) has to define what happens to its rows when the quack becomes a tombstone. The default is to delete them in the same transaction, the way the poll is deleted.

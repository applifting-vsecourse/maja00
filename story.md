# Story: moderation

Product owner: "Someone started posting nasty quacks. Their author won't delete them and right now we can't do anything about it. We need a moderator who can delete anything. Nothing more for now."

As a moderator (an `admin`), I want to delete any quack, so I can remove nasty content when its author won't.

## Acceptance criteria

Deleting

- An admin sees a Delete action on every quack, not only their own.
- A regular user still sees Delete only on their own quacks.
- When an admin deletes someone else's quack, the confirm dialog says so ("You are deleting a quack written by someone else as a moderator."). Deleting their own quack uses the normal dialog.
- A regular user can't delete someone else's quack, not even by calling the API directly (403).
- Signed-out visitors still get 401.
- Whoever deletes, the server decides: the check is "owner or admin", done on the server for every request.

Out of scope ("nothing more for now")

- Notifying the author, a reason for the deletion, undo.
- Other moderator powers (editing, banning, a stats page).
- Other roles; the existing `user` and `admin` roles are enough.

## Decisions (from the questions)

1. The admin gets a different confirm text when deleting someone else's quack.
2. A moderator deletion is written to the server log (who deleted which quack, and whose it was). No database table, no notification to the author.
3. The Mine tab means the same for everyone: only my own quacks. An admin moderates from the All tab.

## Done when

- Locally: `admin@example.com` deletes someone else's quack; `deepduckthoughts@example.com` can't.
- An E2E test covers it: admin deletes someone else's quack, a regular user gets 403. It fails when the check is switched off.
- Every permission check is on the server, and "who am I" comes from the session, never from the URL or the body.

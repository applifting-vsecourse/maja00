# Cases: likes

Product owner: "People want to show they like a quack without replying. A like button and count on every quack. Each user can like once and unlike."

These cases are the spec. Each one becomes at least one test, written red before the implementation (`test: likes (red)`). The implementation must not change them; if a case turns out wrong, change it here first and say so in the PR.

## Decisions

1. **Authors can like their own quacks.** No exception: anyone signed in can like any live quack.
2. **Every live quack can be liked, replies included.** Likes show wherever a live quack shows: feed, thread page, search, Mine.
3. **Deleting a quack removes its likes.** A quack without replies is deleted with its likes. A quack that becomes a tombstone (ADR 0001) loses its likes too: who liked deleted content is not kept, like its text and author. A tombstone can't be liked or unliked (409) and shows no like button.
4. **Like and unlike are idempotent.** Liking twice keeps one like; unliking a quack you haven't liked changes nothing. Both answer 200 with the current state, so a double click or two open tabs never shows an error.
5. **The UI: a duck icon and a count.** The duck turns red (new `like` colour token, see below) when I have liked the quack. The count is hidden at 0. Clicking toggles at once (optimistic) and rolls back if the server says no.
6. **Signed-out visitors** can't see the app at all (they are sent to `/login`), and the API answers 401, likes included.

### Colour

`DESIGN.md` reserves `destructive` (the only red) for destructive actions and errors. Likes get their own token `like` in `global.css`, light and dark, at least 4.5:1 contrast, and `DESIGN.md` gets the rule "`like` only for the liked state".

## API

- `PUT /api/quacks/:quackId/like`: like. `DELETE /api/quacks/:quackId/like`: unlike.
- Both answer `200 { likeCount, likedByMe }`.
- Every quack in a list or thread response has `likeCount` (number) and `likedByMe` (boolean) for the signed-in viewer. A tombstone has `likeCount: 0`, `likedByMe: false`.

## Rules (unit)

Backend, service with a mocked repository:

- **Like a live quack.** Given a live quack, when a user likes it, then the like is stored for that user and the result is the new count with `likedByMe: true`.
- **Like your own quack.** Given my own live quack, when I like it, then it is liked like anyone else's.
- **Like a tombstone.** Given a deleted quack (tombstone), when a user likes or unlikes it, then a 409 (`ConflictException`) is thrown and nothing is stored.
- **Like a missing quack.** Given no quack with that id, when a user likes or unlikes it, then a 404 (`NotFoundException`) is thrown.
- **The liker comes from the session.** Given a request, then the user id passed to the repository is the signed-in user's, never anything from the URL or body.

Frontend, like button component:

- **Count hidden at 0.** Given a quack with 0 likes, then only the duck shows, no number. Given 3 likes, then "3" shows next to it.
- **Liked state.** Given `likedByMe: true`, then the button has `aria-pressed="true"` and the duck uses the `like` colour. Given `false`, then `aria-pressed="false"` and a neutral colour.
- **Accessible name.** The button's `aria-label` says the action and the count, e.g. "Like, 0 likes", "Unlike, 3 likes".
- **Optimistic toggle.** When I click Like on a quack with 2 likes, then it shows liked with 3 before the server answers.
- **Rollback.** When the server answers with an error, then the button goes back to its previous state (2, not liked) and an error toast shows.
- **No button on a tombstone.** Given a tombstone, then no like button renders.

## API behaviour (integration)

Real app over HTTP against `quacker_test`:

- **Signed out.** Given no session, when I `PUT` or `DELETE /api/quacks/:id/like`, then 401.
- **Like.** Given someone else's quack with 0 likes, when I like it, then 200 `{ likeCount: 1, likedByMe: true }`, and `GET /api/quacks` shows that quack with `likeCount: 1`, `likedByMe: true`.
- **Like twice.** Given I liked a quack, when I like it again, then 200 `{ likeCount: 1, likedByMe: true }`: still one like.
- **Unlike.** Given I liked a quack, when I unlike it, then 200 `{ likeCount: 0, likedByMe: false }`.
- **Unlike without a like.** Given I haven't liked a quack, when I unlike it, then 200 `{ likeCount: 0, likedByMe: false }`.
- **Own quack.** Given my own quack, when I like it, then 200 `{ likeCount: 1, likedByMe: true }`.
- **Per viewer.** Given users A and B both liked a quack and C did not, when each lists the feed, then all see `likeCount: 2`; A and B see `likedByMe: true`, C sees `false`.
- **Replies.** Given a reply, when I like it, then 200, and the thread `GET /api/quacks/:id/thread` shows the reply with `likeCount: 1`.
- **Search and Mine.** Given a liked quack, when it is found by search (`?q=`) or listed in Mine (`?mine=true`), then it has the same `likeCount` and `likedByMe`.
- **Unknown quack.** Given an id that doesn't exist, when I like or unlike it, then 404.
- **Tombstone.** Given a quack that was deleted but has replies (a tombstone), when I like or unlike it, then 409, and the thread shows it with `likeCount: 0`, `likedByMe: false`.
- **Delete without replies.** Given a liked quack with no replies, when its author deletes it, then the quack and its likes are gone from the database.
- **Delete with replies.** Given a liked quack with a reply, when its author deletes it, then it becomes a tombstone and no like rows for it remain in the database.

## Flows (E2E)

Playwright against the running app (seeded users):

- **Like and unlike in the feed.** Given I am signed in and someone else posted a quack with no likes, when I click its duck, then it turns liked (`aria-pressed="true"`) and shows "1". After a reload it is still liked with "1". When I click again, it is not liked and no number shows.
- **Another user sees the count, not my like.** Given user A liked a quack, when user B opens the feed, then that quack shows "1" and B's duck is not pressed.
- **Like a reply.** Given a thread with a reply, when I click the reply's duck on the thread page, then it shows liked with "1".

## Out of scope

- A list of who liked a quack.
- Notifications about likes.
- Liking with a reaction other than the duck.
- Sorting or filtering the feed by likes.

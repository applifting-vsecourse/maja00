# Story: Polls on quacks

## Story

As a Quacker user, I want to attach a poll to my quack so others can pick an answer and everyone sees correct counts, instead of counting replies by hand.

## Goal

Find out whether people use polls. Keep it small.

## Creating a poll

- Polls are optional. The post form gets an "Add poll" option, and the quack text is the question.
- A poll has 2 to 4 options, each at most 50 characters.
- Duration is free-form, entered as days, hours and minutes. The minimum is 1 minute, the maximum is exactly 7 days, and the default is 24 hours.
- The server validates all of this as well as the client.
- A poll cannot be edited after creation. Quacks cannot be edited or deleted today.
- Quacks without a poll behave exactly as before. Search still matches only quack text, not option text.

## Voting

- Each user has at most one vote per poll, enforced on the server.
- The author cannot vote in their own poll. The server rejects it and the UI shows no vote buttons to the author.
- A voter can switch to another option while the poll is open. A vote cannot be withdrawn, so after voting you always have exactly one vote.
- Voting is instant: the UI updates optimistically.
- If a vote fails (network error, server error, or the poll closed in the meantime), the UI rolls back to the previous state and shows an inline message on that poll, for example "Your vote didn't go through. Try again." If the poll closed, it switches to the closed state and shows the final counts.
- Counts always come from the server. Two concurrent votes or switches from different users must never produce wrong totals.

## Who sees results

- While a poll is open, counts are visible to people who have voted and to the author at all times.
- Before voting, a non-author sees the options and the time remaining, but no counts.
- When a poll closes, everyone sees the final result, including people who never voted. Voting and switching are locked and the poll is marked "Closed".
- Votes are anonymous in the UI. Nobody sees who picked what, only the counts and your own choice.
- Results show a count and a percentage per option, a simple bar, a mark on your choice, the total number of votes, and the time left to the minute (or "Closed").

## Freshness

- Counts refresh when the tab regains focus and after your own vote, following the existing rule in DESIGN.md. There is no live polling.
- Polls follow the existing feed states: loading, empty and error.

## Measuring success

- Polls and votes are stored, so polls created, votes cast and distinct voters can be counted with a database query later.
- No analytics or admin view is built.

## Acceptance criteria

1. A user can create a quack with a poll of 2 to 4 options and a duration from 1 minute up to 7 days. Invalid input is rejected on the client and the server.
2. A non-author who has not voted sees options and time left, with no counts.
3. After voting, that user sees counts, percentages, bars and their own choice marked.
4. A user can switch their vote while the poll is open. Totals stay correct and the total vote count does not change.
5. The author sees counts at all times and cannot vote, in the UI or through the API.
6. A user can never hold more than one vote per poll, even with simultaneous requests.
7. A failed vote reverts the UI and shows an inline message on that poll.
8. After the poll closes, everyone sees the final counts and nobody can vote or switch. A vote attempted after closing is rejected and the UI shows the closed state.
9. Quacks without polls, search, mood and the settings page are unaffected.

## Out of scope

Editing or deleting polls, withdrawing a vote, showing voters' names, searching option text, live updates, notifications, and an analytics or admin view.

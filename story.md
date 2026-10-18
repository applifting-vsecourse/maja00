# Story: Search quacks

**As** someone looking for a post I saw last week,
**I want** to type a word or a person's name and see only the posts that match,
**so that** I can find it again without scrolling the whole feed.

_Goal: ship the simplest useful version and learn whether people use it._

## Acceptance criteria

**Search box**

1. When signed in, the app header shows a labelled search input ("Search quacks") on every page. Signed-out visitors don't see it.
2. On phone-width screens, the input sits in a full-width second row under the header bar.
3. A clear button (aria-label "Clear search") appears inside the input only while it has text. Clicking it empties the search and shows the full feed.

**When it runs**

4. The search runs as you type, about 300 ms after the last keystroke. There is no submit button.
5. A search needs at least 2 characters after trimming. With 1 character, the feed shows all posts and a hint, "Type at least 2 characters", appears. No request is sent.
6. A search can be at most 100 characters.
7. Typing a valid query on any other page takes you to `/quacks?q=…`. On the feed, the query is kept in the URL, and a reload or shared link shows the same search.
8. Typing replaces the current history entry, so Back leaves the search instead of stepping through partial queries.

**What matches**

9. The search looks at the post text, the author's name, and the author's username.
10. Matching ignores case and accents: "cafe" finds "café", and "duck" finds "@CaffeinatedDuck".
11. Partial words match: "crumb" finds "crumbs".
12. With several words, every word must match somewhere in the post text, author name or username, in any order.
13. Results stay newest first, as in the current feed.

**Results**

14. The new-post form stays visible while a search is active. A new post shows in the list only if it matches.
15. While a search is active, the page shows a count line such as `3 quacks match "pond"`. Screen readers announce changes to it.
16. Matched words are highlighted in the post text, author name and username. The highlighting is case- and accent-insensitive and uses semantic design tokens, with no hardcoded colour.
17. Previous results stay on screen while new ones load. The list does not blank out or flash a spinner on each search.
18. When nothing matches, the list shows `No quacks match "pond".` with a "Clear search" button.
19. The existing loading, empty and error states still work. Error still offers a retry.

**Measuring use**

20. For every search, the backend writes one log line with the query length, the number of words, and the result count. The search words themselves are never logged.

## Technical decisions

- **API:** `GET /api/quacks?q=…`, with `q` optional and documented in Swagger. A missing or blank `q` returns the full feed. A trimmed `q` shorter than 2 or longer than 100 characters is rejected with 400. The frontend never sends a query shorter than 2.
- **Accents:** a migration enables the Postgres `unaccent` extension. Queries are case- and accent-insensitive. `%`, `_` and `\` in the query are escaped so they match literally.
- **Layer:** the filter belongs in the repository, per the existing pattern. The service passes `q` through and logs.
- **Frontend:** the `q` search param is validated with zod on the `/quacks` route. The query key includes `q`, and the previous data is kept while the next loads. The header search is a feature component in `features/quack/`, passed to `Header` as a slot like `userMenu`.
- **UI kit:** controls come from the shadcn kit (`pnpm dlx shadcn@latest add input`), and shadows are stripped. Nothing is hand-rolled.

## Out of scope

Filtering by mood or date, saved searches, search suggestions, pagination, ranking by relevance, searching other users or other pages, and logging the search words.

## Tests

- Backend: service tests for passing `q` through and for logging. A repository or controller test covers matching on text, name and username, ignoring case and accents, and requiring all words. Another covers the 400 on a too-short or too-long query.
- Frontend: component tests for the hint, the clear button, the no-results state with its clear button, and the highlighting. A test covers a valid query navigating to `/quacks?q=…`.

## Delivery

Create the branch `quack-search` from `main`. Make one commit containing `story.md` and the implementation.

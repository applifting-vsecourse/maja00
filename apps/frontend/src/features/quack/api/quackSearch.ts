import { z } from "zod"

// Mirrors the server-side limits on GET /api/quacks?q= — the server still
// validates independently.
export const SEARCH_MIN_LENGTH = 2
export const SEARCH_MAX_LENGTH = 100

// Search params of the /quacks route. An invalid `q` (too short, too long)
// is dropped rather than failing the route: the feed just shows everything.
// `coerce` because the router JSON-parses params, so `?q=2024` arrives as a number.
export const quacksSearchSchema = z.object({
  q: z.coerce
    .string()
    .trim()
    .min(SEARCH_MIN_LENGTH)
    .max(SEARCH_MAX_LENGTH)
    .optional()
    .catch(undefined),
})

/** What the user typed, as a query to run — or undefined while it is too short. */
export function toSearchQuery(text: string): string | undefined {
  const trimmed = text.trim()
  return trimmed.length >= SEARCH_MIN_LENGTH ? trimmed : undefined
}

/** The words of a query. A quack has to match every one of them. */
export function toSearchWords(query: string | undefined): string[] {
  return query ? query.trim().split(/\s+/).filter(Boolean) : []
}

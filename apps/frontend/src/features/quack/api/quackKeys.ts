export const quackKeys = {
  all: () => ["quacks"] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
  // One cache entry per search, so going back to an earlier search is instant.
  list: (q: string | undefined) => [...quackKeys.lists(), { q: q ?? "" }] as const,
}

export const quackKeys = {
  all: () => ["quacks"] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
  // One cache entry per search and per All/Mine view, so going back is instant.
  list: (q: string | undefined, isMine = false) =>
    [...quackKeys.lists(), { q: q ?? "", mine: isMine }] as const,
}

import type { Quack, QuackParent } from "@/features/quack/api/quackSchemas"

// Replies indent for this many levels; deeper ones stay at this level and
// say whom they answer instead, so a long thread doesn't shrink to a sliver.
export const MAX_INDENT_DEPTH = 4

/** The replies of each quack by its id, in the order given (oldest first). */
export function buildReplyTree(quacks: Quack[]): Map<string, Quack[]> {
  const childrenOf = new Map<string, Quack[]>()
  for (const quack of quacks) {
    if (quack.parentId === null) continue
    const siblings = childrenOf.get(quack.parentId) ?? []
    siblings.push(quack)
    childrenOf.set(quack.parentId, siblings)
  }
  return childrenOf
}

/** What a reply shows about the quack it answers. */
export function toParent(quack: Quack): QuackParent {
  return quack.deleted
    ? { id: quack.id, deleted: true, username: null }
    : { id: quack.id, deleted: false, username: quack.user.username }
}

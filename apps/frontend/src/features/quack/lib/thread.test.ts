import { describe, expect, it } from "vitest"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { buildReplyTree, toParent } from "@/features/quack/lib/thread"

const at = new Date("2026-11-10T12:00:00Z")

const live = (id: string, parentId: string | null): Quack => ({
  id,
  deleted: false,
  parentId,
  parent: null,
  replyCount: 0,
  createdAt: at,
  text: id,
  mood: null,
  userId: "u1",
  user: { id: "u1", name: "Duck", username: "Duck" },
  poll: null,
})

const deleted = (id: string, parentId: string | null): Quack => ({
  id,
  deleted: true,
  parentId,
  parent: null,
  replyCount: 1,
  createdAt: at,
})

describe("buildReplyTree", () => {
  it("groups replies under the quack they answer, keeping their order", () => {
    const tree = buildReplyTree([live("a", "root"), live("b", "a"), live("c", "root")])

    expect(tree.get("root")?.map((quack) => quack.id)).toEqual(["a", "c"])
    expect(tree.get("a")?.map((quack) => quack.id)).toEqual(["b"])
    expect(tree.has("b")).toBe(false)
  })

  it("keeps a deleted quack in the tree, so its replies stay attached", () => {
    const tree = buildReplyTree([deleted("a", "root"), live("b", "a")])

    expect(tree.get("root")?.[0]?.deleted).toBe(true)
    expect(tree.get("a")?.map((quack) => quack.id)).toEqual(["b"])
  })
})

describe("toParent", () => {
  it("names the author of a live quack", () => {
    expect(toParent(live("a", null))).toEqual({ id: "a", deleted: false, username: "Duck" })
  })

  it("has no author for a deleted quack", () => {
    expect(toParent(deleted("a", null))).toEqual({ id: "a", deleted: true, username: null })
  })
})

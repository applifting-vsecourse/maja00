import { describe, expect, it } from "vitest"

import type { Poll } from "@/features/quack/api/quackSchemas"
import { applyVote, percentOf, timeLeft } from "@/features/quack/lib/poll"

const poll = (overrides: Partial<Poll> = {}): Poll => ({
  id: "p1",
  closesAt: new Date("2026-10-20T12:00:00Z"),
  closed: false,
  options: [
    { id: "a", text: "Pizza", votes: 2 },
    { id: "b", text: "Ramen", votes: 1 },
    { id: "c", text: "Salad", votes: 0 },
  ],
  totalVotes: 3,
  myVoteOptionId: "a",
  canVote: true,
  ...overrides,
})

describe("applyVote", () => {
  it("moves a vote between options without changing the total", () => {
    const result = applyVote(poll(), "b")

    expect(result.myVoteOptionId).toBe("b")
    expect(result.options.map((o) => o.votes)).toEqual([1, 2, 0])
    expect(result.totalVotes).toBe(3)
  })

  it("does nothing when voting for the option you already picked", () => {
    const before = poll()
    expect(applyVote(before, "a")).toBe(before)
  })

  it("marks the pick but invents no counts while they are hidden", () => {
    const hidden = poll({
      myVoteOptionId: null,
      totalVotes: null,
      options: poll().options.map((o) => ({ ...o, votes: null })),
    })

    const result = applyVote(hidden, "c")

    expect(result.myVoteOptionId).toBe("c")
    expect(result.totalVotes).toBeNull()
    expect(result.options.every((o) => o.votes === null)).toBe(true)
  })

  it("leaves a poll you cannot vote in untouched", () => {
    const closed = poll({ closed: true, canVote: false })
    expect(applyVote(closed, "b")).toBe(closed)
  })
})

describe("percentOf", () => {
  it("rounds to whole percent and survives an empty poll", () => {
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(0, 0)).toBe(0)
  })
})

describe("timeLeft", () => {
  const now = new Date("2026-10-19T12:00:00Z")

  it("says how long is left, down to the minute", () => {
    const left = (iso: string) => timeLeft(new Date(iso), now)

    expect(left("2026-10-19T12:45:00Z")).toBe("45 min left")
    expect(left("2026-10-19T15:00:00Z")).toBe("3 h left")
    expect(left("2026-10-19T13:30:00Z")).toBe("1 h 30 min left")
    expect(left("2026-10-26T12:00:00Z")).toBe("7 d left")
    expect(left("2026-10-21T15:00:00Z")).toBe("2 d 3 h left")
  })

  it("counts a part-minute as a minute", () => {
    expect(timeLeft(new Date("2026-10-19T12:00:20Z"), now)).toBe("1 min left")
  })

  it("does not claim a negative time", () => {
    expect(timeLeft(now, now)).toBe("Closing...")
  })
})

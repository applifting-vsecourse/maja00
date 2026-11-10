// Example component test — the pattern to copy for your own components.
import type * as Router from "@tanstack/react-router"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { LiveQuack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

// The list links to threads. Outside a router a plain anchor is enough.
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof Router>()),
  Link: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <a
      href="#thread"
      className={className}
    >
      {children}
    </a>
  ),
}))

const quack = (overrides: Partial<LiveQuack> = {}): LiveQuack => ({
  id: "q1",
  deleted: false,
  parentId: null,
  parent: null,
  replyCount: 0,
  text: "quack quack",
  mood: null,
  userId: "u1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  poll: null,
  ...overrides,
})

describe("QuackList", () => {
  it("renders quacks with author info", () => {
    render(<QuackList quacks={[quack()]} />)

    expect(screen.getByText("quack quack")).toBeInTheDocument()
    expect(screen.getByText("Caffeinated Duck")).toBeInTheDocument()
    expect(screen.getByText("@CaffeinatedDuck")).toBeInTheDocument()
  })

  it("shows the mood of a quack that has one", () => {
    render(<QuackList quacks={[quack({ mood: "silly" })]} />)

    expect(screen.getByText("Silly")).toBeInTheDocument()
  })

  it("shows no mood for a quack without one", () => {
    render(<QuackList quacks={[quack()]} />)

    for (const label of ["Happy", "Sad", "Angry", "Silly"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
  })

  it("shows an error with a working reload button", async () => {
    const onReload = vi.fn()
    render(
      <QuackList
        quacks={[]}
        error={new Error("Server unreachable")}
        onReload={onReload}
      />,
    )

    expect(screen.getByText("Couldn't load quacks")).toBeInTheDocument()
    expect(screen.getByText("Server unreachable")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /reload/i }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})

describe("QuackList while searching", () => {
  it("shows no search UI without a search", () => {
    const { container } = render(<QuackList quacks={[quack()]} />)

    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(container.querySelector("mark")).toBeNull()
  })

  it("counts the matches", () => {
    const { rerender } = render(
      <QuackList
        quacks={[quack(), quack({ id: "q2" })]}
        search="duck"
      />,
    )
    expect(screen.getByRole("status")).toHaveTextContent('2 quacks match "duck"')

    rerender(
      <QuackList
        quacks={[quack()]}
        search="duck"
      />,
    )
    expect(screen.getByRole("status")).toHaveTextContent('1 quack matches "duck"')
  })

  it("highlights matches in the text, the name and the username, ignoring case and accents", () => {
    const { container } = render(
      <QuackList
        quacks={[quack({ text: "Crème brûlée at the pond" })]}
        search="creme CAFFEINATED duckx"
      />,
    )

    const marked = Array.from(container.querySelectorAll("mark"), (mark) => mark.textContent)
    // name, username, then the text — "duckx" matches nothing
    expect(marked).toEqual(["Caffeinated", "Caffeinated", "Crème"])
  })

  it("highlights inside the username", () => {
    const { container } = render(
      <QuackList
        quacks={[quack()]}
        search="duck"
      />,
    )

    const marked = Array.from(container.querySelectorAll("mark"), (mark) => mark.textContent)
    // "Caffeinated Duck" and "@CaffeinatedDuck"
    expect(marked).toEqual(["Duck", "Duck"])
  })

  it("says nothing matches and offers to clear the search", async () => {
    const onClearSearch = vi.fn()
    render(
      <QuackList
        quacks={[]}
        search="pond"
        onClearSearch={onClearSearch}
      />,
    )

    expect(screen.getByText('No quacks match "pond".')).toBeInTheDocument()
    expect(screen.queryByText(/no quacks yet/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }))
    expect(onClearSearch).toHaveBeenCalledOnce()
  })

  it("keeps the previous results and says nothing new while the next search loads", () => {
    render(
      <QuackList
        quacks={[quack()]}
        search="pond"
        isStale
      />,
    )

    expect(screen.getByText("quack quack")).toBeInTheDocument()
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })

  it("does not claim 'no match' for stale empty results", () => {
    render(
      <QuackList
        quacks={[]}
        search="pond"
        isStale
      />,
    )

    expect(screen.queryByText(/no quacks match/i)).not.toBeInTheDocument()
  })

  describe("replies", () => {
    it("leads to the replies of a quack", () => {
      render(<QuackList quacks={[quack({ replyCount: 3 }), quack({ id: "q2" })]} />)

      expect(screen.getByRole("link", { name: "3 replies" })).toBeInTheDocument()
      // no replies yet: the same link invites the first one
      expect(screen.getByRole("link", { name: "Reply" })).toBeInTheDocument()
    })

    it("shows a deleted quack only as a placeholder in front of its replies", () => {
      const tombstone = {
        id: "q9",
        deleted: true as const,
        parentId: null,
        parent: null,
        replyCount: 2,
        createdAt: new Date("2026-01-01T12:00:00Z"),
      }
      render(<QuackList quacks={[tombstone]} />)

      const item = screen.getByRole("article")
      expect(item).toHaveTextContent("This quack was deleted")
      expect(screen.getByRole("link", { name: "2 replies" })).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Delete quack" })).not.toBeInTheDocument()
    })

    it("says what a reply answers", () => {
      render(
        <QuackList
          quacks={[
            quack({
              parentId: "p1",
              parent: { id: "p1", deleted: false, username: "BreadCritic" },
            }),
            quack({
              id: "q2",
              parentId: "p2",
              parent: { id: "p2", deleted: true, username: null },
            }),
          ]}
        />,
      )

      expect(screen.getByRole("link", { name: "Replying to @BreadCritic" })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "Replying to a deleted quack" })).toBeInTheDocument()
    })
  })
})

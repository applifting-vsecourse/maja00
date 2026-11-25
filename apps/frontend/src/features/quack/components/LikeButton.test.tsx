// Likes: "Rules (unit)", frontend, in cases.md. Each `it` names its case.
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import type * as Router from "@tanstack/react-router"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Toaster } from "@/components/ui/sonner"

import { likeQuack, unlikeQuack } from "@/features/quack/api/likeQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { DeletedQuack, LikeState, LiveQuack, Quack } from "@/features/quack/api/quackSchemas"
import { LikeButton } from "@/features/quack/components/LikeButton"
import { QuackList } from "@/features/quack/components/QuackList"

vi.mock("@/features/quack/api/likeQuack", () => ({
  likeQuack: vi.fn(),
  unlikeQuack: vi.fn(),
}))

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

const liveQuack = (likeCount: number, isLiked: boolean): LiveQuack => ({
  id: "q1",
  deleted: false,
  parentId: null,
  parent: null,
  replyCount: 0,
  likeCount,
  likedByMe: isLiked,
  text: "Bread at noon",
  mood: null,
  userId: "author",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "author", name: "Pond Admin", username: "PondAdmin" },
  poll: null,
})

const tombstone: DeletedQuack = {
  id: "q2",
  deleted: true,
  parentId: null,
  parent: null,
  replyCount: 1,
  likeCount: 0,
  likedByMe: false,
  createdAt: new Date("2026-01-01T12:00:00Z"),
}

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

// Renders the button from a cached feed list, the way the app does, so the
// optimistic update and the rollback are visible on screen.
function renderFromFeed(likeCount: number, isLiked: boolean) {
  const server = { quack: liveQuack(likeCount, isLiked) }

  function Feed() {
    // eslint-disable-next-line @tanstack/query/exhaustive-deps -- the key must match the app's so the hook updates this list
    const { data } = useQuery({
      queryKey: quackKeys.list(undefined),
      queryFn: () => Promise.resolve<Quack[]>([server.quack]),
    })
    const quack = data?.[0]
    return quack && !quack.deleted ? (
      <LikeButton
        quackId={quack.id}
        likeCount={quack.likeCount ?? 0}
        likedByMe={quack.likedByMe ?? false}
      />
    ) : null
  }

  render(
    <QueryClientProvider client={newClient()}>
      <Feed />
      <Toaster />
    </QueryClientProvider>,
  )
  return { server }
}

const likeButton = () => screen.findByRole("button", { name: /^(Like|Unlike),/ })

describe("LikeButton", () => {
  beforeEach(() => {
    vi.mocked(likeQuack).mockReset()
    vi.mocked(unlikeQuack).mockReset()
  })

  // Case: Count hidden at 0.
  it("shows only the duck, no number, at 0 likes", async () => {
    renderFromFeed(0, false)

    const button = await likeButton()
    expect(button).toHaveTextContent(/^$/)
    expect(screen.queryByText("0")).not.toBeInTheDocument()
  })

  it("shows the number next to the duck from 1 like on", async () => {
    renderFromFeed(3, false)

    expect(await likeButton()).toHaveTextContent("3")
  })

  // Case: Liked state.
  it("is pressed and red when I have liked the quack", async () => {
    renderFromFeed(3, true)

    const button = await likeButton()
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(button).toHaveClass("text-like")
  })

  it("is not pressed and neutral when I have not liked it", async () => {
    renderFromFeed(3, false)

    const button = await likeButton()
    expect(button).toHaveAttribute("aria-pressed", "false")
    expect(button).not.toHaveClass("text-like")
  })

  // Case: Accessible name.
  it("says the action and the count", async () => {
    renderFromFeed(0, false)
    expect(await screen.findByRole("button", { name: "Like, 0 likes" })).toBeInTheDocument()
  })

  it("says Unlike when I have liked it, with the count", async () => {
    renderFromFeed(3, true)
    expect(await screen.findByRole("button", { name: "Unlike, 3 likes" })).toBeInTheDocument()
  })

  it("uses the singular for one like", async () => {
    renderFromFeed(1, true)
    expect(await screen.findByRole("button", { name: "Unlike, 1 like" })).toBeInTheDocument()
  })

  // Case: Optimistic toggle.
  it("shows the like at once, before the server answers", async () => {
    vi.mocked(likeQuack).mockReturnValue(new Promise<LikeState>(() => undefined))
    renderFromFeed(2, false)

    await userEvent.click(await likeButton())

    const button = await screen.findByRole("button", { name: "Unlike, 3 likes" })
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(button).toHaveTextContent("3")
    expect(likeQuack).toHaveBeenCalledWith("q1")
  })

  it("takes the like back at once when unliking", async () => {
    vi.mocked(unlikeQuack).mockReturnValue(new Promise<LikeState>(() => undefined))
    renderFromFeed(3, true)

    await userEvent.click(await likeButton())

    const button = await screen.findByRole("button", { name: "Like, 2 likes" })
    expect(button).toHaveAttribute("aria-pressed", "false")
    expect(unlikeQuack).toHaveBeenCalledWith("q1")
    expect(likeQuack).not.toHaveBeenCalled()
  })

  // Case: Rollback.
  it("goes back and says so when the like fails", async () => {
    vi.mocked(likeQuack).mockRejectedValue(new Error("network"))
    renderFromFeed(2, false)

    await userEvent.click(await likeButton())

    expect(await screen.findByText(/like didn't go through/i)).toBeInTheDocument()
    await waitFor(async () => expect(await likeButton()).toHaveAttribute("aria-pressed", "false"))
    expect(await likeButton()).toHaveAccessibleName("Like, 2 likes")
  })
})

describe("Likes in the quack list", () => {
  const renderList = (quacks: Quack[]) =>
    render(
      <QueryClientProvider client={newClient()}>
        <QuackList quacks={quacks} />
      </QueryClientProvider>,
    )

  it("gives every live quack a like button", () => {
    renderList([liveQuack(2, false)])

    expect(screen.getByRole("button", { name: "Like, 2 likes" })).toBeInTheDocument()
  })

  // Case: No button on a tombstone.
  it("gives a deleted quack no like button", () => {
    renderList([tombstone])

    expect(screen.getByText(/This quack was deleted/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /like/i })).not.toBeInTheDocument()
  })
})

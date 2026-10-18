import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { HTTPError } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll, Quack } from "@/features/quack/api/quackSchemas"
import { voteOnPoll } from "@/features/quack/api/voteOnPoll"
import { QuackPoll } from "@/features/quack/components/QuackPoll"

vi.mock("@/features/quack/api/voteOnPoll", () => ({
  voteOnPoll: vi.fn(),
}))

const hidden: Poll = {
  id: "p1",
  closesAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
  closed: false,
  options: [
    { id: "a", text: "Pizza", votes: null },
    { id: "b", text: "Ramen", votes: null },
  ],
  totalVotes: null,
  myVoteOptionId: null,
  canVote: true,
}

const voted: Poll = {
  ...hidden,
  options: [
    { id: "a", text: "Pizza", votes: 3 },
    { id: "b", text: "Ramen", votes: 1 },
  ],
  totalVotes: 4,
  myVoteOptionId: "a",
}

const quackWith = (poll: Poll): Quack => ({
  id: "q1",
  text: "Where do we go for lunch?",
  mood: null,
  userId: "author",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "author", name: "Pond Admin", username: "PondAdmin" },
  poll,
})

// Renders the poll from a cached feed list, the way the app does, so the
// optimistic update and the rollback are visible on screen.
function renderPoll(poll: Poll) {
  const server = { quack: quackWith(poll) }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  function Feed() {
    // eslint-disable-next-line @tanstack/query/exhaustive-deps -- the key must match the app's so the hook updates this list
    const { data } = useQuery({
      queryKey: quackKeys.list(undefined),
      queryFn: () => Promise.resolve([server.quack]),
    })
    const quack = data?.[0]
    return quack?.poll ? (
      <QuackPoll
        quackId={quack.id}
        poll={quack.poll}
      />
    ) : null
  }

  render(
    <QueryClientProvider client={client}>
      <Feed />
    </QueryClientProvider>,
  )
  return { server }
}

const option = (name: string) => screen.getByRole("button", { name: new RegExp(name) })

describe("QuackPoll", () => {
  beforeEach(() => {
    vi.mocked(voteOnPoll).mockReset()
  })

  it("shows the options but no counts to someone who has not voted", async () => {
    renderPoll(hidden)

    expect(await screen.findByRole("button", { name: /Pizza/ })).toBeInTheDocument()
    expect(screen.getByText(/Vote to see the results/)).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it("shows counts, percentages and your pick after voting", async () => {
    renderPoll(voted)

    const pizza = await screen.findByRole("button", { name: /Pizza/ })
    expect(pizza).toHaveAttribute("aria-pressed", "true")
    expect(within(pizza).getByText("3 · 75%")).toBeInTheDocument()
    expect(within(option("Ramen")).getByText("1 · 25%")).toBeInTheDocument()
    expect(screen.getByText(/4 votes/)).toBeInTheDocument()
  })

  it("shows the author the counts without vote buttons", async () => {
    renderPoll({ ...voted, myVoteOptionId: null, canVote: false })

    expect(await screen.findByText("3 · 75%")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("shows a closed poll to everyone, without vote buttons", async () => {
    renderPoll({ ...voted, myVoteOptionId: null, canVote: false, closed: true })

    expect(await screen.findByText("3 · 75%")).toBeInTheDocument()
    expect(screen.getByText(/Closed/)).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("marks a first vote at once and shows counts when the server answers", async () => {
    let answer: (poll: Poll) => void = () => undefined
    vi.mocked(voteOnPoll).mockReturnValue(new Promise<Poll>((resolve) => (answer = resolve)))
    const { server } = renderPoll(hidden)

    await userEvent.click(await screen.findByRole("button", { name: /Ramen/ }))

    // Instant: the pick is marked, and no number is made up.
    expect(option("Ramen")).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    expect(vi.mocked(voteOnPoll).mock.calls[0]?.[0]).toEqual({ quackId: "q1", optionId: "b" })

    const serverPoll = { ...voted, myVoteOptionId: "b" }
    // the server now has the vote, so the refetch after it agrees
    server.quack = quackWith(serverPoll)
    answer(serverPoll)
    expect(await screen.findByText("3 · 75%")).toBeInTheDocument()
  })

  it("moves the counts at once when you switch your vote", async () => {
    vi.mocked(voteOnPoll).mockReturnValue(new Promise<Poll>(() => undefined))
    renderPoll(voted)

    await userEvent.click(await screen.findByRole("button", { name: /Ramen/ }))

    expect(option("Ramen")).toHaveAttribute("aria-pressed", "true")
    expect(within(option("Ramen")).getByText("2 · 50%")).toBeInTheDocument()
    expect(within(option("Pizza")).getByText("2 · 50%")).toBeInTheDocument()
    expect(screen.getByText(/4 votes/)).toBeInTheDocument()
  })

  it("puts everything back and says so when a vote fails", async () => {
    vi.mocked(voteOnPoll).mockRejectedValue(new Error("network"))
    renderPoll(voted)

    await userEvent.click(await screen.findByRole("button", { name: /Ramen/ }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Your vote didn't go through")
    await waitFor(() => expect(option("Pizza")).toHaveAttribute("aria-pressed", "true"))
    expect(within(option("Pizza")).getByText("3 · 75%")).toBeInTheDocument()
    expect(option("Ramen")).toHaveAttribute("aria-pressed", "false")
  })

  it("tells you the poll closed when the vote is refused for that", async () => {
    const closed = Object.assign(Object.create(HTTPError.prototype), {
      response: { status: 409 },
    }) as Error
    vi.mocked(voteOnPoll).mockRejectedValue(closed)
    const { server } = renderPoll(voted)
    // by the time the app refetches, the server has closed the poll
    server.quack = quackWith({ ...voted, closed: true, canVote: false })

    await userEvent.click(await screen.findByRole("button", { name: /Ramen/ }))

    expect(await screen.findByRole("alert")).toHaveTextContent("This poll has closed")
    await waitFor(() => expect(screen.queryByRole("button")).not.toBeInTheDocument())
    expect(screen.getByText(/Closed/)).toBeInTheDocument()
  })
})

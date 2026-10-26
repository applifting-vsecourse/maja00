import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

const deleteQuack = vi.fn()
vi.mock("@/features/quack/api/deleteQuack", () => ({
  deleteQuack: (quackId: string) => deleteQuack(quackId) as Promise<void>,
}))

const quack = (overrides: Partial<Quack> = {}): Quack => ({
  id: "q1",
  text: "quack quack",
  mood: null,
  userId: "me",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "me", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  poll: null,
  ...overrides,
})

const renderList = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

describe("Deleting a quack", () => {
  it("offers Delete on my quacks only", () => {
    renderList(
      <QuackList
        currentUserId="me"
        quacks={[
          quack(),
          quack({
            id: "q2",
            text: "not mine",
            userId: "other",
            user: { id: "other", name: "Deep Duck", username: "DeepDuck" },
          }),
        ]}
      />,
    )

    expect(screen.getAllByRole("button", { name: "Delete quack" })).toHaveLength(1)
  })

  it("offers a moderator Delete on every quack", () => {
    renderList(
      <QuackList
        currentUserId="admin"
        canModerate
        quacks={[quack(), quack({ id: "q2", text: "other", userId: "other" })]}
      />,
    )

    expect(screen.getAllByRole("button", { name: "Delete quack" })).toHaveLength(2)
  })

  it("tells a moderator they are deleting someone else's quack", async () => {
    renderList(
      <QuackList
        currentUserId="admin"
        canModerate
        quacks={[quack({ userId: "other" })]}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "Delete quack" }))

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "You are deleting a quack written by someone else as a moderator.",
    )
  })

  it("uses the normal dialog when a moderator deletes their own quack", async () => {
    renderList(
      <QuackList
        currentUserId="me"
        canModerate
        quacks={[quack()]}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "Delete quack" }))

    expect(screen.getByRole("dialog")).not.toHaveTextContent(/as a moderator/)
  })

  it("offers no Delete while the signed-in user is unknown", () => {
    renderList(<QuackList quacks={[quack()]} />)

    expect(screen.queryByRole("button", { name: "Delete quack" })).not.toBeInTheDocument()
  })

  it("asks first, and does nothing when I cancel", async () => {
    deleteQuack.mockReset()
    renderList(
      <QuackList
        currentUserId="me"
        quacks={[quack()]}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "Delete quack" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(deleteQuack).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(deleteQuack).not.toHaveBeenCalled()
  })

  it("deletes the quack once I confirm", async () => {
    deleteQuack.mockReset()
    deleteQuack.mockResolvedValue(undefined)
    renderList(
      <QuackList
        currentUserId="me"
        quacks={[quack()]}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "Delete quack" }))
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))

    expect(deleteQuack).toHaveBeenCalledWith("q1")
  })

  it("shows the server's message when deleting fails", async () => {
    deleteQuack.mockReset()
    deleteQuack.mockRejectedValue(new Error("You can only delete your own quacks"))
    renderList(
      <QuackList
        currentUserId="me"
        quacks={[quack()]}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "Delete quack" }))
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))

    expect(await screen.findByText("You can only delete your own quacks")).toBeInTheDocument()
  })
})

describe("The Mine tab with no quacks", () => {
  it("says so and offers to write the first one", async () => {
    const onWriteFirst = vi.fn()
    renderList(
      <QuackList
        quacks={[]}
        isMine
        onWriteFirst={onWriteFirst}
      />,
    )

    expect(screen.getByText("You haven't posted any quacks yet.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Write your first quack" }))
    expect(onWriteFirst).toHaveBeenCalledOnce()
  })
})

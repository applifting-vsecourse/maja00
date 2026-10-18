import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { QuackMood } from "@/lib/quack-moods"

import { addQuack } from "@/features/quack/api/addQuack"
import { QuackForm } from "@/features/quack/components/QuackForm"

vi.mock("@/features/quack/api/addQuack", () => ({
  addQuack: vi.fn().mockResolvedValue({}),
}))

function renderForm(defaultMood?: QuackMood | null) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QuackForm defaultMood={defaultMood} />
    </QueryClientProvider>,
  )
  return {
    text: screen.getByLabelText("New quack"),
    mood: screen.getByRole("combobox", { name: "Mood" }),
    post: screen.getByRole("button", { name: "Quack" }),
  }
}

describe("QuackForm mood", () => {
  beforeEach(() => {
    vi.mocked(addQuack).mockClear()
  })

  it("starts without a mood by default", () => {
    const { mood } = renderForm()

    expect(mood).toHaveTextContent("No mood")
  })

  it("starts with the user's default mood", () => {
    const { mood } = renderForm("silly")

    expect(mood).toHaveTextContent("Silly")
  })

  it("posts with the default mood", async () => {
    const { text, post } = renderForm("silly")

    await userEvent.type(text, "lol")
    await userEvent.click(post)

    await waitFor(() => expect(addQuack).toHaveBeenCalled())
    expect(vi.mocked(addQuack).mock.calls[0]?.[0]).toEqual({ text: "lol", mood: "silly" })
  })

  it("lets you change the mood for one post, then goes back to the default", async () => {
    const { text, mood, post } = renderForm("silly")

    await userEvent.type(text, "grr")
    await userEvent.click(mood)
    await userEvent.click(await screen.findByRole("option", { name: /angry/i }))
    await userEvent.click(post)

    await waitFor(() => expect(addQuack).toHaveBeenCalled())
    expect(vi.mocked(addQuack).mock.calls[0]?.[0]).toEqual({ text: "grr", mood: "angry" })
    await waitFor(() => expect(text).toHaveValue(""))
    expect(mood).toHaveTextContent("Silly")
  })

  it("posts without a mood when the default is none", async () => {
    const { text, post } = renderForm(null)

    await userEvent.type(text, "plain")
    await userEvent.click(post)

    await waitFor(() => expect(addQuack).toHaveBeenCalled())
    expect(vi.mocked(addQuack).mock.calls[0]?.[0]).toEqual({ text: "plain", mood: undefined })
  })
})

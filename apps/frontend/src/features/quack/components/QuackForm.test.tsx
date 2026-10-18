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

describe("QuackForm poll", () => {
  beforeEach(() => {
    vi.mocked(addQuack).mockClear()
  })

  const answer = (n: number) => screen.getByLabelText(`Answer ${n}`)
  const setDuration = async (days: string, hours: string, minutes: string) => {
    for (const [label, value] of [
      ["Days", days],
      ["Hours", hours],
      ["Minutes", minutes],
    ] as const) {
      await userEvent.clear(screen.getByLabelText(label))
      await userEvent.type(screen.getByLabelText(label), value)
    }
  }

  it("posts a plain quack when no poll is added", async () => {
    const { text, post } = renderForm()

    await userEvent.type(text, "no poll")
    await userEvent.click(post)

    await waitFor(() => expect(addQuack).toHaveBeenCalled())
    expect(vi.mocked(addQuack).mock.calls[0]?.[0].poll).toBeUndefined()
  })

  it("posts the question with its answers and duration", async () => {
    const { text, post } = renderForm()

    await userEvent.type(text, "Lunch?")
    await userEvent.click(screen.getByRole("button", { name: "Add poll" }))
    await userEvent.type(answer(1), "  Pizza ")
    await userEvent.type(answer(2), "Ramen")
    await setDuration("0", "1", "30")
    await userEvent.click(post)

    await waitFor(() => expect(addQuack).toHaveBeenCalled())
    expect(vi.mocked(addQuack).mock.calls[0]?.[0].poll).toEqual({
      options: ["Pizza", "Ramen"],
      durationMinutes: 90,
    })
  })

  it("tells you what is wrong instead of posting", async () => {
    const { text, post } = renderForm()

    await userEvent.type(text, "Lunch?")
    await userEvent.click(screen.getByRole("button", { name: "Add poll" }))
    await userEvent.type(answer(1), "Pizza")
    await setDuration("8", "0", "0")
    await userEvent.click(post)

    expect(await screen.findByText("Write an answer")).toBeInTheDocument()
    expect(screen.getByText("Days go from 0 to 7")).toBeInTheDocument()
    expect(addQuack).not.toHaveBeenCalled()
  })

  it("allows exactly seven days and nothing longer or shorter", async () => {
    const { text, post } = renderForm()
    await userEvent.type(text, "Lunch?")
    await userEvent.click(screen.getByRole("button", { name: "Add poll" }))
    await userEvent.type(answer(1), "Pizza")
    await userEvent.type(answer(2), "Ramen")

    const tooLongOrShort: [string, string, string][] = [
      ["7", "0", "1"],
      ["0", "0", "0"],
    ]
    for (const [days, hours, minutes] of tooLongOrShort) {
      await setDuration(days, hours, minutes)
      await userEvent.click(post)
      expect(await screen.findByText("Choose between 1 minute and 7 days")).toBeInTheDocument()
    }
    expect(addQuack).not.toHaveBeenCalled()

    await setDuration("7", "0", "0")
    await userEvent.click(post)
    await waitFor(() => expect(addQuack).toHaveBeenCalled())
    expect(vi.mocked(addQuack).mock.calls[0]?.[0].poll?.durationMinutes).toBe(10080)
  })

  it("takes days, hours and minutes together", async () => {
    const { text, post } = renderForm()
    await userEvent.type(text, "Lunch?")
    await userEvent.click(screen.getByRole("button", { name: "Add poll" }))
    await userEvent.type(answer(1), "Pizza")
    await userEvent.type(answer(2), "Ramen")
    await setDuration("2", "3", "15")
    await userEvent.click(post)

    await waitFor(() => expect(addQuack).toHaveBeenCalled())
    expect(vi.mocked(addQuack).mock.calls[0]?.[0].poll?.durationMinutes).toBe(
      (2 * 24 + 3) * 60 + 15,
    )
  })

  it("starts at one day", async () => {
    renderForm()
    await userEvent.click(screen.getByRole("button", { name: "Add poll" }))

    expect(screen.getByLabelText("Days")).toHaveValue(1)
    expect(screen.getByLabelText("Hours")).toHaveValue(0)
    expect(screen.getByLabelText("Minutes")).toHaveValue(0)
  })

  it("rejects hours above 23", async () => {
    const { text, post } = renderForm()
    await userEvent.type(text, "Lunch?")
    await userEvent.click(screen.getByRole("button", { name: "Add poll" }))
    await userEvent.type(answer(1), "Pizza")
    await userEvent.type(answer(2), "Ramen")
    await setDuration("0", "24", "0")
    await userEvent.click(post)

    expect(await screen.findByText("Hours go from 0 to 23")).toBeInTheDocument()
    expect(addQuack).not.toHaveBeenCalled()
  })

  it("rejects minutes above 59", async () => {
    const { text, post } = renderForm()
    await userEvent.type(text, "Lunch?")
    await userEvent.click(screen.getByRole("button", { name: "Add poll" }))
    await userEvent.type(answer(1), "Pizza")
    await userEvent.type(answer(2), "Ramen")
    await setDuration("0", "1", "75")
    await userEvent.click(post)

    expect(await screen.findByText("Minutes go from 0 to 59")).toBeInTheDocument()
    expect(addQuack).not.toHaveBeenCalled()
  })

  it("keeps between two and four answers", async () => {
    renderForm()
    await userEvent.click(screen.getByRole("button", { name: "Add poll" }))

    expect(screen.queryByRole("button", { name: /Remove answer/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Add answer" }))
    await userEvent.click(screen.getByRole("button", { name: "Add answer" }))
    expect(answer(4)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add answer" })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Remove answer 4" }))
    expect(screen.queryByLabelText("Answer 4")).not.toBeInTheDocument()
  })

  it("drops the poll again", async () => {
    renderForm()
    await userEvent.click(screen.getByRole("button", { name: "Add poll" }))
    await userEvent.click(screen.getByRole("button", { name: "Remove poll" }))

    expect(screen.queryByLabelText("Answer 1")).not.toBeInTheDocument()
  })
})

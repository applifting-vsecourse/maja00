import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { ProfileValues } from "@/features/auth/api/profileSchema"
import { ProfileForm } from "@/features/auth/components/ProfileForm"
import { ProfileUpdateError } from "@/features/auth/hooks/useUpdateProfile"

const saved: ProfileValues = {
  username: "CaffeinatedDuck",
  name: "Caffeinated Duck",
  bio: "",
  defaultMood: "none",
}

function setup(onSave: (values: ProfileValues) => Promise<void> = () => Promise.resolve()) {
  const handleSave = vi.fn(onSave)
  render(
    <ProfileForm
      saved={saved}
      onSave={handleSave}
    />,
  )
  return {
    onSave: handleSave,
    username: screen.getByLabelText("Username"),
    name: screen.getByLabelText("Display name"),
    bio: screen.getByLabelText("Bio (optional)"),
    mood: screen.getByRole("combobox", { name: "Default mood" }),
    save: screen.getByRole("button", { name: "Save changes" }),
    discard: screen.getByRole("button", { name: "Discard changes" }),
  }
}

describe("ProfileForm", () => {
  it("starts with what is saved", () => {
    const { username, name, bio, mood, discard } = setup()

    expect(username).toHaveValue("CaffeinatedDuck")
    expect(name).toHaveValue("Caffeinated Duck")
    expect(bio).toHaveValue("")
    expect(mood).toHaveTextContent("No mood")
    expect(discard).toBeDisabled()
  })

  describe("validation", () => {
    it.each([
      ["ab", "Use at least 3 characters"],
      ["a".repeat(31), "Use at most 30 characters"],
      ["bad name", "Use only letters, numbers, dots and underscores"],
      ["émile", "Use only letters, numbers, dots and underscores"],
    ])("rejects the username %j", async (value, message) => {
      const { username, save, onSave } = setup()

      await userEvent.clear(username)
      await userEvent.type(username, value)
      await userEvent.click(save)

      expect(await screen.findByText(message)).toBeInTheDocument()
      expect(onSave).not.toHaveBeenCalled()
    })

    it.each(["abc", "a".repeat(30), "Duck.Fan_9"])("accepts the username %j", async (value) => {
      const { username, save, onSave } = setup()

      await userEvent.clear(username)
      await userEvent.type(username, value)
      await userEvent.click(save)

      await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    })

    it("requires a display name", async () => {
      const { name, save, onSave } = setup()

      await userEvent.clear(name)
      await userEvent.click(save)

      expect(await screen.findByText("Display name is required")).toBeInTheDocument()
      expect(onSave).not.toHaveBeenCalled()
    })

    it("counts the bio and allows at most 160 characters", async () => {
      const { bio, save, onSave } = setup()

      await userEvent.type(bio, "hello")
      expect(screen.getByText("5/160")).toBeInTheDocument()

      await userEvent.clear(bio)
      await userEvent.click(bio)
      await userEvent.paste("a".repeat(161))
      expect(screen.getByText("161/160")).toBeInTheDocument()
      await userEvent.click(save)

      expect(await screen.findByText("Keep it under 160 characters")).toBeInTheDocument()
      expect(onSave).not.toHaveBeenCalled()
    })
  })

  describe("saving", () => {
    it("saves trimmed values, including the chosen mood", async () => {
      const { username, name, bio, mood, save, onSave } = setup()

      await userEvent.clear(username)
      await userEvent.type(username, "Duck.Fan")
      await userEvent.clear(name)
      await userEvent.type(name, "  Duck Fan ")
      await userEvent.type(bio, "  Quack. ")
      await userEvent.click(mood)
      await userEvent.click(await screen.findByRole("option", { name: /happy/i }))
      await userEvent.click(save)

      await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
      expect(onSave.mock.calls[0]?.[0]).toEqual({
        username: "Duck.Fan",
        name: "Duck Fan",
        bio: "Quack.",
        defaultMood: "happy",
      })
    })

    it("shows a pending state and cannot be submitted twice", async () => {
      let finish: () => void = () => undefined
      const { username, save, onSave } = setup(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve
          }),
      )

      await userEvent.clear(username)
      await userEvent.type(username, "Duck.Fan")
      await userEvent.click(save)

      await waitFor(() => expect(save).toBeDisabled())
      await userEvent.click(save)
      expect(onSave).toHaveBeenCalledOnce()

      finish()
      await waitFor(() => expect(save).toBeEnabled())
    })

    it("confirms the save, until something is edited again", async () => {
      const { username, save } = setup()
      expect(screen.getByRole("status")).toBeEmptyDOMElement()

      await userEvent.clear(username)
      await userEvent.type(username, "Duck.Fan")
      await userEvent.click(save)

      expect(await screen.findByText("Settings saved")).toBeInTheDocument()
      expect(screen.getByRole("status")).toHaveTextContent("Settings saved")

      await userEvent.type(username, "x")
      expect(screen.queryByText("Settings saved")).not.toBeInTheDocument()
    })

    it("can be saved without touching anything", async () => {
      const { save, onSave } = setup()

      await userEvent.click(save)

      await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    })
  })

  describe("when the server says no", () => {
    it("shows a taken username next to the field and keeps what was typed", async () => {
      const { username, save } = setup(() =>
        Promise.reject(
          new ProfileUpdateError(
            "Username is already taken. Please try another.",
            "USERNAME_IS_ALREADY_TAKEN",
          ),
        ),
      )

      await userEvent.clear(username)
      await userEvent.type(username, "Taken.Name")
      await userEvent.click(save)

      const message = await screen.findByText("Username is already taken. Please try another.")
      expect(message).toBeInTheDocument()
      expect(username).toHaveValue("Taken.Name")
      expect(username).toHaveAttribute("aria-invalid", "true")
      expect(username).toHaveAccessibleDescription(/already taken/i)
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      expect(screen.queryByText("Settings saved")).not.toBeInTheDocument()
    })

    it("lets you fix the username and try again", async () => {
      const onSave = vi
        .fn<(values: ProfileValues) => Promise<void>>()
        .mockRejectedValueOnce(new ProfileUpdateError("Taken", "USERNAME_IS_ALREADY_TAKEN"))
        .mockResolvedValue()
      render(
        <ProfileForm
          saved={saved}
          onSave={onSave}
        />,
      )
      const username = screen.getByLabelText("Username")

      await userEvent.clear(username)
      await userEvent.type(username, "Taken.Name")
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }))
      await screen.findByText("Taken")

      await userEvent.clear(username)
      await userEvent.type(username, "Free.Name")
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }))

      expect(await screen.findByText("Settings saved")).toBeInTheDocument()
      expect(screen.queryByText("Taken")).not.toBeInTheDocument()
    })

    it("shows any other failure in an alert", async () => {
      const { save } = setup(() => Promise.reject(new Error("Network down")))

      await userEvent.click(save)

      expect(await screen.findByRole("alert")).toHaveTextContent("Network down")
    })
  })

  describe("discarding", () => {
    it("goes back to what is saved", async () => {
      const { username, name, bio, mood, discard } = setup()

      await userEvent.clear(username)
      await userEvent.type(username, "Other")
      await userEvent.type(name, "!")
      await userEvent.type(bio, "hello")
      await userEvent.click(mood)
      await userEvent.click(await screen.findByRole("option", { name: /sad/i }))
      expect(discard).toBeEnabled()

      await userEvent.click(discard)

      expect(username).toHaveValue("CaffeinatedDuck")
      expect(name).toHaveValue("Caffeinated Duck")
      expect(bio).toHaveValue("")
      expect(mood).toHaveTextContent("No mood")
      expect(discard).toBeDisabled()
    })

    it("clears the error shown for what was discarded", async () => {
      const { username, save, discard } = setup()

      await userEvent.clear(username)
      await userEvent.click(save)
      await screen.findByText("Use at least 3 characters")

      await userEvent.click(discard)

      expect(screen.queryByText("Use at least 3 characters")).not.toBeInTheDocument()
      expect(username).toHaveValue("CaffeinatedDuck")
    })

    it("goes back to the last saved values, not the first ones", async () => {
      const { username, save, discard } = setup()

      await userEvent.clear(username)
      await userEvent.type(username, "Saved.Name")
      await userEvent.click(save)
      await screen.findByText("Settings saved")

      await userEvent.type(username, "_more")
      await userEvent.click(discard)

      expect(username).toHaveValue("Saved.Name")
    })
  })
})

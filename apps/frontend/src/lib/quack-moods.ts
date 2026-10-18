import { z } from "zod"

// Mirrors the server-side QuackMood enum.
export const quackMoodSchema = z.enum(["happy", "sad", "angry", "silly"])

export type QuackMood = z.infer<typeof quackMoodSchema>

// Radix Select can't hold an empty value, so "no mood" gets its own option.
export const NO_MOOD = "none"

export const quackMoods: Record<QuackMood, { emoji: string; label: string }> = {
  happy: { emoji: "😄", label: "Happy" },
  sad: { emoji: "😢", label: "Sad" },
  angry: { emoji: "😠", label: "Angry" },
  silly: { emoji: "🤪", label: "Silly" },
}

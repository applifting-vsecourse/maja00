import type { QuackMood } from "@/features/quack/api/quackSchemas"

export const quackMoods: Record<QuackMood, { emoji: string; label: string }> = {
  happy: { emoji: "😄", label: "Happy" },
  sad: { emoji: "😢", label: "Sad" },
  angry: { emoji: "😠", label: "Angry" },
  silly: { emoji: "🤪", label: "Silly" },
}

type QuackMoodLabelProps = { mood: QuackMood; className?: string }

// The emoji is decoration — screen readers get the word only.
export function QuackMoodLabel({ mood, className }: QuackMoodLabelProps) {
  const { emoji, label } = quackMoods[mood]
  return (
    <span className={className}>
      <span aria-hidden="true">{emoji}</span> {label}
    </span>
  )
}

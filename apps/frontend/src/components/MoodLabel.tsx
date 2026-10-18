import { quackMoods, type QuackMood } from "@/lib/quack-moods"

type MoodLabelProps = { mood: QuackMood; className?: string }

// The emoji is decoration — screen readers get the word only.
export function MoodLabel({ mood, className }: MoodLabelProps) {
  const { emoji, label } = quackMoods[mood]
  return (
    <span className={className}>
      <span aria-hidden="true">{emoji}</span> {label}
    </span>
  )
}

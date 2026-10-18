import { MoodLabel } from "@/components/MoodLabel"
import { FormControl } from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NO_MOOD, quackMoodSchema } from "@/lib/quack-moods"

type MoodSelectProps = {
  // A mood, or NO_MOOD.
  value: string
  onValueChange: (value: string) => void
  isDisabled?: boolean
}

// The mood picker shared by the new-quack form and the settings form. Meant to
// sit inside a <FormItem> (it wraps the trigger in <FormControl>).
export function MoodSelect({ value, onValueChange, isDisabled }: MoodSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={isDisabled}
    >
      <FormControl>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        <SelectItem value={NO_MOOD}>No mood</SelectItem>
        {quackMoodSchema.options.map((mood) => (
          <SelectItem
            key={mood}
            value={mood}
          >
            <MoodLabel mood={mood} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

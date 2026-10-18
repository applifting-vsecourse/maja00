import { Plus, X } from "lucide-react"
import { useFieldArray, useFormContext } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

import type { QuackFormValues } from "@/features/quack/components/quackFormSchema"
import {
  POLL_MAX_DURATION_MINUTES,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
} from "@/features/quack/lib/poll"

// Days, hours and minutes add up to the length of the poll.
const DURATION_FIELDS = [
  { name: "poll.durationDays", label: "Days", max: POLL_MAX_DURATION_MINUTES / (24 * 60) },
  { name: "poll.durationHours", label: "Hours", max: 23 },
  { name: "poll.durationMinutes", label: "Minutes", max: 59 },
] as const

type PollFieldsProps = {
  isDisabled?: boolean
}

// The answers and the duration of a poll. The text of the quack is the question.
export function PollFields({ isDisabled }: PollFieldsProps) {
  const form = useFormContext<QuackFormValues>()
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "poll.options" })

  return (
    <fieldset className="flex flex-col gap-3 border-t border-border pt-3">
      <legend className="sr-only">Poll</legend>

      {fields.map((field, index) => (
        <FormField
          key={field.id}
          control={form.control}
          name={`poll.options.${index}.text`}
          render={({ field: input }) => (
            <FormItem>
              <FormLabel>Answer {index + 1}</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input
                    disabled={isDisabled}
                    {...input}
                  />
                </FormControl>
                {fields.length > POLL_MIN_OPTIONS ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove answer ${index + 1}`}
                    disabled={isDisabled}
                    onClick={() => remove(index)}
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}

      {fields.length < POLL_MAX_OPTIONS ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={isDisabled}
          onClick={() => append({ text: "" })}
        >
          <Plus className="size-4" />
          Add answer
        </Button>
      ) : null}

      <div
        role="group"
        aria-labelledby="poll-duration-label"
        className="flex flex-col gap-2"
      >
        <p
          id="poll-duration-label"
          className="text-sm leading-none font-medium"
        >
          Closes after
        </p>
        <div className="flex gap-3">
          {DURATION_FIELDS.map(({ name, label, max }) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem className="w-24">
                  <FormLabel>{label}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={max}
                      disabled={isDisabled}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
      </div>
    </fieldset>
  )
}

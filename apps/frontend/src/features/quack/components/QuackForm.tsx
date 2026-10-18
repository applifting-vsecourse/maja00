import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"

import { MoodSelect } from "@/components/MoodSelect"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { NO_MOOD, type QuackMood } from "@/lib/quack-moods"
import { cn } from "@/lib/utils"

import { PollFields } from "@/features/quack/components/PollFields"
import {
  MAX_LENGTH,
  quackFormSchema,
  type QuackFormValues,
} from "@/features/quack/components/quackFormSchema"
import { useAddQuack } from "@/features/quack/hooks/useAddQuack"
import { POLL_DEFAULT_DURATION_DAYS, totalMinutes } from "@/features/quack/lib/poll"

type QuackFormProps = {
  className?: string
  // The mood the form starts with (and returns to after posting) — the one
  // the user picked in their settings.
  defaultMood?: QuackMood | null
}

export function QuackForm({ className, defaultMood }: QuackFormProps) {
  const startMood = defaultMood ?? NO_MOOD
  const addQuack = useAddQuack()
  const form = useForm<QuackFormValues>({
    resolver: zodResolver(quackFormSchema),
    defaultValues: { text: "", mood: startMood },
  })

  const text = useWatch({ control: form.control, name: "text" })
  const length = text?.length ?? 0
  const hasPoll = useWatch({ control: form.control, name: "poll" }) !== undefined

  const togglePoll = () => {
    if (hasPoll) {
      form.setValue("poll", undefined)
      form.clearErrors("poll")
    } else {
      form.setValue("poll", {
        options: [{ text: "" }, { text: "" }],
        durationDays: String(POLL_DEFAULT_DURATION_DAYS),
        durationHours: "0",
        durationMinutes: "0",
      })
    }
  }

  const handleSubmit = (values: QuackFormValues) => {
    addQuack.mutate(
      {
        text: values.text,
        mood: values.mood === NO_MOOD ? undefined : values.mood,
        poll: values.poll
          ? {
              options: values.poll.options.map((option) => option.text),
              durationMinutes: totalMinutes(
                values.poll.durationDays,
                values.poll.durationHours,
                values.poll.durationMinutes,
              ),
            }
          : undefined,
      },
      { onSuccess: () => form.reset({ text: "", mood: startMood, poll: undefined }) },
    )
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-3", className)}
      >
        {addQuack.error ? (
          <Alert variant="destructive">
            <AlertDescription>{addQuack.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>New quack</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="Quack something..."
                    disabled={addQuack.isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mood"
            render={({ field }) => (
              <FormItem className="sm:w-40">
                <FormLabel>Mood</FormLabel>
                <MoodSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  isDisabled={addQuack.isPending}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {hasPoll ? <PollFields isDisabled={addQuack.isPending} /> : null}

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mr-auto"
            disabled={addQuack.isPending}
            onClick={togglePoll}
          >
            {hasPoll ? "Remove poll" : "Add poll"}
          </Button>
          <span
            className={cn(
              "text-sm",
              length > MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {length}/{MAX_LENGTH}
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={addQuack.isPending}
          >
            {addQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Quack
          </Button>
        </div>
      </form>
    </Form>
  )
}

import { z } from "zod"

import { NO_MOOD, quackMoodSchema } from "@/lib/quack-moods"

import {
  POLL_MAX_DURATION_MINUTES,
  POLL_MAX_OPTIONS,
  POLL_MIN_DURATION_MINUTES,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  totalMinutes,
} from "@/features/quack/lib/poll"

// Mirrors the server-side DTO (MaxLength(280)) so the user is told before
// the request is made — the server still validates independently.
export const MAX_LENGTH = 280

const pollSchema = z
  .object({
    options: z
      .array(
        z.object({
          text: z
            .string()
            .trim()
            .min(1, "Write an answer")
            .max(POLL_OPTION_MAX_LENGTH, `Keep it under ${POLL_OPTION_MAX_LENGTH} characters`),
        }),
      )
      .min(POLL_MIN_OPTIONS)
      .max(POLL_MAX_OPTIONS),
    // Kept as text while typing; turned into a number on submit.
    durationDays: z
      .string()
      .trim()
      .regex(/^\d+$/, "Enter whole days")
      .refine((value) => Number(value) <= 7, "Days go from 0 to 7"),
    durationHours: z
      .string()
      .trim()
      .regex(/^\d+$/, "Enter whole hours")
      .refine((value) => Number(value) <= 23, "Hours go from 0 to 23"),
    durationMinutes: z
      .string()
      .trim()
      .regex(/^\d+$/, "Enter whole minutes")
      .refine((value) => Number(value) <= 59, "Minutes go from 0 to 59"),
  })
  // Hours and minutes together make up the length, which is what is limited.
  .refine(
    ({ durationDays, durationHours, durationMinutes }) => {
      const total = totalMinutes(durationDays, durationHours, durationMinutes)
      return total >= POLL_MIN_DURATION_MINUTES && total <= POLL_MAX_DURATION_MINUTES
    },
    { message: "Choose between 1 minute and 7 days", path: ["durationDays"] },
  )

export const quackFormSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(MAX_LENGTH, `Keep it under ${MAX_LENGTH} characters`),
  mood: z.union([quackMoodSchema, z.literal(NO_MOOD)]),
  poll: pollSchema.optional(),
})

export type QuackFormValues = z.infer<typeof quackFormSchema>

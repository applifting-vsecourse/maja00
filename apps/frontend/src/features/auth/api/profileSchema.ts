import { z } from "zod"

import { NO_MOOD, quackMoodSchema } from "@/lib/quack-moods"

// Mirror the server-side rules (BetterAuth's username plugin, and
// profile-input.ts for the rest) so the user is told before the request is
// made — the server still validates independently.
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 30
export const NAME_MAX_LENGTH = 50
export const BIO_MAX_LENGTH = 160

export const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN_LENGTH, `Use at least ${USERNAME_MIN_LENGTH} characters`)
    .max(USERNAME_MAX_LENGTH, `Use at most ${USERNAME_MAX_LENGTH} characters`)
    .regex(/^[A-Za-z0-9_.]+$/, "Use only letters, numbers, dots and underscores"),
  name: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(NAME_MAX_LENGTH, `Keep it under ${NAME_MAX_LENGTH} characters`),
  bio: z.string().trim().max(BIO_MAX_LENGTH, `Keep it under ${BIO_MAX_LENGTH} characters`),
  // A mood, or NO_MOOD (Radix Select can't hold an empty value).
  defaultMood: z.union([quackMoodSchema, z.literal(NO_MOOD)]),
})

export type ProfileValues = z.infer<typeof profileSchema>

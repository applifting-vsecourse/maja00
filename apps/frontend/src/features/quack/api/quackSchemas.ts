import { z } from "zod"

// Per the Applifting frontend playbook: validate every server payload with zod
// and infer types from the schema rather than auto-generating them.
export const quackUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
})

// Mirrors the server-side QuackMood enum.
export const quackMoodSchema = z.enum(["happy", "sad", "angry", "silly"])

export const quackSchema = z.object({
  id: z.string(),
  text: z.string(),
  mood: quackMoodSchema.nullable(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
})

export const quacksSchema = z.array(quackSchema)

export type Quack = z.infer<typeof quackSchema>
export type QuackMood = z.infer<typeof quackMoodSchema>

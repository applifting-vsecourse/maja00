import { z } from "zod"

import { quackMoodSchema } from "@/lib/quack-moods"

// Per the Applifting frontend playbook: validate every server payload with zod
// and infer types from the schema rather than auto-generating them.
export const quackUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
})

// `votes` and `totalVotes` are null while the server is not letting this
// viewer see counts yet (open poll, not the author, hasn't voted).
export const pollSchema = z.object({
  id: z.string(),
  closesAt: z.coerce.date(),
  closed: z.boolean(),
  options: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      votes: z.number().nullable(),
    }),
  ),
  totalVotes: z.number().nullable(),
  myVoteOptionId: z.string().nullable(),
  canVote: z.boolean(),
})

export const quackSchema = z.object({
  id: z.string(),
  text: z.string(),
  mood: quackMoodSchema.nullable(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
  poll: pollSchema.nullable(),
})

export const quacksSchema = z.array(quackSchema)

export type Poll = z.infer<typeof pollSchema>
export type Quack = z.infer<typeof quackSchema>

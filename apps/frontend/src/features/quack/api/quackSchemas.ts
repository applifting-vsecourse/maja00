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

// What a reply shows about the quack it answers. No username once that quack
// was deleted: the server no longer knows who wrote it.
export const quackParentSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
  username: z.string().nullable(),
})

const quackBase = {
  id: z.string(),
  createdAt: z.coerce.date(),
  // null: a top-level quack
  parentId: z.string().nullable(),
  parent: quackParentSchema.nullable(),
  // direct replies, deleted ones included
  replyCount: z.number(),
}

export const liveQuackSchema = z.object({
  ...quackBase,
  deleted: z.literal(false),
  text: z.string(),
  mood: quackMoodSchema.nullable(),
  userId: z.string(),
  user: quackUserSchema,
  poll: pollSchema.nullable(),
})

// A deleted quack that still has replies. The server sends no text, mood,
// author or poll for it, so there is nothing here to show by mistake.
export const deletedQuackSchema = z.object({
  ...quackBase,
  deleted: z.literal(true),
})

export const quackSchema = z.discriminatedUnion("deleted", [liveQuackSchema, deletedQuackSchema])

export const quacksSchema = z.array(quackSchema)

export const quackThreadSchema = z.object({
  // the quacks above the opened one, the top-level quack first
  ancestors: z.array(quackSchema),
  focus: quackSchema,
  // every reply under `focus`, at any depth, oldest first
  descendants: z.array(quackSchema),
})

export type Poll = z.infer<typeof pollSchema>
export type QuackParent = z.infer<typeof quackParentSchema>
export type LiveQuack = z.infer<typeof liveQuackSchema>
export type DeletedQuack = z.infer<typeof deletedQuackSchema>
export type Quack = z.infer<typeof quackSchema>
export type QuackThread = z.infer<typeof quackThreadSchema>

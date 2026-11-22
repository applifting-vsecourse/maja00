import { api } from "@/lib/api-client"
import type { QuackMood } from "@/lib/quack-moods"

import { quackSchema, type Quack } from "@/features/quack/api/quackSchemas"

export type NewPoll = { options: string[]; durationMinutes: number }

// With `parentId` the quack is a reply to that quack (and can't have a poll).
export async function addQuack(input: {
  text: string
  mood?: QuackMood
  poll?: NewPoll
  parentId?: string
}): Promise<Quack> {
  const json = await api.post("quacks", { json: input }).json()
  return quackSchema.parse(json)
}

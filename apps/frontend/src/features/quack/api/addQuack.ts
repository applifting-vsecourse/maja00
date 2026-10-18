import { api } from "@/lib/api-client"
import type { QuackMood } from "@/lib/quack-moods"

import { quackSchema, type Quack } from "@/features/quack/api/quackSchemas"

export type NewPoll = { options: string[]; durationMinutes: number }

export async function addQuack(input: {
  text: string
  mood?: QuackMood
  poll?: NewPoll
}): Promise<Quack> {
  const json = await api.post("quacks", { json: input }).json()
  return quackSchema.parse(json)
}

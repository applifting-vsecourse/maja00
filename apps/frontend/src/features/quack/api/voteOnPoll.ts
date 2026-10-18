import { api } from "@/lib/api-client"

import { pollSchema, type Poll } from "@/features/quack/api/quackSchemas"

export async function voteOnPoll(input: { quackId: string; optionId: string }): Promise<Poll> {
  const json = await api
    .put(`quacks/${encodeURIComponent(input.quackId)}/poll/vote`, {
      json: { optionId: input.optionId },
    })
    .json()
  return pollSchema.parse(json)
}

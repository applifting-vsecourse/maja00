import { useMutation, useQueryClient } from "@tanstack/react-query"

import { HTTPError } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll, Quack } from "@/features/quack/api/quackSchemas"
import { voteOnPoll } from "@/features/quack/api/voteOnPoll"
import { applyVote } from "@/features/quack/lib/poll"

function mapPoll(
  quacks: Quack[] | undefined,
  quackId: string,
  update: (poll: Poll) => Poll,
): Quack[] | undefined {
  return quacks?.map((quack) =>
    quack.id === quackId && quack.poll ? { ...quack, poll: update(quack.poll) } : quack,
  )
}

/** What to tell the voter when a vote did not go through. */
export function voteErrorMessage(error: Error): string {
  if (error instanceof HTTPError && error.response.status === 409) {
    return "This poll has closed, so your vote was not counted."
  }
  return "Your vote didn't go through. Try again."
}

// The vote shows up at once in every cached list (search results included).
// If it fails the lists go back exactly as they were; either way the lists are
// refetched afterwards so what stays on screen is what the server has.
export function useVoteOnPoll() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: voteOnPoll,
    onMutate: async ({ quackId, optionId }) => {
      await queryClient.cancelQueries({ queryKey: quackKeys.lists() })
      const snapshot = queryClient.getQueriesData<Quack[]>({ queryKey: quackKeys.lists() })
      queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
        mapPoll(quacks, quackId, (poll) => applyVote(poll, optionId)),
      )
      return { snapshot }
    },
    onSuccess: (poll, { quackId }) => {
      // The server's numbers replace the instant guess.
      queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
        mapPoll(quacks, quackId, () => poll),
      )
    },
    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, data)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: quackKeys.lists() }),
  })
}

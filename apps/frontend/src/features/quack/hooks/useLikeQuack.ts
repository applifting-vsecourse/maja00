import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query"
import { toast } from "sonner"

import { likeQuack, unlikeQuack } from "@/features/quack/api/likeQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { LikeState, Quack, QuackThread } from "@/features/quack/api/quackSchemas"

type LikeInput = { shouldLike: boolean }

const likeMutationKey = (quackId: string) => [...quackKeys.all(), "like", quackId] as const

function withLikes(quack: Quack, quackId: string, update: (state: LikeState) => LikeState): Quack {
  if (quack.id !== quackId || quack.deleted) return quack
  return {
    ...quack,
    ...update({ likeCount: quack.likeCount ?? 0, likedByMe: quack.likedByMe ?? false }),
  }
}

function mapLists(
  quacks: Quack[] | undefined,
  quackId: string,
  update: (state: LikeState) => LikeState,
): Quack[] | undefined {
  return quacks?.map((quack) => withLikes(quack, quackId, update))
}

function mapThread(
  thread: QuackThread | undefined,
  quackId: string,
  update: (state: LikeState) => LikeState,
): QuackThread | undefined {
  if (!thread) return thread
  const map = (quack: Quack) => withLikes(quack, quackId, update)
  return {
    ancestors: thread.ancestors.map(map),
    focus: map(thread.focus),
    descendants: thread.descendants.map(map),
  }
}

// The like shows up at once wherever the quack is cached: every list (All,
// Mine, searches) and every thread it appears in. If the server says no,
// everything goes back exactly as it was and a toast says so.
export function useLikeQuack(quackId: string) {
  const queryClient = useQueryClient()

  const setEverywhere = (update: (state: LikeState) => LikeState) => {
    queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
      mapLists(quacks, quackId, update),
    )
    queryClient.setQueriesData<QuackThread>({ queryKey: quackKeys.threads() }, (thread) =>
      mapThread(thread, quackId, update),
    )
  }

  return useMutation({
    mutationKey: likeMutationKey(quackId),
    mutationFn: ({ shouldLike }: LikeInput) =>
      shouldLike ? likeQuack(quackId) : unlikeQuack(quackId),
    onMutate: async ({ shouldLike }) => {
      await queryClient.cancelQueries({ queryKey: quackKeys.all() })
      const snapshot: [QueryKey, unknown][] = [
        ...queryClient.getQueriesData({ queryKey: quackKeys.lists() }),
        ...queryClient.getQueriesData({ queryKey: quackKeys.threads() }),
      ]
      setEverywhere((state) =>
        state.likedByMe === shouldLike
          ? state
          : {
              likedByMe: shouldLike,
              likeCount: Math.max(0, state.likeCount + (shouldLike ? 1 : -1)),
            },
      )
      return { snapshot }
    },
    onSuccess: (state) => {
      // The server's numbers replace the instant guess, unless another click
      // on this duck is still on its way: its guess is the newer one.
      if (queryClient.isMutating({ mutationKey: likeMutationKey(quackId) }) <= 1) {
        setEverywhere(() => state)
      }
    },
    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, data)
      }
      toast.error("Your like didn't go through. Try again.")
    },
  })
}

import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quacksSchema } from "@/features/quack/api/quackSchemas"

// `mine` only says "just mine": who "me" is, the server knows from the session.
export const quacksQueryOptions = (q?: string, isMine = false) =>
  queryOptions({
    queryKey: quackKeys.list(q, isMine),
    queryFn: async () => {
      const searchParams = { ...(q ? { q } : {}), ...(isMine ? { mine: true } : {}) }
      return quacksSchema.parse(
        await api.get("quacks", { searchParams: isMine || q ? searchParams : undefined }).json(),
      )
    },
    // While the next search loads, keep showing the last results instead of
    // blanking the list on every pause in typing.
    placeholderData: keepPreviousData,
  })

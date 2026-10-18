import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quacksSchema } from "@/features/quack/api/quackSchemas"

export const quacksQueryOptions = (q?: string) =>
  queryOptions({
    queryKey: quackKeys.list(q),
    queryFn: async () =>
      quacksSchema.parse(await api.get("quacks", { searchParams: q ? { q } : undefined }).json()),
    // While the next search loads, keep showing the last results instead of
    // blanking the list on every pause in typing.
    placeholderData: keepPreviousData,
  })
